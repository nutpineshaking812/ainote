/**
 * @fileoverview Generates aggregation stages for a 2D Pivot Chart (Column or Line).
 */

/**
 * Builds the ECharts options object for a 2D pivot chart.
 * @param {object} task - The task object from the LLM.
 * @param {object} dim1 - The first dimension object (X-axis).
 * @param {object} met1 - The metric object (Y-axis).
 * @param {string[]} uniqueLabels - The unique labels for the second dimension (series).
 * @param {object} translator - The Translator instance.
 * @returns {object} The ECharts options configuration.
 */
function buildEChartsOptions(task, dim1, met1, uniqueLabels, translator) {
  // Dynamically build the 'series' array for the $project stage
  const dynamicSeries = uniqueLabels.map((value) => {
    return {
      name: value,
      type: task.output_format === 'columnChart' ? 'bar' : 'line',
      stack: 'total', // Default to stacked charts
      data: {
        $map: {
          input: '$pivotedData',
          as: 'item',
          in: { $ifNull: [`$$item.${value}`, 0] },
        },
      },
    };
  });

  return {
    _id: 0,
    title: { text: task.title, left: 'center', top: '0' },
    tooltip: { trigger: 'axis' },
    legend: {
      data: uniqueLabels,
      bottom: '0',
    },
    xAxis: {
      type: translator.getChartType(dim1.field, dim1.source),
      name: dim1.field,
      data: '$xAxisData',
    },
    yAxis: {
      type: 'value',
      name: met1.label,
    },
    series: dynamicSeries,
  };
}

/**
 * Generates the final aggregation stages for a 2D pivot chart.
 * This function is async as it needs to fetch distinct values for the second dimension.
 *
 * @param {object} task - The task object from the LLM.
 * @param {object} translator - The Translator instance.
 * @param {object} tools - An object containing required utilities.
 * @param {function} tools.getDistinctValues - Function to fetch distinct values for a field.
 * @returns {Promise<object[]>} A promise that resolves to an array of the final aggregation stages.
 */
export async function generatePivot2D(task, translator, { getDistinctValues }) {
  const dim1 = task.dimensions[0]; // X-Axis (e.g., "日期")
  const dim2 = task.dimensions[1]; // Legend/Series (e.g., "城市")
  const met1 = task.metrics[0]; // Y-Axis (e.g., "获奖次数")

  // 1. Get unique values for the second dimension (the series)
  if (!getDistinctValues) {
    throw new Error("2D analysis failed: 'getDistinctValues' tool was not provided.");
  }
  const dim2Schema = translator.schemasMap.get(dim2.source);
  const dim2Key = translator.getMachineKey(dim2.field, dim2.source);
  if (!dim2Schema || !dim2Key) {
    throw new Error(
      `2D analysis failed: Could not translate dimension2 "${dim2.field}" from source "${dim2.source}"`,
    );
  }

  const uniqueValues = await getDistinctValues(dim2Schema._id, dim2Key);
  if (!uniqueValues || uniqueValues.length === 0) {
    console.warn(
      `2D analysis: No unique values found for "${dim2.field}". The chart may be empty.`,
    );
  }

  // 2. Translate unique values to labels if options are available
  let uniqueLabels = uniqueValues;
  let mapValuesStage = null;

  const dim2LabelMappingStage = translator.getLabelMappingStage(dim2, '$_id.' + dim2.field);
  if (dim2LabelMappingStage) {
    mapValuesStage = {
      $addFields: {
        _id: {
          [dim1.field]: '$_id.' + dim1.field, // Preserve dim1 field
          [dim2.field]: dim2LabelMappingStage.$addFields['$_id.' + dim2.field], // Use the switch from the generated stage
        },
      },
    };
    // Also update uniqueLabels based on the options if mapping is applied
    const dim2Options = translator.optionsMaps.get(dim2.source)?.get(dim2.field);
    if (dim2Options && Array.isArray(dim2Options)) {
      const valueToLabelMap = new Map(dim2Options.map((opt) => [opt.value, opt.label]));
      uniqueLabels = uniqueValues.map((val) => valueToLabelMap.get(val) || val);
    }
  }

  const pipeline = [];

  // 3. Add the value mapping stage if needed
  if (mapValuesStage) {
    pipeline.push(mapValuesStage);
  }

  // 4. Add pivot and final formatting stages
  pipeline.push(
    {
      $group: {
        _id: '$_id.' + dim1.field,
        seriesValues: {
          $push: {
            k: '$_id.' + dim2.field,
            v: `$${met1.label}`,
          },
        },
      },
    },
    {
      $project: {
        _id: 1,
        seriesObject: { $arrayToObject: '$seriesValues' },
      },
    },
    { $sort: { _id: 1 } },
    {
      $group: {
        _id: null,
        xAxisData: { $push: '$_id' },
        pivotedData: { $push: '$seriesObject' },
      },
    },
    {
      $project: {
        _id: 0,
        chartType: task.output_format,
        dataSource: buildEChartsOptions(task, dim1, met1, uniqueLabels || [], translator),
      },
    },
  );

  return pipeline;
}
