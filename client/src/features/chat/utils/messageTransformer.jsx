import React from 'react';
import { Think } from '@ant-design/x';
import { Typography, theme, Space, Table, Button } from 'antd';
import {
  LoadingOutlined,
  ThunderboltOutlined,
  BulbOutlined,
  CheckCircleOutlined,
  SearchOutlined,
  GlobalOutlined,
  ToolOutlined,
  PlusOutlined,
  CaretDownOutlined,
  CaretRightOutlined,
} from '@ant-design/icons';
import XMarkdownDisplay from '../../../components/common/XMarkdownDisplay';
import EChartsComponent from '../../../components/chart/EChartsComponent';

/**
 * 核心转换逻辑：将扁平的消息片段 (segments) 转换为 UI 专用的部件 (parts) 或直接渲染为组件
 */

const THOUGHT_TITLE_MAP = {
  recall_memory: '检索项目知识库',
  thought: '逻辑推理',
  tool_execution: '执行工具',
  stage: '处理进度',
};

const getThoughtTitle = (name) => {
  if (THOUGHT_TITLE_MAP[name]) return THOUGHT_TITLE_MAP[name];
  if (name && name !== 'tool_execution') return `执行工具: ${name}`;
  return '执行工具';
};

// 还原原版精细的图标匹配逻辑
const getSegmentIcon = (type, titleStr = '', status, token) => {
  if (status === 'loading')
    return (
      <LoadingOutlined spin style={{ fontSize: 12, color: token?.colorPrimary || '#1677ff' }} />
    );
  const title = String(titleStr).toLowerCase();
  if (title.includes('搜索') || title.includes('检索'))
    return <SearchOutlined style={{ fontSize: 12 }} />;
  if (title.includes('网页') || title.includes('浏览') || title.includes('网络'))
    return <GlobalOutlined style={{ fontSize: 12 }} />;
  if (
    title.includes('工具') ||
    title.includes('执行') ||
    title.includes('调用') ||
    type === 'tool_call'
  )
    return <ThunderboltOutlined style={{ fontSize: 12 }} />;
  if (
    title.includes('思考') ||
    title.includes('分析') ||
    title.includes('逻辑') ||
    type === 'thought'
  )
    return <BulbOutlined style={{ fontSize: 12 }} />;
  if (status === 'success')
    return (
      <CheckCircleOutlined style={{ color: token?.colorSuccess || '#52c41a', fontSize: 12 }} />
    );
  return <ToolOutlined style={{ fontSize: 12 }} />;
};

// 通用的思维块渲染器 (这是一个真正的 React 组件，内部可以使用 Hook)
const RenderThinkItem = ({ type, part, status, expanded = true, collapsible = false }) => {
  const { token } = theme.useToken();
  const { title, description } = part;
  const icon = getSegmentIcon(type, title, status, token);
  const [isExpanded, setIsExpanded] = React.useState(expanded);

  const canToggle = collapsible && description;
  const showDescription = description && (collapsible ? isExpanded : (expanded || status === 'loading'));

  const handleToggle = () => {
    if (canToggle) setIsExpanded((prev) => !prev);
  };

  return (
    <div style={{ marginBottom: '8px' }}>
      <Space
        size={8}
        style={{
          marginBottom: showDescription ? 4 : 0,
          cursor: canToggle ? 'pointer' : 'default',
          userSelect: 'none',
        }}
        onClick={handleToggle}
      >
        <span style={{ display: 'flex', alignItems: 'center', color: token.colorTextDescription }}>
          {icon}
        </span>
        <Typography.Text strong style={{ fontSize: '12px', color: token.colorTextSecondary }}>
          {title}
        </Typography.Text>
        {status === 'loading' && description && !collapsible && (
          <LoadingOutlined spin style={{ fontSize: 10, color: token.colorTextQuaternary }} />
        )}
        {canToggle && (
          <span style={{ fontSize: 10, color: token.colorTextQuaternary, marginLeft: 2 }}>
            {isExpanded ? <CaretDownOutlined /> : <CaretRightOutlined />}
          </span>
        )}
      </Space>

      {showDescription && (
        <div
          style={{
            background: token.colorFillQuaternary,
            padding: '6px 10px',
            borderRadius: 6,
            marginTop: 4,
            fontSize: 12,
            lineHeight: 1.5,
            border: `1px solid ${token.colorBorderSecondary}`,
            color: token.colorTextSecondary,
            overflow: 'hidden',
          }}
        >
          {typeof description === 'string' ? (
            <XMarkdownDisplay components={markdownComponents}>{description}</XMarkdownDisplay>
          ) : (
            description
          )}
        </div>
      )}
    </div>
  );
};

