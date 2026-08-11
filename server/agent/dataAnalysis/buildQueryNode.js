import { dispatchEvent } from '../../utils/langgraphUtils.js';
import { eventType } from './index.js';
import {
  extractStateJson,
  extractMongoQuery,
  extractQueryComponents,
  formatMongoQuery,
} from './extractUtils.js';

import { Translator } from './translator.js';

// 使用命名导入以获取真实函数 (默认导出是一个对象)
import { getSchemaByName, getDistinctValues } from '../../services/schemaService.js';

export const buildQueryNode = async (state) => {
  const task = state?.taskState?.task;
  if (!task) {
    console.warn('[buildQueryNode] 缺少 taskState.task');
    return { pipeline: [] };
  }
  if (typeof getSchemaByName !== 'function') {
    throw new Error('getSchemaByName 未正确导入');
  }
  const { pipeline, chartType } = await buildQuery(task, { getSchemaByName, getDistinctValues });
  return { pipeline, chartType };
};
import { generateColumnLine1D } from './charts/columnLine1D.js';
import { generatePie1D } from './charts/pie1D.js';
import { generatePivot2D } from './charts/pivot2D.js';
import { generateTable } from './charts/table.js';

/**
 * 主构建函数 (签名变更)
 * @param {object} task - LLM 输出的 task 对象
 * @param {object} tools - 包含所需异步工具的对象
 * @param {function(string): Promise<object>} tools.getSchemaByName
 * @param {function(string, string): Promise<string[]>} tools.getDistinctValues (新)
 * @returns {Promise<{pipeline: object[], chartType: string}>}
 */
async function buildQuery(task, { getSchemaByName, getDistinctValues }) {
  console.log('[buildQuery] task: ', task);
  const { mainFormName, translator } = await _initializeTranslator(task, getSchemaByName);

  // Refactored: Get both group-stage fields (potentially with temp keys) and final computed fields
  const { groupFields, finalFields, metricLabels } = _buildVirtualFields(task, translator);

  const { preFilters, midFilters, postFilters } = _separateFilters(
    task,
    translator,
    metricLabels,
    mainFormName,
  );
  const groupId = _buildGroupId(task, translator);

  const pipeline = _buildCorePipeline(
    task,
    translator,
    preFilters,
    midFilters,
    groupId,
    groupFields,
    finalFields,
    postFilters,
  );

  // --- 5. ECharts 格式化阶段 (重构后) ---
  let formattingStages = [];

  // Check dimensions and UNIQUE metric labels
  const uniqueMetricLabelsArr = Array.from(metricLabels);
  const is1D = task.dimensions?.length === 1 && uniqueMetricLabelsArr.length === 1;
  const is2D = task.dimensions?.length === 2 && uniqueMetricLabelsArr.length === 1;

  console.log(
    `[buildQuery] Output formatting stage: is1D=${is1D}, is2D=${is2D}, uniqueMetrics=${uniqueMetricLabelsArr.length}`,
  );

  if (is1D) {
    const dim = task.dimensions[0];
    // Construct a synthetic metric object for the formatter
    const finalLabel = uniqueMetricLabelsArr[0];
    const met = { label: finalLabel, agg: 'sum' }; // agg type is placeholder, label is key

    const xAxisType = translator.getChartType(dim.field, dim.source);

    // Optional: Map dimension values to labels if options are available
    const labelMappingStage = translator.getLabelMappingStage(dim, '$_id');
    if (labelMappingStage) {
      pipeline.push(labelMappingStage);
    }

    switch (task.output_format) {
      case 'columnChart':
      case 'lineChart':
        formattingStages = generateColumnLine1D(task, met, xAxisType);
        break;
      case 'pieChart':
        formattingStages = generatePie1D(task, met);
        break;
      default:
        // Pass a synthetic virtualFields map representing the final output for Table generation
        formattingStages = _generateTableWrapper(task, groupId, metricLabels, translator);
    }
  } else if (is2D) {
    // For 2D pivot, we need to ensure the data is shaped correctly.
    // generatePivot2D likely relies on task.metrics structure.
    // If we have combined metrics, pivot might need adjustment,
    // but for now we pass control.
    formattingStages = await generatePivot2D(task, translator, { getDistinctValues });
  } else {
    formattingStages = _generateTableWrapper(task, groupId, metricLabels, translator);
  }

  pipeline.push(...formattingStages);

  return { pipeline, chartType: task.output_format || 'table' };
}

