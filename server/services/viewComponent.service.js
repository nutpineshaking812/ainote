import ViewComponentRepository from '../repositories/viewComponent.repository.js';
import ViewRepository from '../repositories/view.repository.js';
import ApiError from '../utils/ApiError.js';
import ChatMessageRepository from '../repositories/chatMessage.repository.js';
import { formRecordRepository } from '../repositories/formRecord.repository.js';

import { db } from '../db/index.js';
import { sql as drizzleSql } from 'drizzle-orm';

// Create a component (decoupled: no appId/viewId stored)
async function createComponent(_appIdIgnored, ownerId, payload) {
  return ViewComponentRepository.create({
    ownerId: ownerId.toString(),
    type: payload.type,
    name: payload.name,
    description: payload.description,
    source: payload.source || 'manual',
    sourceId: payload.sourceId ? payload.sourceId.toString() : null,
    sourceSegmentId: payload.sourceSegmentId ? payload.sourceSegmentId.toString() : null,
    config: payload.config || {},
    sql: payload.sql || null,
  });
}

// Get single component
async function getComponent(id) {
  const doc = await ViewComponentRepository.findById(id);
  if (!doc) throw new ApiError(404, 'COMPONENT_NOT_FOUND');
  return doc;
}

// List components for an app
async function listComponents(_appIdIgnored, { type, search, viewId }) {
  return ViewComponentRepository.find({
    where: (t, { eq, and, sql }) => {
      const conditions = [];
      if (type) conditions.push(eq(t.type, type));
      if (search) conditions.push(sql`${t.name} ILIKE ${'%' + search + '%'}`);
      return conditions.length > 0 ? and(...conditions) : undefined;
    },
    limit: 500,
    orderBy: (t, { desc }) => [desc(t.updatedAt)],
  });
}

// Update component (POST action style)
async function updateComponent(id, updates) {
  const doc = await ViewComponentRepository.findById(id);
  if (!doc) throw new ApiError(404, 'COMPONENT_NOT_FOUND');

  const updateData = {};
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.description !== undefined) updateData.description = updates.description;
  if (updates.config !== undefined) updateData.config = updates.config;
  // if (updates.sql !== undefined) updateData.sql = updates.sql;
  if (updates.source !== undefined) updateData.source = updates.source;
  if (updates.sourceId !== undefined && !doc.sourceId)
    updateData.sourceId = updates.sourceId.toString();

  if (Object.keys(updateData).length > 0) {
    return ViewComponentRepository.update(id, updateData);
  }
  return doc;
}

// Delete component (ensure not referenced in any view.layout)
async function deleteComponent(id) {
  const used = await ViewRepository.findOne({
    where: (t, { sql }) =>
      sql`${t.layout}::jsonb @> ${JSON.stringify([{ componentId: id }])}::jsonb`,
  });
  if (used) throw new ApiError(400, 'COMPONENT_IN_USE');
  await ViewComponentRepository.delete(id);
  return { deleted: true };
}

// Ensure a set of component IDs exist
async function ensureComponentsExist(ids) {
  if (!Array.isArray(ids) || !ids.length) return;
  for (const id of ids) {
    const exists = await ViewComponentRepository.findById(id);
    if (!exists) throw new ApiError(400, 'INVALID_LAYOUT_COMPONENT');
  }
}

// Create component from AI message segment directly by segmentId
async function createComponentFromSegment(segmentId, ownerId) {
  if (!segmentId) throw new ApiError(400, 'SEGMENT_ID_REQUIRED');

  // Check if component already exists for this segmentId
  const existing = await ViewComponentRepository.findOne({
    where: (t, { eq }) => eq(t.sourceSegmentId, segmentId.toString()),
  });
  if (existing) {
    return { alreadyExists: true, component: existing };
  }

  // Find the segment in database
  const drizzle = await import('drizzle-orm');
  const { chatMessageSegments } = await import('../db/schema/chatMessageSegments.js');
  const [segment] = await db
    .select()
    .from(chatMessageSegments)
    .where(drizzle.eq(chatMessageSegments.id, segmentId.toString()))
    .limit(1);

  if (!segment) throw new ApiError(404, 'MESSAGE_SEGMENT_NOT_FOUND');

  let chartData = segment.content;
  if (typeof chartData === 'string') {
    try {
      chartData = JSON.parse(chartData);
    } catch (err) {
      throw new ApiError(400, 'INVALID_CHART_DATA');
    }
  }

  if (!chartData) {
    throw new ApiError(400, 'MESSAGE_NOT_CHART');
  }

  let extractedSql =
    chartData.sql || (segment.meta && typeof segment.meta === 'object' ? segment.meta.sql : null);

  const dimensions = chartData.dataSource?.dataset?.dimensions || [];
  const config = {
    chartType: chartData.chartType || chartData.type || 'bar',
    columns: chartData.columns || [],
    dataSource: chartData.dataSource || {},
    title: chartData.title || chartData.name || '图表',
    xAxisKey: chartData.xAxisKey || (dimensions.length > 0 ? dimensions[0] : null),
    yAxisKeys:
      chartData.yAxisKeys || (dimensions.length > 1 ? dimensions.slice(1).join(',') : null),
    ...((chartData.data || chartData.config) &&
    typeof (chartData.data || chartData.config) === 'object'
      ? chartData.data || chartData.config
      : {}),
  };

  const name = config.title;
  const type = config.chartType === 'table' ? 'table' : 'chart';

  const component = await ViewComponentRepository.create({
    ownerId: ownerId.toString(),
    type,
    name,
    description: chartData.description || '',
    source: 'aimessage',
    sourceId: segment.messageId ? segment.messageId.toString() : null,
    sourceSegmentId: segmentId.toString(),
    config,
    sql: extractedSql,
  });

  return { alreadyExists: false, component };
}

