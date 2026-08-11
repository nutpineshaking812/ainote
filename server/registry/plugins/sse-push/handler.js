/**
 * sse-push - 实时数据推送插件处理器
 * 作用：向前端实时推送文本、思考过程、流程步骤状态或富媒体图表数据
 * 升级：完全对齐 ECharts 4+ 推荐的 Dataset（数据集）模式，大幅优化配置体积与逻辑解耦！
 * 极致优化：全方位适配窄屏/侧边栏/悬浮窗等窄容器，彻底解决标题重叠、坐标轴裁剪、标签文字重叠等痛点！
 */
export async function handler(params, ctx) {
  const {
    pushType,
    content,
    chartType,
    dataSource,
    chartTitle,
    xAxisKey,
    yAxisKeys,
    columnsConfig,
    conversationId: paramConversationId,
    messageId,
    saveToDb = false,
    sql: sseSql,
  } = params;
  console.log('handler===>', params);

  if (!pushType) {
    throw new Error('pushType is a required field.');
  }

  if (saveToDb && !sseSql) {
    throw new Error('sql is required when saveToDb is enabled.');
  }

  let status = pushType;
  let payload = {};

  if (pushType === 'chart') {
    if (!dataSource && !sseSql) {
      throw new Error('dataSource or sql is required when pushing a chart.');
    }

    // 1. 尝试获取并解析数据源为 JSON 数组
    let dataList = [];
    if (dataSource) {
      if (typeof dataSource === 'string') {
        try {
          dataList = JSON.parse(dataSource);
        } catch (e) {
          dataList = [];
        }
      } else if (Array.isArray(dataSource)) {
        dataList = dataSource;
      } else if (dataSource && typeof dataSource === 'object') {
        dataList = [dataSource];
      }
    } else if (sseSql) {
      // 1.5 如果 dataSource 不存在，则通过 sql 语句获取数据
      try {
        console.log(`[sse-push/handler] dataSource is empty, executing SQL: ${sseSql}`);
        const { db } = await import('../../../db/index.js');
        const { sql: drizzleSql } = await import('drizzle-orm');

        const { rows: rawRows } = await db.execute(drizzleSql.raw(sseSql));
        dataList = Array.isArray(rawRows) ? rawRows : [];
      } catch (e) {
        console.error(`[sse-push/handler] SQL execution failed:`, e);
        throw new Error(`SQL execution failed: ${e.message}`);
      }
    }

    if (!Array.isArray(dataList)) {
      dataList = [];
    }

    let parsedContent = {};

    // 2. 如果是表格，进行列自动提取或自定义解析
    if (chartType === 'table') {
      let columns = [];
      if (columnsConfig) {
        try {
          columns = typeof columnsConfig === 'string' ? JSON.parse(columnsConfig) : columnsConfig;
        } catch (e) {}
      }

      // 自动提取列
      if (!columns || columns.length === 0) {
        if (dataList.length > 0) {
          const sample = dataList[0];
          columns = Object.keys(sample)
            .filter((key) => key !== '_id' && key !== 'id')
            .map((key) => ({
              title: key.charAt(0).toUpperCase() + key.slice(1),
              dataIndex: key,
              key: key,
            }));
        }
      }

      parsedContent = {
        chartType: 'table',
        columns,
        dataSource: dataList,
      };
    } else {
      // 3. 【ECharts Dataset 升级与窄屏极致优化模式】
      const xKey = xAxisKey || 'name';
      const yKeys = (yAxisKeys || 'value').split(',').map((k) => k.trim());

      // 智能规整数据集 Key 并进行数值转换，解决 Key 不匹配和 bigint/numeric 字符串格式图表黑屏问题
      const coercedDataList = normalizeDatasetSource(dataList, xKey, yKeys);

      let option = {
        // 优化：将标题居中，并限制字体大小，防止窄屏下重叠
        title: chartTitle
          ? {
              text: chartTitle,
              left: 'center',
              top: 5,
              textStyle: { fontSize: 13, fontWeight: 'bold', color: '#333' },
            }
          : undefined,
        tooltip: {
          trigger: chartType === 'pie' ? 'item' : 'axis',
          axisPointer: { type: 'shadow' },
        },
        // 优化：将图例放置在下方或合理错开位置，防止与居中标题重叠
        legend:
          chartType === 'pie'
            ? {
                orient: 'horizontal',
                left: 'center',
                bottom: 5,
                textStyle: { fontSize: 10 },
              }
            : {
                left: 'center',
                top: chartTitle ? 28 : 5,
                textStyle: { fontSize: 10 },
              },
        // 优化：使用极其紧凑的 grid 布局，最大限度释放空间，并在存在滚动条时增加底边距
        grid:
          chartType === 'pie'
            ? undefined
            : {
                left: '4%',
                right: '5%',
                bottom: coercedDataList.length > 15 ? '20%' : '12%',
                top: chartTitle ? 62 : 35,
                containLabel: true,
              },
        // 智能缩放：当数据项大于 15 个时，自动启用交互式滚动条与区域缩放以防重叠
        dataZoom:
          chartType === 'pie' || coercedDataList.length <= 15
            ? undefined
            : [
                {
                  type: 'slider',
                  show: true,
                  height: 14,
                  bottom: 4,
                  start: 0,
                  end: Math.min(100, Math.floor((15 / coercedDataList.length) * 100)),
                  textStyle: { fontSize: 8 },
                },
                {
                  type: 'inside',
                  start: 0,
                  end: Math.min(100, Math.floor((15 / coercedDataList.length) * 100)),
                },
              ],
        // 使用 dataset 集中管理数据
        dataset: {
          dimensions: [xKey, ...yKeys],
          source: coercedDataList,
        },
        // 优化：X 轴类目文字自动倾斜 30 度，并使用自适应间隔防止密集文字相互重叠
        xAxis:
          chartType === 'pie'
            ? undefined
            : {
                type: 'category',
                axisLabel: {
                  interval: 'auto', // 自动分配合理排版间隔
                  rotate: 30, // 完美防重叠倾斜角度
                  margin: 8,
                  textStyle: { fontSize: 9 },
                },
              },
        yAxis:
          chartType === 'pie'
            ? undefined
            : {
                type: 'value',
                axisLabel: {
                  textStyle: { fontSize: 9 },
                },
              },
        series: [],
      };

      if (chartType === 'pie') {
        // 饼图的 dataset 数据映射
        option.series = [
          {
            name: chartTitle || '占比',
            type: 'pie',
            radius: ['35%', '60%'], // 采用环形饼图，窄屏视觉更显高档
            center: ['50%', chartTitle ? '48%' : '50%'],
            encode: {
              itemName: xKey,
              value: yKeys[0],
            },
            label: {
              show: true,
              fontSize: 9,
              formatter: '{b}: {d}%',
            },
            emphasis: {
              itemStyle: {
                shadowBlur: 10,
                shadowOffsetX: 0,
                shadowColor: 'rgba(0, 0, 0, 0.5)',
              },
            },
          },
        ];
      } else {
        // 柱状图 / 折线图的多维度系列声明
        option.series = yKeys.map((yKey) => ({
          name: yKey,
          type: chartType,
          barMaxWidth: 24, // 限制柱体最大宽度，避免单条数据时柱子过粗
          itemStyle:
            chartType === 'bar'
              ? {
                  borderRadius: [4, 4, 0, 0], // 柱状图圆角，让 UI 更加现代化
                }
              : undefined,
        }));
      }

      parsedContent = {
        chartType,
        dataSource: option,
      };
    }

    status = 'data';
    payload = {
      data: parsedContent,
    };
  } else {
    if (content === undefined || content === null) {
      throw new Error('content is required for text/stage/thinking push.');
    }

    let parsed = null;
    if (typeof content === 'string') {
      const trimmed = content.trim();
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
          parsed = JSON.parse(trimmed);
        } catch (e) {}
      }
    } else if (content && typeof content === 'object') {
      parsed = content;
    }

    let actualContent = content;
    if (parsed && typeof parsed === 'object') {
      actualContent = parsed.content ?? parsed.text ?? parsed.textDelta ?? parsed.delta ?? content;
    }

    payload = {
      content: actualContent,
    };
  }

  // 4. 确定目标会话与消息 ID
  const conversationId = paramConversationId;
  let targetMessageId = messageId;

  if (saveToDb && !conversationId && !targetMessageId) {
    throw new Error('conversationId or messageId is required when saveToDb is enabled.');
  }

  // 如果开启持久化且无可用 messageId，尝试获取最新助手消息或自动创建
  if (saveToDb && !targetMessageId && conversationId) {
    const { findLatestAssistantMessageId, createAssistantMessage } =
      await import('../../../services/conversationService.js');
    targetMessageId = await findLatestAssistantMessageId(conversationId);
    if (!targetMessageId) {
      const newMsg = await createAssistantMessage(conversationId);
      targetMessageId = newMsg.id;
    }
  }

  // 绑定 messageId 到事件载荷中
  if (targetMessageId) {
    payload.messageId = targetMessageId;
    payload.assistantMessageId = targetMessageId;
  }

  // 5. 持久化数据到数据库以获取 segmentId
  let segmentId;
  if (saveToDb && targetMessageId) {
    const { appendMessageSegments } = await import('../../../services/conversationService.js');
    let segmentType = 'assistant';
    let segmentContent = content;

    if (pushType === 'chart') {
      segmentType = 'chart_data';
      segmentContent = payload.data;
    } else if (pushType === 'thinking-delta') {
      segmentType = 'thought';
    } else if (pushType === 'stage') {
      segmentType = 'stage';
    }

    console.log('sql=====>', sseSql);
    const addedSegments = await appendMessageSegments(targetMessageId, [
      {
        type: segmentType,
        content: segmentContent,
        meta: { sql: sseSql },
      },
    ]);
    segmentId = addedSegments[0]?.id;
    if (segmentId) {
      payload.segmentId = String(segmentId);
    }
  }

  // 6. 调用原生推送接口发射事件（此时 payload 已包含 segmentId 和 messageId）
  if (typeof ctx.sendProgress === 'function') {
    ctx.sendProgress(status, {
      ...payload,
      nodeId: ctx.nodeId,
    });
  } else {
    const { default: workflowEvents } = await import('../../../services/workflow.events.js');
    workflowEvents.emit('node:progress', {
      workflowId: ctx.workflowId,
      executionId: ctx.executionId,
      nodeId: ctx.nodeId,
      sessionId: conversationId,
      status,
      ...payload,
    });
  }

  return {
    success: true,
    conversationId: saveToDb ? conversationId : undefined,
    messageId: saveToDb ? targetMessageId : undefined,
    segmentId: saveToDb ? segmentId : undefined,
  };
}