// 内部使用的文本渲染组件，解决 Hook 调用规则问题
const TextSegment = ({ part, status }) => {
  const { token } = theme.useToken();
  return (
    <div className="ai-seg ai-seg-text" style={{ fontSize: 14, lineHeight: 1.6, marginBottom: 4 }}>
      {part.images && part.images.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          {part.images.map((url, idx) => (
            <img
              key={idx}
              src={url}
              alt="Uploaded"
              style={{
                maxWidth: 160,
                maxHeight: 120,
                borderRadius: 4,
                border: '1px solid #e8e8e8',
                objectFit: 'cover'
              }}
            />
          ))}
        </div>
      )}
      <XMarkdownDisplay components={markdownComponents}>{part.content}</XMarkdownDisplay>
      {status === 'loading' && (
        <span
          className="streaming-cursor"
          style={{
            display: 'inline-block',
            width: '4px',
            height: '15px',
            background: token.colorPrimary,
            marginLeft: '4px',
            verticalAlign: 'middle',
            animation: 'blink 1s step-end infinite',
          }}
        />
      )}
    </div>
  );
};

/**
 * Segment 类型到 UI 表现的统一映射注册表
 */

/**
 * 判断一个对象是否是图表数据（含 chartType 或 queryResult）
 */
const isChartObject = (val) => {
  if (val === null || typeof val !== 'object' || Array.isArray(val)) return false;
  let options = val;
  while (options && options.data && options.data !== options) {
    options = options.data;
  }
  return options && (options.chartType !== undefined || options.queryResult !== undefined);
};
export const SegmentUIMapping = {
  text: {
    isRoot: true,
    toPart: (seg) => {
      let val = seg.text !== undefined && seg.text !== null ? seg.text : seg.content || '';
      if (typeof val === 'string' && val.trim().startsWith('[')) {
        try {
          val = JSON.parse(val);
        } catch (e) {}
      }
      if (Array.isArray(val)) {
        const textItem = val.find((item) => item.type === 'text');
        const text = textItem ? textItem.text || textItem.content : '';
        const images = val.filter((item) => item.type === 'image_url').map((item) => item.image_url?.url || item.url).filter(Boolean);
        return { type: 'text', content: text, images };
      }
      return { type: 'text', content: String(val) };
    },
    render: (part, key, { status }) => <TextSegment key={key} part={part} status={status} />,
  },

  image_url: {
    isRoot: true,
    toPart: (seg) => {
      const val = seg.text !== undefined && seg.text !== null ? seg.text : seg.content || '';
      const url = typeof val === 'string' ? val : val?.url || '';
      return { type: 'text', content: '', images: [url] };
    },
    render: (part, key, { status }) => <TextSegment key={key} part={part} status={status} />,
  },

  user: {
    isRoot: true,
    toPart: (seg) => {
      let val = seg.text !== undefined && seg.text !== null ? seg.text : seg.content || '';
      if (typeof val === 'string' && val.trim().startsWith('[')) {
        try {
          val = JSON.parse(val);
        } catch (e) {}
      }
      if (Array.isArray(val)) {
        const textItem = val.find((item) => item.type === 'text');
        const text = textItem ? textItem.text || textItem.content : '';
        const images = val.filter((item) => item.type === 'image_url').map((item) => item.image_url?.url || item.url).filter(Boolean);
        return { type: 'text', content: text, images };
      }
      return { type: 'text', content: String(val) };
    },
    render: (part, key, { status }) => <TextSegment key={key} part={part} status={status} />,
  },

  // 历史消息中 type=assistant 的 segment，text 可能是普通文本或图表对象
  assistant: {
    isRoot: true,
    toPart: (seg) => {
      let val = seg.text !== undefined && seg.text !== null ? seg.text : seg.content || '';
      // 历史消息的 text 有时以 JSON 字符串形式存储，先尝试解析
      if (typeof val === 'string' && val.trim().startsWith('{')) {
        try {
          val = JSON.parse(val);
        } catch (e) {
          /* 不是 JSON，保持字符串 */
        }
      }
      if (isChartObject(val)) {
        // Standardize the chart data format right here to keep ChartComponent pure
        let options = val;
        while (options && options.data && options.data !== options) {
          options = options.data;
        }
        if (options && options.queryResult) {
          const chartType = (options.chartType || 'table').toLowerCase();
          if (chartType === 'table') {
            let resolvedColumns = options.columns;
            if (!resolvedColumns && options.columnsConfig) {
              try {
                resolvedColumns =
                  typeof options.columnsConfig === 'string'
                    ? JSON.parse(options.columnsConfig)
                    : options.columnsConfig;
              } catch (e) {}
            }
            options = {
              chartType: 'table',
              columns: resolvedColumns,
              dataSource: options.queryResult,
              title: options.chartTitle || '新图表',
            };
          } else {
            const xKey = options.xAxisKey;
            const yKeys = options.yAxisKeys
              ? typeof options.yAxisKeys === 'string'
                ? options.yAxisKeys.split(',').map((k) => k.trim())
                : [].concat(options.yAxisKeys)
              : [];
            const echartsOption = {
              tooltip: { trigger: 'axis' },
              xAxis: { type: 'category', data: options.queryResult.map((r) => r[xKey] ?? '') },
              yAxis: { type: 'value' },
              series: yKeys.map((yKey) => ({
                name: yKey,
                type: chartType,
                data: options.queryResult.map((r) => Number(r[yKey]) || 0),
              })),
              title: options.chartTitle ? { text: options.chartTitle } : undefined,
            };
            options = {
              chartType,
              dataSource: echartsOption,
              title: options.chartTitle || '新图表',
            };
          }
        }
        return { type: 'chart', data: options, segmentId: seg.segmentId || seg.id };
      }
      return { type: 'text', content: typeof val === 'string' ? val : JSON.stringify(val) };
    },
    render: (part, key, { status, onAddChart, message, displayMode }) => {
      if (part.type === 'chart') {
        return (
          <div key={key} className="ai-seg ai-seg-chart" style={{ margin: '8px 0' }}>
            <ChartComponent
              data={part.data}
              onAddChart={onAddChart}
              message={message}
              segment={part._seg}
              displayMode={displayMode}
            />
          </div>
        );
      }
      return <TextSegment key={key} part={part} status={status} />;
    },
  },

  stage: {
    isThought: true,
    toPart: (seg) => {
      const val = seg.text || seg.content || '正在处理';
      let titleStr = '正在处理';
      if (typeof val === 'string') {
        titleStr = val;
      } else if (val && typeof val === 'object') {
        titleStr = val.chartTitle || val.title || val.message || '正在处理图表';
      }
      return { title: titleStr, description: null };
    },
    render: (part, key, { status }) => (
      <RenderThinkItem key={key} type="stage" part={part} status={status} />
    ),
  },

  thought: {
    isThought: true,
    toPart: (seg) => {
      const content = seg.text || seg.content || '';
      return {
        title: getThoughtTitle('thought'),
        description: typeof content === 'string' ? content : JSON.stringify(content, null, 2),
      };
    },
    render: (part, key, { status }) => (
      <RenderThinkItem key={key} type="thought" part={part} status={status} />
    ),
  },

  tool_call: {
    isThought: true,
    toPart: (seg) => {
      // SSE: seg.toolName / seg.name; DB: seg.content.name; DB via API: seg.text.name
      const toolName = seg.toolName || seg.name || seg.content?.name || seg.text?.name || '';
      const title = getThoughtTitle(toolName || 'tool_execution');

      // 还在等待工具结果 → 只显示名称 + loading 状态，不展示参数
      if (!seg.toolOutput) {
        return { title, description: null };
      }

      // 结果已返回 → 展示内容（数据已由服务端根据 displayMode 过滤，无 args 则不展示参数）
      let displayArgs = '{}';
      if (seg.input) {
        displayArgs = JSON.stringify(seg.input, null, 2);
      } else if (seg.content?.args) {
        displayArgs = JSON.stringify(seg.content.args, null, 2);
      } else if (seg.text && typeof seg.text === 'object' && seg.text.args) {
        // DB via API: controller 映射 content → text，args 在 text.args
        displayArgs = JSON.stringify(seg.text.args, null, 2);
      } else if (typeof seg.text === 'string' && seg.text.trim()) {
        try {
          displayArgs = JSON.stringify(JSON.parse(seg.text), null, 2);
        } catch (e) {
          displayArgs = seg.text;
        }
      }
      // 注：不再对 text 对象做兜底序列化，避免把 {id, name, type} 工具元数据当作输入参数

      return {
        title,
        description: formatToolCallDescription(displayArgs, seg.toolOutput),
      };
    },
    render: (part, key, { status }) => (
      <RenderThinkItem key={key} type="tool_call" part={part} status={status} collapsible={true} expanded={false} />
    ),
  },

  tool_output: {
    isThought: true,
    toPart: (seg) => {
      const data = seg.text || seg.content || '';

      let displayResult = '';
      if (typeof data === 'string') {
        try {
          const parsed = JSON.parse(data);
          displayResult = typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2);
        } catch (e) {
          displayResult = data;
        }
      } else {
        displayResult = JSON.stringify(data, null, 2);
      }

      // 结果为空时不展示
      if (isContentEmpty(displayResult)) {
        return {
          title: '工具执行结果',
          description: null,
        };
      }

      return {
        title: '工具执行结果',
        description: (
          <Typography.Text
            type="secondary"
            style={{ fontSize: '11px', display: 'block', whiteSpace: 'pre-wrap' }}
          >
            {displayResult}
          </Typography.Text>
        ),
      };
    },
    render: (part, key, { status }) => (
      <RenderThinkItem key={key} type="tool_output" part={part} status={status} expanded={true} />
    ),
  },

  chart_data: {
    isRoot: true,
    toPart: (seg) => ({
      type: 'chart',
      data: seg.text || seg.content || '',
      segmentId: seg.segmentId || seg.id,
    }),
    render: (part, key, { onAddChart, message, displayMode }) => (
      <div key={key} className="ai-seg ai-seg-chart" style={{ margin: '8px 0' }}>
        <ChartComponent
          data={part.data}
          onAddChart={onAddChart}
          message={message}
          segment={part._seg}
          displayMode={displayMode}
        />
      </div>
    ),
  },
};