// Create component from AI message (chart role/segment) by messageId
async function createComponentFromMessage(messageId, ownerId, options = {}) {
  const { segmentId } = options;
  if (segmentId) {
    return createComponentFromSegment(segmentId, ownerId);
  }
  const lookup = { source: 'aimessage', sourceId: messageId };

  const existing = await ViewComponentRepository.findOne({
    where: (t, { eq, and }) => {
      const conditions = [eq(t.source, 'aimessage'), eq(t.sourceId, messageId.toString())];
      if (segmentId) conditions.push(eq(t.sourceSegmentId, segmentId.toString()));
      return and(...conditions);
    },
  });
  if (existing) {
    return { alreadyExists: true, component: existing };
  }

  const msg = await ChatMessageRepository.findByIdWithSegments(messageId);
  if (!msg) throw new ApiError(404, 'MESSAGE_NOT_FOUND');

  console.log(
    `[viewComponent.service] createComponentFromMessage messageId=${messageId}, role=${msg.role}, segmentsCount=${msg.segments?.length || 0}`,
  );
  if (msg.segments) {
    console.log(
      '[viewComponent.service] Message segments:',
      msg.segments.map((s) => ({ type: s.type, hasText: !!s.text, hasContent: !!s.content })),
    );
  }

  const normalizedSegmentId = segmentId ? String(segmentId) : null;
  const selectSegment = () => {
    if (!Array.isArray(msg.segments)) return null;
    if (normalizedSegmentId) {
      return msg.segments.find((seg) => seg?._id && String(seg._id) === normalizedSegmentId);
    }
    return msg.segments.find((seg) => seg?.type === 'chart_data');
  };

  let chartData = null;
  let chartSegment = null;

  if (normalizedSegmentId) {
    chartSegment = selectSegment();
    if (!chartSegment) throw new ApiError(404, 'MESSAGE_SEGMENT_NOT_FOUND');
    chartData = chartSegment.text || chartSegment.content || null;
  } else if (msg.role === 'chart') {
    chartData = msg.content;
  } else {
    chartSegment = selectSegment();
    chartData = chartSegment?.text || chartSegment?.content || null;
  }

  if (typeof chartData === 'string') {
    try {
      chartData = JSON.parse(chartData);
    } catch (err) {
      throw new ApiError(400, 'INVALID_CHART_DATA');
    }
  }

  if (!chartData) {
    throw new ApiError(400, 'MESSAGE_NOT_CHART');
  }

  // Debug logging
  console.log(
    '[createComponentFromMessage] Extracted chartData:',
    JSON.stringify(chartData).slice(0, 200) + '...',
  );
  console.log('chartData', chartData);
  const pipeline = chartData.pipeline || chartData.query?.pipeline || [];
  let extractedSql = chartData.sql || null;


  const dimensions = chartData.dataSource?.dataset?.dimensions || [];
  const config = {
    chartType: chartData.chartType || chartData.type || 'bar',
    columns: chartData.columns || [],
    dataSource: chartData.dataSource || {}, // Still useful for some static logic
    title: chartData.title || chartData.name || '图表',
    xAxisKey: chartData.xAxisKey || (dimensions.length > 0 ? dimensions[0] : null),
    yAxisKeys:
      chartData.yAxisKeys || (dimensions.length > 1 ? dimensions.slice(1).join(',') : null),
    ...((chartData.data || chartData.config) &&
    typeof (chartData.data || chartData.config) === 'object'
      ? chartData.data || chartData.config
      : {}),
  };

  const name = config.title;
  const type = config.chartType === 'table' ? 'table' : 'chart';

  console.log(
    `[createComponentFromMessage] Creating component: type=${type}, name=${name}, hasSql=${!!extractedSql}`,
  );

  const component = await ViewComponentRepository.create({
    ownerId: ownerId.toString(),
    type,
    name,
    description: chartData.description || '',
    source: 'aimessage',
    sourceId: messageId.toString(),
    sourceSegmentId: chartSegment?._id
      ? chartSegment._id.toString()
      : segmentId
        ? segmentId.toString()
        : null,
    config,
    sql: extractedSql,
  });

  return { alreadyExists: false, component };
}