// Helper to bridge the new virtualFields structure with generateTable
function _generateTableWrapper(task, groupId, metricLabels, translator) {
  // Construct a map that mimics the old virtualFields (Label -> Placeholder)
  // generateTable likely iterates keys.
  const syntheticVF = new Map();
  metricLabels.forEach((label) => syntheticVF.set(label, {}));
  const tableOutput = generateTable(task, groupId, syntheticVF, translator);
  return tableOutput.pipelineStages;
}

// ... _initializeTranslator stays same ...
async function _initializeTranslator(task, getSchemaByName) {
  if (!task || !task.data_source) {
    throw new Error("Task object invalid: Missing 'data_source'.");
  }
  const mainFormName = task.data_source;
  const translator = new Translator(mainFormName);
  try {
    await translator.init(task, getSchemaByName);
  } catch (error) {
    console.error(error.message);
    throw new Error(`Query build failed: ${error.message}`);
  }
  return { mainFormName, translator };
}

/**
 * Builds the map of virtual fields, handling duplicate labels by aggregating them.
 */
function _buildVirtualFields(task, translator) {
  const groupFields = new Map(); // Fields for the $group stage
  const finalFields = new Map(); // Fields for the $project stage (combining group fields)
  const metricLabels = new Set(); // Final set of visible metric labels

  if (task.metrics) {
    const labelComponents = new Map(); // Label -> [ {key, agg} ]

    // 1. First pass: Create group fields (handling duplicates)
    for (const [index, metric] of task.metrics.entries()) {
      let aggBSON;
      // ... (aggregation logic same as before) ...
      switch (metric.agg) {
        case 'count':
          aggBSON = { $sum: 1 };
          break;
        case 'sum':
        case 'avg':
        case 'max':
        case 'min':
          if (!metric.field || !metric.source) {
            throw new Error(`Metric "${metric.label}" missing "field" or "source"`);
          }
          const fieldPath = translator.getFieldPath(metric.field, metric.source);
          if (fieldPath === metric.field) {
            throw new Error(
              `Metric "${metric.label}" field "${metric.field}" (source: ${metric.source}) could not be translated.`,
            );
          }
          aggBSON = { [`$${metric.agg}`]: fieldPath };
          break;
        default:
          console.warn(`[buildQuery] Unknown aggregation operation: ${metric.agg}`);
          continue;
      }

      // Check for duplicates
      const isDuplicate = task.metrics.filter((m) => m.label === metric.label).length > 1;
      const groupKey = isDuplicate ? `__part_${index}_${metric.label}` : metric.label;

      groupFields.set(groupKey, aggBSON);

      if (!labelComponents.has(metric.label)) {
        labelComponents.set(metric.label, []);
      }
      labelComponents.get(metric.label).push({ key: groupKey, op: metric.agg });
      metricLabels.add(metric.label);
    }

    // 2. Second pass: Create projection fields for combining if necessary
    labelComponents.forEach((components, label) => {
      if (components.length > 1) {
        // Deduce combination operator based on the first component's aggregation
        // If they are sums, we sum them. If max, we max them.
        // If avg, reasonable default is avg(avgs).
        const opMap = {
          sum: '$add',
          count: '$add',
          max: '$max',
          min: '$min',
          avg: '$avg',
        };
        const baseOp = components[0].op;
        const mongoOp = opMap[baseOp] || '$add';

        finalFields.set(label, { [mongoOp]: components.map((c) => `$${c.key}`) });
      } else {
        // If key != label (which shouldn't happen for singletons logic above, but safety check)
        const comp = components[0];
        if (comp.key !== label) {
          finalFields.set(label, `$${comp.key}`);
        }
        // implied: if key == label, it's already there from group stage
      }
    });
  }
  return { groupFields, finalFields, metricLabels };
}