/**
 * -----------------------------------------------------------------------------
 * 下方为 Markdown 内部使用的原子组件 (无需在顶层循环调用)
 * -----------------------------------------------------------------------------
 */

const ThinkComponent = React.memo(({ streamStatus, children }) => {
  const [title, setTitle] = React.useState('Deep thinking...');
  const [loading, setLoading] = React.useState(true);
  const [expand, setExpand] = React.useState(true);

  React.useEffect(() => {
    if (streamStatus === 'done') {
      setTitle('思考');
      setLoading(false);
      setExpand(true);
    }
  }, [streamStatus]);

  return (
    <Think title={title} loading={loading} expanded={expand} onClick={() => setExpand(!expand)}>
      {children}
    </Think>
  );
});

const ChartComponent = React.memo(
  ({ data: incomingData, onAddChart, message, segment, children, displayMode }) => {
    // 动态监听窗口尺寸，仅作为窄屏物理边界处理（备用/极端情况自适应）
    const [windowWidth, setWindowWidth] = React.useState(
      typeof window !== 'undefined' ? window.innerWidth : 1200,
    );

    React.useEffect(() => {
      if (typeof window === 'undefined') return;
      const handleResize = () => setWindowWidth(window.innerWidth);
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }, []);

    const raw = incomingData ?? children;
    let parsed = {};
    if (typeof raw === 'string') {
      try {
        parsed = JSON.parse(raw);
      } catch (err) {
        console.warn('ChartComponent data parse failed', err);
        parsed = { err: '图表数据解析失败' };
      }
    } else {
      parsed = raw || {};
    }

    let options = parsed;
    while (options && options.data && options.data !== options) {
      options = options.data;
    }
    const err = parsed.err;

    if (err) return <div className="ai-seg ai-seg-error">❗ 图表生成错误: {err}</div>;
    if (!options) return <div className="ai-seg ai-seg-text">无图表数据</div>;

    const chartType = options?.chartType || 'table';
    const isTable = chartType === 'table';

    // 核心自适应逻辑：根据 active displayMode 动态调整图表的宽度限制
    // 全屏模式时窗口很大，图表展示应该更宽、更从容（例如限制宽度为最大 700px 且最小 460px）；
    // 浮动窗口和侧边栏模式时比较窄，则限制为最大 100% 且最小 260px（极端情况下退化自适应）。
    const isFullscreen = displayMode === 'fullscreen';
    const minWidth = isFullscreen ? 460 : windowWidth < 320 ? '100%' : 260;
    const maxWidth = isFullscreen ? 700 : '100%';

    const wrapperStyle = {
      width: '100%',
      minWidth,
      maxWidth,
      position: 'relative',
    };

    const handleAdd = () => {
      if (!onAddChart) return;
      const resolvedSegment = segment || { type: 'chart_data', text: parsed };
      onAddChart(message, resolvedSegment);
    };

    const addButton = onAddChart && (
      <Button
        size="small"
        type="primary"
        icon={<PlusOutlined />}
        className="chart-add-btn"
        onClick={handleAdd}
      >
        添加
      </Button>
    );

    const resolvedDataSource = options.dataSource || [];
    const resolvedColumns = options.columns;

    if (chartType === 'table') {
      return (
        <div className="ai-seg ai-seg-chart" style={wrapperStyle}>
          {addButton}
          <Table
            rowKey={() => 'chart-table-row-' + Math.random()}
            columns={resolvedColumns}
            dataSource={resolvedDataSource}
            pagination={{ hideOnSinglePage: true }}
            scroll={{ x: 'max-content' }}
            size="small"
          />
        </div>
      );
    }

    // ECharts 图表：直接渲染标准的 ECharts options 对象
    const echartsOption = options.dataSource;

    return (
      <div className="ai-seg ai-seg-chart" style={wrapperStyle}>
        {addButton}
        <div style={{ height: 230, width: '100%', position: 'relative' }}>
          <EChartsComponent type={(chartType || 'bar').toLowerCase()} option={echartsOption} />
        </div>
      </div>
    );
  },
);