/**
 * Execute a component's SQL and return aggregated rows formatted properly for Table or ECharts,
 * aligning dynamic structures with the sse-push formatting logic.
 * @param {string} componentId
 * @returns {Promise<Object>}
 */
async function runComponentData(componentId) {
  const component = await getComponent(componentId);
  const sql = component.sql;

  if (!sql) {
    return {
      rows: [],
      title: component.name || component.config?.title || '未命名图表',
      chartType: resolveChartType(component),
    };
  }

  try {
    console.log(`[runComponentData] Executing SQL directly: ${sql}`);
    const { rows: rawRows } = await db.execute(drizzleSql.raw(sql));
    const dataList = Array.isArray(rawRows) ? rawRows : [];

    const cfg = component.config || {};
    const chartType = resolveChartType(component);

    let formattedResult = {};

    if (chartType === 'table') {
      let columns = cfg.columns || [];
      if (columns.length === 0 && dataList.length > 0) {
        const sample = dataList[0];
        columns = Object.keys(sample)
          .filter((key) => key !== '_id' && key !== 'id')
          .map((key) => ({
            title: key.charAt(0).toUpperCase() + key.slice(1),
            dataIndex: key,
            key: key,
          }));
      }

      formattedResult = {
        chartType: 'table',
        columns,
        dataSource: dataList,
        title: component.name || cfg.title || '新图表',
      };
    } else {
      // ECharts dataset layout formatting aligned with sse-push
      let xKey = cfg.xAxisKey;
      if (!xKey && dataList.length > 0) {
        const keys = Object.keys(dataList[0]).filter((k) => k !== 'id' && k !== '_id');
        if (keys.length > 0) {
          xKey = keys[0];
        }
      }
      if (!xKey) {
        xKey = 'name';
      }

      let yKeys = [];
      if (cfg.yAxisKeys) {
        yKeys =
          typeof cfg.yAxisKeys === 'string'
            ? cfg.yAxisKeys.split(',').map((k) => k.trim())
            : [].concat(cfg.yAxisKeys);
      } else if (dataList.length > 0) {
        const sample = dataList[0];
        yKeys = Object.keys(sample).filter((key) => key !== xKey && key !== '_id' && key !== 'id');
      }
      if (yKeys.length === 0) {
        yKeys = ['value'];
      }

      // 智能规整数据集 Key 并进行数值转换，解决 Key 不匹配和 bigint/numeric 字符串格式图表黑屏问题
      const coercedDataList = normalizeDatasetSource(dataList, xKey, yKeys);

      const chartTitle = component.name || cfg.title;

      let option = {
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
        dataset: {
          dimensions: [xKey, ...yKeys],
          source: coercedDataList,
        },
        xAxis:
          chartType === 'pie'
            ? undefined
            : {
                type: 'category',
                axisLabel: {
                  interval: 'auto', // 自动分配合理排版间隔
                  rotate: 30,
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
        option.series = [
          {
            name: chartTitle || '占比',
            type: 'pie',
            radius: ['35%', '60%'],
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
        option.series = yKeys.map((yKey) => ({
          name: yKey,
          type: chartType,
          barMaxWidth: 24,
          itemStyle:
            chartType === 'bar'
              ? {
                  borderRadius: [4, 4, 0, 0],
                }
              : undefined,
        }));
      }

      formattedResult = {
        chartType,
        dataSource: option,
        title: chartTitle || '新图表',
      };
    }

    return formattedResult;
  } catch (err) {
    console.error(`[runComponentData] SQL execution failed for ${componentId}:`, err);
    throw ApiError.badRequest(err.message || '聚合执行失败');
  }
}

function resolveChartType(component) {
  const cfg = component.config || {};
  const t = cfg.chartType || cfg.type || component.type || 'bar';
  return t.toLowerCase();
}

export {
  createComponent,
  getComponent,
  listComponents,
  updateComponent,
  deleteComponent,
  ensureComponentsExist,
  createComponentFromMessage,
  createComponentFromSegment,
  runComponentData,
};

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
