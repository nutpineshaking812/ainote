import { z } from "zod";

/**
 * =============================================
 * 辅助函数: 构建多系列模板 (数据透视)
 * (例如: 2 维度, 1 指标)
 * =============================================
 * (此函数被 `execute` 内部调用, 保持其在工具定义之外或之内均可)
 */
function buildMultiSeriesTemplate(
  initialMatchStage,
  chart_type,
  PLACEHOLDERS,
  dynamic_metadata,
  dimensions,
  metrics,
  title
) {
  // 1. 验证元数据
  // 我们 *必须* 拥有第二个维度的唯一值才能构建查询
  const dim2Label = dimensions[1]; // e.g., "城市"
  const uniqueValues = dynamic_metadata?.dim_unique_values?.[dim2Label];

  if (!uniqueValues || uniqueValues.length === 0) {
    // 注意: 在真实的工具中, 应该抛出错误或返回一个
    // "需要用户提供更多信息" 的结构, 而不是一个查询。
    // 这里我们返回一个错误对象, LLM 应该能理解。
    return {
      error: `Multi-series chart requires unique values for dimension "${dim2Label}". Please ask user to provide them or use 'get_unique_values' tool.`
    };
  }

  // 2. Part A: 数据透视 (Pivot)
  const template_pipeline = [
    initialMatchStage,
    // (a) 按两个维度分组
    {
      $group: {
        _id: {
          dim1: `$data.${PLACEHOLDERS.DIM_FIELD_1}`, // e.g., "2024-01-01"
          dim2: `$data.${PLACEHOLDERS.DIM_FIELD_2}` // e.g., "北京"
        },
        value: PLACEHOLDERS.METRIC_AGG_1
      }
    },
    // (b) 数据透视: 按 dim1 分组, 将 dim2 转换为 k/v 对
    {
      $group: {
        _id: "$_id.dim1",
        seriesValues: {
          $push: {
            k: "$_id.dim2",
            v: "$value"
          }
        }
      }
    },
    // (c) 将 k/v 数组转换为对象: { "北京": 100, "上海": 120 }
    {
      $project: {
        _id: 1, // _id 是我们的 x 轴 (e.g., "2024-01-01")
        seriesObject: { $arrayToObject: "$seriesValues" }
      }
    },
    { $sort: { _id: 1 } }
    // (此时数据: [{_id: "2024-01-01", seriesObject: {"北京": 100, "上海": 120}}, ...])
  ];

  // 3. Part B: ECharts 结构重塑
  // --- 动态构建 Series 数组 ---
  const dynamicSeries = uniqueValues.map(value => {
    return {
      name: value,
      type: chart_type === "columnChart" ? "bar" : "line",
      stack: "total", // 堆叠
      data: {
        $map: {
          input: "$pivotedData",
          as: "item",
          in: { $ifNull: [`$$item.${value}`, 0] }
        }
      }
    };
  });

  template_pipeline.push(
    {
      $group: {
        _id: null,
        xAxisData: { $push: "$_id" },
        pivotedData: { $push: "$seriesObject" } // [ {"北京": 100}, {"上海": 150}, ... ]
      }
    },
    {
      $project: {
        _id: 0,
        title: { text: PLACEHOLDERS.TITLE, left: "center" },
        tooltip: { trigger: "axis" },
        legend: {
          data: uniqueValues // 关键: 从元数据中设置图例
        },
        grid: { left: "3%", right: "4%", bottom: "3%", containLabel: true },
        xAxis: {
          type: PLACEHOLDERS.DIM_AXIS_TYPE_1,
          name: PLACEHOLDERS.DIM_LABEL_1,
          data: "$xAxisData"
        },
        yAxis: {
          type: "value",
          name: PLACEHOLDERS.METRIC_LABEL_1
        },
        series: dynamicSeries // <-- 注入动态生成的 series
      }
    }
  );

  // 4. 占位符指南
  const placeholders = {
    [PLACEHOLDERS.FORM_ID]: "form_id",
    [PLACEHOLDERS.FILTERS]: "filters",
    [PLACEHOLDERS.TITLE]: "title",
    [PLACEHOLDERS.DIM_FIELD_1]: "dimensions[0].field_id",
    [PLACEHOLDERS.DIM_LABEL_1]: "dimensions[0].label",
    [PLACEHOLDERS.DIM_AXIS_TYPE_1]: "dimensions[0].chart_type",
    [PLACEHOLDERS.DIM_FIELD_2]: "dimensions[1].field_id",
    [PLACEHOLDERS.DIM_LABEL_1]: "dimensions[1].label",
    [PLACEHOLDERS.METRIC_AGG_1]: "metrics[0].aggregation",
    [PLACEHOLDERS.METRIC_LABEL_1]: "metrics[0].label"
  };

  return { template_pipeline, placeholders };
}