/**
 * 规整数据集并进行数值转换：
 * 当数据源中的 Key (例如 "半年维度", "平均转化率") 与图表要求的 Key (如 "name", "value") 不一致时，
 * 自动建立键值映射转换，并同时将指标轴数据强制转为数值类型。
 */
function normalizeDatasetSource(dataList, xKey, yKeys) {
  if (!Array.isArray(dataList) || dataList.length === 0) return dataList;

  const firstItem = dataList[0];
  if (!firstItem || typeof firstItem !== 'object') return dataList;

  const availableKeys = Object.keys(firstItem);
  const hasXKey = availableKeys.includes(xKey);
  const hasAllYKeys = yKeys.every((k) => availableKeys.includes(k));

  let mappedXKey = xKey;
  let mappedYKeys = [...yKeys];

  // 1. 如果 X 轴 Key 不匹配，映射到数据中的第一个可用键
  if (!hasXKey && availableKeys.length > 0) {
    mappedXKey = availableKeys[0];
  }

  // 2. 如果 Y 轴 Key 不匹配，映射到数据中除 X 轴外的其余字段
  if (!hasAllYKeys) {
    const remainingKeys = availableKeys.filter(
      (k) => k !== mappedXKey && k !== 'id' && k !== '_id'
    );
    mappedYKeys = yKeys.map((yKey, index) => {
      if (availableKeys.includes(yKey)) return yKey;
      return remainingKeys[index] || yKey;
    });
  }

  return dataList.map((item) => {
    if (!item || typeof item !== 'object') return item;
    const newItem = {};

    // 映射类目轴数据到预期的 xKey (如 name)
    if (availableKeys.includes(mappedXKey)) {
      newItem[xKey] = item[mappedXKey];
    } else {
      newItem[xKey] = item[xKey];
    }

    // 映射指标轴数据到预期的 yKeys (如 value) 并进行数值兼容转换
    yKeys.forEach((yKey, index) => {
      const srcKey = mappedYKeys[index];
      let val = item[srcKey] !== undefined ? item[srcKey] : item[yKey];

      if (typeof val === 'string') {
        const trimmed = val.trim();
        if (trimmed !== '' && !isNaN(Number(trimmed))) {
          val = Number(trimmed);
        }
      }
      newItem[yKey] = val;
    });

    if (item.id !== undefined) newItem.id = item.id;
    if (item._id !== undefined) newItem._id = item._id;

    return newItem;
  });
}
