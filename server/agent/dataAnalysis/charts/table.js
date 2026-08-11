/**
 * @fileoverview Generates the final aggregation stage for displaying data in a table format.
 * This is typically used as a fallback when the query does not match specific 1D or 2D chart criteria.
 */

/**
 * Generates an $addFields stage to map field values to their labels if options are available.
 * @param {object} task - The task object from the LLM.
 * @param {Translator} translator - The Translator instance.
 * @returns {object|null} An $addFields stage object or null if no fields require mapping.
 */
function _generateValueToLabelMappingStage(task, translator) {
  const addFields = {};

  // Check dimensions
  if (task.dimensions) {
    task.dimensions.forEach(dim => {
      const dimOptions = translator.optionsMaps.get(dim.source)?.get(dim.field);
      if (dimOptions && Array.isArray(dimOptions) && dimOptions.length > 0) {
        const branches = dimOptions.map(opt => ({
          case: { $eq: [`$${dim.field}`, opt.value] },
          then: opt.label,
        }));
        addFields[dim.field] = { $switch: { branches: branches, default: `$${dim.field}` } };
      }
    });
  }

  // Check metrics (if they are categorical and have options, though less common)
  if (task.metrics) {
    task.metrics.forEach(met => {
      const metOptions = translator.optionsMaps.get(met.source)?.get(met.field);
      if (metOptions && Array.isArray(metOptions) && metOptions.length > 0) {
        const branches = metOptions.map(opt => ({
          case: { $eq: [`$${met.label}`, opt.value] }, // Use met.label as dataIndex
          then: opt.label,
        }));
        addFields[met.label] = { $switch: { branches: branches, default: `$${met.label}` } };
      }
    });
  }

  return Object.keys(addFields).length > 0 ? { $addFields: addFields } : null;
}

/**
 * Builds the final $project stage for a generic table output and returns column metadata.
 *
 * @param {object} task - The task object from the LLM.
 * @param {object|string|null} groupId - The structure of the _id field from the main $group stage.
 * @param {Map<string, object>} virtualFields - A map of metric labels to their aggregation BSON.
 * @param {Translator} translator - The Translator instance for getting friendly titles.
 * @returns {{pipelineStages: object[], columnsMeta: object[]}} An object containing the final $project aggregation stage and column metadata.
 */
export function generateTable(task, groupId, virtualFields, translator) {
  console.warn(`[generateTable] Using generic table format (dimensions: ${task.dimensions?.length || 0})`);

  const initialProjectStage = { _id: 0 };
  const columnsMeta = [];

  if (groupId === null) {
    // Case: 0 dimensions (e.g., "show me total sales")
    task.metrics.forEach(met => {
      initialProjectStage[met.label] = `$${met.label}`;
      columnsMeta.push({ dataIndex: met.label, title: translator.getFriendlyFieldTitle(met.field, met.source) });
    });
  } else if (task.dimensions && task.dimensions.length === 1) {
    // Case: 1 dimension
    const dim = task.dimensions[0];
    initialProjectStage[dim.field] = '$_id';
    columnsMeta.push({ dataIndex: dim.field, title: translator.getFriendlyFieldTitle(dim.field, dim.source) });
    task.metrics.forEach(met => {
      initialProjectStage[met.label] = `$${met.label}`;
      columnsMeta.push({ dataIndex: met.label, title: translator.getFriendlyFieldTitle(met.field, met.source) });
    });
  } else {
    // Case: 2+ dimensions
    if (task.dimensions) {
      task.dimensions.forEach(dim => {
        initialProjectStage[dim.field] = `$_id.${dim.field}`;
        columnsMeta.push({ dataIndex: dim.field, title: translator.getFriendlyFieldTitle(dim.field, dim.source) });
      });
    }
    task.metrics.forEach(met => {
      initialProjectStage[met.label] = `$${met.label}`;
      columnsMeta.push({ dataIndex: met.label, title: translator.getFriendlyFieldTitle(met.field, met.source) });
    });
  }

  const pipelineStages = [
    // Stage 1: Initial projection to shape each row
    { $project: initialProjectStage },
  ];

  // Add value-to-label mapping stage if needed
  const valueToLabelMappingStage = _generateValueToLabelMappingStage(task, translator);
  if (valueToLabelMappingStage) {
    pipelineStages.push(valueToLabelMappingStage);
  }

  pipelineStages.push(
    // Stage 2: Group all rows into a single array
    {
      $group: {
        _id: null,
        dataSource: { $push: "$$ROOT" }
      }
    },
    // Stage 3: Final projection to combine dataSource and columnsMeta
    {
      $project: {
        _id: 0,
        chartType: "table",
        dataSource: "$dataSource",
        columns: columnsMeta // columnsMeta is available in this scope
      }
    }
  );

  return {
    pipelineStages: pipelineStages,
    columnsMeta: columnsMeta, // Still return columnsMeta separately for buildQueryNode's return value
  };
}