/**
 * ===================================================================
 * 工具定义: getChartQueryTemplateTool
 * ===================================================================
 */
export const getChartQueryTemplate = {
  name: "get_chart_query_template",
  inputSchema: z.object({
    chart_type: z
      .string()
      .describe(
        "图表类型, 必须是 'pieChart', 'columnChart', 'lineChart', 'wordCloud' 之一"
      ),
    dimensions: z
      .array(z.string())
      .describe(
        "维度的*标签*数组 (来自 State.dimensions), 例如 ['城市'] 或 ['日期', '城市']"
      ),
    metrics: z
      .array(z.string())
      .describe(
        "指标的*标签*数组 (来自 State.metrics), 例如 ['count()'] 或 ['销售额']"
      ),
    title: z.string().describe("图表的标题 (来自 State.title), 例如 '城市分布'"),
    dynamic_metadata: z
      .object({
        dim_unique_values: z
          .record(z.string(), z.array(z.string()))
          .optional()
          .describe(
            "可选, 但对于多系列图表(dimensions.length > 1)是*必须*的。键是维度标签, 值是该维度的唯一值数组。例如 {'城市': ['北京', '上海']}"
          )
      })
      .optional()
      .describe("可选的动态元数据")
  }),
  description:
    "当 State 状态为 'complete' 并且所有分析参数（图表类型、维度、指标、标题）都已收集完毕时，*必须*调用此工具。此工具是生成查询的最终步骤，它会返回一个 'MongoDB 聚合查询模板' 和 '占位符指南'，用于在数据库层面直接生成 ECharts Option。",
  execute: async ({
    chart_type,
    dimensions,
    metrics,
    title,
    dynamic_metadata = {}
  }, context) => {
    // --- 定义占位符 ---
    // 这些是 LLM 需要填充的 "槽位"
    const PLACEHOLDERS = {
      FORM_ID: "__FORM_ID__", // 将被替换为: State.form_id
      FILTERS: "__FILTERS__", // 将被替换为: LLM 构建的 $match filter 对象
      TITLE: "__TITLE__", // 将被替换为: State.title

      DIM_FIELD_1: "__DIMENSION_FIELD_1__", // 维度1的机器键
      DIM_LABEL_1: "__DIMENSION_LABEL_1__", // 维度1的人类标签
      DIM_AXIS_TYPE_1: "__DIM_AXIS_TYPE_1__", // 维度1的坐标轴类型

      DIM_FIELD_2: "__DIMENSION_FIELD_2__", // 维度2的机器键
      DIM_LABEL_2: "__DIMENSION_LABEL_2__", // 维度2的人类标签

      METRIC_AGG_1: "__METRIC_AGG_1__", // 指标1的聚合表达式
      METRIC_LABEL_1: "__METRIC_LABEL_1__" // 指标1的人类标签
    };

    let template_pipeline = [];
    let placeholders = {};

    // --- 基础 $match 阶段 ---
    const initialMatchStage = {
      $match: {
        form: { "$oid": PLACEHOLDERS.FORM_ID },
        // __FILTERS__ 占位符将由 LLM 填充
        // LLM 会根据 State.filters 和 "动态下拉" 规则来构建它
        // ...PLACEHOLDERS.FILTERS
      }
    };

    // --- 路由: 根据图表类型和维度/指标数量 ---
    switch (chart_type) {
      /**
       * =============================================
       * 案例 1: 饼图 / 词云 (1 维度, 1 指标)
       * =============================================
       */
      case "pieChart":
      case "wordCloud": {
        if (dimensions.length !== 1 || metrics.length !== 1) {
          throw new Error(
            `'${chart_type}' 必须有 1 个维度和 1 个指标。`
          );
        }

        // 1. Part A: 数据聚合
        template_pipeline = [
          initialMatchStage,
          {
            $group: {
              _id: `$data.${PLACEHOLDERS.DIM_FIELD_1}`,
              value: PLACEHOLDERS.METRIC_AGG_1
            }
          },
          {
            $project: {
              _id: 0,
              name: "$_id",
              value: "$value"
            }
          },
          { $sort: { value: -1 } }
        ];

        // 2. Part B: ECharts 结构重塑
        template_pipeline.push(
          {
            $group: {
              _id: null,
              seriesData: { $push: "$$ROOT" }
            }
          },
          {
            $project: {
              _id: 0,
              title: { text: PLACEHOLDERS.TITLE, left: "center" },
              tooltip: { trigger: "item" },
              legend: { show: true, orient: "vertical", left: "left" },
              series: [
                {
                  name: PLACEHOLDERS.DIM_LABEL_1,
                  type: chart_type === "pieChart" ? "pie" : "wordCloud",
                  radius: chart_type === "pieChart" ? "50%" : undefined,
                  data: "$seriesData"
                }
              ]
            }
          }
        );

        // 3. 占位符指南
        placeholders = {
          [PLACEHOLDERS.FORM_ID]: "form_id",
          [PLACEHOLDERS.FILTERS]: "filters", // LLM 需要构建完整的 $match filter
          [PLACEHOLDERS.TITLE]: "title",
          [PLACEHOLDERS.DIM_FIELD_1]: "dimensions[0].field_id",
          [PLACEHOLDERS.DIM_LABEL_1]: "dimensions[0].label",
          [PLACEHOLDERS.METRIC_AGG_1]: "metrics[0].aggregation" // LLM 负责翻译 (e.g., "count()" -> {"$sum": 1})
        };
        break;
      }

      /**
       * =============================================
       * 案例 2: 柱状图 / 折线图 (1 或 2 维度, 1 指标)
       * =============================================
       */
      case "columnChart":
      case "lineChart": {
        if (metrics.length !== 1) {
          throw new Error(
            `'${chart_type}' 必须有 1 个指标。`
          );
        }

        if (dimensions.length === 1) {
          // --- 单系列逻辑 ---
          // 1. Part A: 数据聚合
          template_pipeline = [
            initialMatchStage,
            {
              $group: {
                _id: `$data.${PLACEHOLDERS.DIM_FIELD_1}`,
                value: PLACEHOLDERS.METRIC_AGG_1
              }
            },
            { $sort: { _id: 1 } }
          ];

          // 2. Part B: ECharts 结构重塑
          template_pipeline.push(
            {
              $group: {
                _id: null,
                xAxisData: { $push: "$_id" },
                seriesData: { $push: "$value" }
              }
            },
            {
              $project: {
                _id: 0,
                title: { text: PLACEHOLDERS.TITLE, left: "center" },
                tooltip: { trigger: "axis" },
                toolbox: { show: true },
                // grid: { left: "3%", right: "4%", bottom: "3%", containLabel: true },
                xAxis: {
                  type: PLACEHOLDERS.DIM_AXIS_TYPE_1,
                  name: PLACEHOLDERS.DIM_LABEL_1,
                  data: "$xAxisData"
                },
                yAxis: {
                  type: "value",
                  name: PLACEHOLDERS.METRIC_LABEL_1
                },
                series: [
                  {
                    name: PLACEHOLDERS.METRIC_LABEL_1,
                    type: chart_type === "columnChart" ? "bar" : "line",
                    data: "$seriesData"
                  }
                ]
              }
            }
          );

          // 3. 占位符指南
          placeholders = {
            [PLACEHOLDERS.FORM_ID]: "form_id",
            [PLACEHOLDERS.FILTERS]: "filters",
            [PLACEHOLDERS.TITLE]: "title",
            [PLACEHOLDERS.DIM_FIELD_1]: "dimensions[0].field_id",
            [PLACEHOLDERS.DIM_LABEL_1]: "dimensions[0].label",
            [PLACEHOLDERS.DIM_AXIS_TYPE_1]: "dimensions[0].chart_type", // LLM 负责推断 'category' 或 'time'
            [PLACEHOLDERS.METRIC_AGG_1]: "metrics[0].aggregation",
            [PLACEHOLDERS.METRIC_LABEL_1]: "metrics[0].label"
          };
        } else if (dimensions.length === 2) {
          // --- 多系列逻辑 ---
          const multiSeriesResult = buildMultiSeriesTemplate(
            initialMatchStage,
            chart_type,
            PLACEHOLDERS,
            dynamic_metadata,
            dimensions,
            metrics,
            title
          );
          if (multiSeriesResult.error) {
            // 如果缺少元数据, 抛出错误, LLM 会看到这个错误
            throw new Error(multiSeriesResult.error);
          }
          template_pipeline = multiSeriesResult.template_pipeline;
          placeholders = multiSeriesResult.placeholders;
        } else {
          throw new Error(
            `'${chart_type}' 不支持 ${dimensions.length} 个维度。`
          );
        }
        break;
      }

      default:
        // 如果没有匹配的图表类型, 抛出错误
        throw new Error(
          `图表类型 "${chart_type}" 不被此工具支持。`
        );
    }

    // 成功, 返回模板和占位符指南
    return {
      template_pipeline,
      placeholders
    };
  }
};