// ... _buildGroupId stays same ...
function _buildGroupId(task, translator) {
  if (!task.dimensions || task.dimensions.length === 0) {
    return null;
  }
  if (task.dimensions.length === 1) {
    const dim = task.dimensions[0];
    return translator.getFieldPath(dim.field, dim.source);
  }
  const groupByIdFields = {};
  for (const dim of task.dimensions) {
    const path = translator.getFieldPath(dim.field, dim.source);
    groupByIdFields[dim.field] = path;
  }
  return groupByIdFields;
}

function _separateFilters(task, translator, metricLabels, mainFormName) {
  const mainFormSchema = translator.schemasMap.get(mainFormName);
  if (!mainFormSchema) {
    throw new Error(
      `Build failed: Could not get main form Schema from translator: ${mainFormName}`,
    );
  }
  const preFilters = { form: mainFormSchema.id.toString() };
  const midFilters = {};
  const postFilters = {};
  if (task.filters) {
    for (const filter of task.filters) {
      const fieldLabel = filter.field;
      const mongoOp = { [filter.operator]: filter.value };
      const sourceForm = filter.source;

      // Check if it's a final metric label
      if (metricLabels.has(fieldLabel)) {
        postFilters[fieldLabel] = mongoOp;
      } else if (translator.physicalFields.get(sourceForm)?.has(fieldLabel)) {
        const matchPath = translator.getMatchPath(fieldLabel, sourceForm);
        if (sourceForm === mainFormName) {
          preFilters[matchPath] = mongoOp;
        } else {
          midFilters[matchPath] = mongoOp;
        }
      } else {
        console.warn(
          `[buildQuery] Unrecognized filter field: "${fieldLabel}" (source: ${sourceForm}). Ignored.`,
        );
      }
    }
  }
  return { preFilters, midFilters, postFilters };
}

function _buildCorePipeline(
  task,
  translator,
  preFilters,
  midFilters,
  groupId,
  groupFields,
  finalFields,
  postFilters,
) {
  const pipeline = [];
  pipeline.push({ $match: preFilters });
  if (task.joins) {
    for (const join of task.joins) {
      const fromSchema = translator.schemasMap.get(join.source_form);
      const toSchema = translator.schemasMap.get(join.link_form);
      if (!fromSchema || !toSchema) {
        console.warn(
          `[buildQuery] $lookup failed: Missing Schema "${join.source_form}" or "${join.link_form}"`,
        );
        continue;
      }
      const lookupCollection = 'formrecords';
      const localFieldPath = translator.getMatchPath(join.from_field, join.source_form);
      const foreignFieldKey = translator.getMachineKey(join.to_field, join.link_form);
      if (!foreignFieldKey) {
        console.warn(
          `[buildQuery] $lookup failed: Could not find machine key for "to_field" in "${join.link_form}": "${join.to_field}"`,
        );
        continue;
      }
      const foreignFieldPath = `data.${foreignFieldKey}`;
      const asName = `joined_${join.link_form}`;
      pipeline.push({
        $lookup: {
          from: lookupCollection,
          let: { localJoinField: `$${localFieldPath}` },
          pipeline: [
            {
              $match: {
                form: toSchema.id.toString(),
                $expr: { $eq: [`$${foreignFieldPath}`, '$$localJoinField'] },
              },
            },
          ],
          as: asName,
        },
      });
      pipeline.push({
        $unwind: { path: `$${asName}`, preserveNullAndEmptyArrays: true },
      });
    }
  }
  if (Object.keys(midFilters).length > 0) {
    pipeline.push({ $match: midFilters });
  }

  // 1. Group Stage
  const groupStage = { _id: groupId };
  groupFields.forEach((aggBSON, label) => {
    groupStage[label] = aggBSON;
  });
  pipeline.push({ $group: groupStage });

  // 2. Projection (Add Fields) Stage for combined metrics
  if (finalFields.size > 0) {
    const addFieldsStage = {};
    finalFields.forEach((expr, label) => {
      addFieldsStage[label] = expr;
    });
    pipeline.push({ $addFields: addFieldsStage });
  }

  // 3. Post Filter Stage
  if (Object.keys(postFilters).length > 0) {
    pipeline.push({ $match: postFilters });
  }
  return pipeline;
}