const IntentComponent = React.memo(({ children }) => {
  const intent = children || '未知意图';
  return <div className="ai-seg ai-seg-intent">{intent}</div>;
});

export const markdownComponents = {
  p: 'div',
  think: ThinkComponent,
  chart: ChartComponent,
  intent: IntentComponent,
};

/**
 * -----------------------------------------------------------------------------
 * 4. 转换与推理工具
 * -----------------------------------------------------------------------------
 */

/**
 * 智能推理片段状态
 *
 * @param seg 原始片段对象
 * @param idx 当前片段索引
 * @param total 片段总数
 * @param globalStatus 消息全局状态 (loading/success/error)
 */
function inferStatus(seg, idx, total, globalStatus = 'success') {
  // 1. 检查全局状态
  const s = String(globalStatus || '').toLowerCase();
  const isGlobalLoading = s === 'loading' || s === 'active' || s === 'streaming';

  // 对于 tool_call，即便输入参数已经生成完毕（seg.status === 'success'），
  // 只要没有对应的 toolOutput，说明该工具依然在执行中，仍应显示为 loading
  if (seg.type === 'tool_call' && !seg.toolOutput && isGlobalLoading) {
    return 'loading';
  }

  // 2. 如果片段本身已经是终态（成功或失败），直接返回
  if (seg.status === 'error' || seg.status === 'success') return seg.status;

  if (!isGlobalLoading) {
    return seg.status === 'loading' ? 'success' : seg.status || 'success';
  }

  // 4. 如果全局仍在加载，则只有最后一个片段显示为 loading
  const isLast = idx === total - 1;
  return isLast ? 'loading' : 'success';
}

/** 判断值是否为空（空对象、空字符串、仅空白） */
const isContentEmpty = (val) => {
  if (!val || (typeof val === 'string' && !val.trim())) return true;
  return val === '{}';
};

/** 格式化 tool_call 的描述内容，含输入参数和可选输出结果。输入/结果为空时不展示对应区域 */
const formatToolCallDescription = (displayArgs, toolOutput) => {
  const hasInput = !isContentEmpty(displayArgs);
  let hasOutput = false;
  let outputDisplay = null;

  if (toolOutput !== undefined && toolOutput !== null) {
    const raw = toolOutput;
    let outputStr;
    if (raw && typeof raw === 'object' && !Array.isArray(raw) && raw.result !== undefined) {
      // History DB: seg.content = { result, toolCallId }
      if (typeof raw.result === 'string') {
        try {
          const parsed = JSON.parse(raw.result);
          outputStr = typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2);
        } catch {
          outputStr = raw.result;
        }
      } else {
        outputStr = JSON.stringify(raw.result, null, 2);
      }
    } else if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        outputStr = typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2);
      } catch {
        outputStr = raw;
      }
    } else {
      outputStr = JSON.stringify(raw, null, 2);
    }

    hasOutput = !isContentEmpty(outputStr);
    if (hasOutput) {
      outputDisplay = (
        <>
          {hasInput && <div style={{ borderTop: '1px solid rgba(0,0,0,0.06)', margin: '6px 0' }} />}
          <Typography.Text
            type="secondary"
            style={{ fontSize: '11px', display: 'block', whiteSpace: 'pre-wrap' }}
          >
            执行结果: {outputStr}
          </Typography.Text>
        </>
      );
    }
  }

  if (!hasInput && !hasOutput) return null;

  return (
    <>
      {hasInput && (
        <Typography.Text
          type="secondary"
          style={{ fontSize: '11px', display: 'block', whiteSpace: 'pre-wrap' }}
        >
          输入参数: {displayArgs}
        </Typography.Text>
      )}
      {outputDisplay}
    </>
  );
};

/** 从 segment 中提取 toolCallId（兼容 SSE 内存 / DB 直读 / DB via API 三种来源） */
const getToolCallId = (seg) => {
  // DB via API: seg.text = content 对象（controller 将 content 映射到 text）{ id, name, args }
  if (seg.text?.id) return seg.text.id;
  // DB 直读: seg.content = { id, name, args }
  if (seg.content?.id) return seg.content.id;
  // SSE streaming: seg.id = toolCallId
  if (typeof seg.id === 'string' && seg.id) return seg.id;
  return null;
};

/** 从 tool_output segment 中提取匹配的 toolCallId */
const getOutputCallId = (seg) => {
  // DB via API: seg.text = { result, toolCallId }
  if (seg.text?.toolCallId) return seg.text.toolCallId;
  // DB 直读: seg.content = { toolCallId, result }
  if (seg.content?.toolCallId) return seg.content.toolCallId;
  // SSE streaming: seg.id = "toolCallId-result"
  if (typeof seg.id === 'string' && seg.id.endsWith('-result')) {
    return seg.id.replace(/-result$/, '');
  }
  return null;
};

/** 将 tool_output 合并到匹配的 tool_call 中，基于 toolCallId 关联 */
const mergeToolCallOutputs = (segments) => {
  const result = [];
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (seg.type !== 'tool_output') {
      result.push(seg);
      continue;
    }
    const outputCallId = getOutputCallId(seg);
    let merged = false;
    if (outputCallId) {
      for (let j = result.length - 1; j >= 0; j--) {
        if (result[j].type === 'tool_call' && getToolCallId(result[j]) === outputCallId) {
          const outputRaw =
            seg.text !== undefined && seg.text !== null ? seg.text : seg.content;
          result[j] = { ...result[j], toolOutput: outputRaw };
          merged = true;
          break;
        }
      }
    }
    if (!merged) {
      result.push(seg); // 未匹配则保留独立 tool_output
    }
  }
  return result;
};

const pushToThoughtsPart = (parts, item) => {
  const lastPart = parts[parts.length - 1];
  if (lastPart && lastPart.type === 'thoughts') {
    const existingIndex = lastPart.items.findIndex((it) => it.key === item.key);
    if (existingIndex > -1) {
      lastPart.items[existingIndex] = { ...lastPart.items[existingIndex], ...item };
    } else {
      lastPart.items.push(item);
    }
    lastPart.status = lastPart.items.some((it) => it.status === 'loading') ? 'loading' : 'success';
  } else {
    parts.push({
      type: 'thoughts',
      status: item.status || 'success',
      items: [item],
    });
  }
};

export function transformSegmentsToParts(segments = [], options = {}) {
  if (!Array.isArray(segments)) return [];
  const merged = mergeToolCallOutputs(segments);
  const parts = [];
  const total = merged.length;

  merged.forEach((seg, idx) => {
    const type = (seg.type || 'text').toLowerCase();
    const status = inferStatus(seg, idx, total, options.status);
    const key = seg.id || seg.segmentId || `${options.messageId || 'msg'}-seg-${idx}`;

    const config = SegmentUIMapping[type] || SegmentUIMapping.text;
    const partData = config.toPart(seg);

    const partWithMeta = {
      ...partData,
      status,
      key,
      _type: type,
      _seg: seg,
    };

    if (config.isRoot) {
      parts.push(partWithMeta);
    } else if (config.isThought) {
      pushToThoughtsPart(parts, { ...partWithMeta, key });
    }
  });

  return parts;
}
