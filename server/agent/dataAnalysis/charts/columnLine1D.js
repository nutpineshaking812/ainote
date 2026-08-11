/**
 * @fileoverview Generates aggregation stages for a 1D Column or Line Chart.
 */

/**
 * Builds the ECharts options object for a 1D column or line chart.
 * This is a helper function that constructs the final $project stage.
 * @param {object} task - The task object from the LLM.
 * @param {string} dimLabel - The label for the dimension (X-axis name).
 * @param {string} metLabel - The label for the metric (Y-axis name and series name).
 * @param {string} xAxisType - The ECharts type for the X-axis ('category', 'time', 'value').
 * @returns {object} The ECharts options configuration.
 */
function buildEChartsOptions(task, dimLabel, metLabel, xAxisType) {
  return {
    title: { text: task.title, left: 'center', top: '0' },
    tooltip: { trigger: 'axis' },
    legend: { data: [metLabel], bottom: '0' },
    xAxis: { type: xAxisType, name: dimLabel, data: '$xAxisData' },
    yAxis: { type: 'value', name: metLabel },
    series: [
      {
        name: metLabel,
        type: task.output_format === 'columnChart' ? 'bar' : 'line',
        data: '$seriesData',
      },
    ],
  };
}

/**
 * Generates the final aggregation stages for a 1D column or line chart.
 *
 * @param {object} task - The task object from the LLM.
 * @param {object} met - The metric object.
 * @param {string} xAxisType - The ECharts type for the X-axis.
 * @returns {object[]} An array of the final aggregation stages.
 */
export function generateColumnLine1D(task, met, xAxisType) {
  const dimLabel = task.dimensions[0].field;
  const metLabel = met.label;

  const stages = [
    { $sort: { [metLabel]: -1 } },
    // Group all documents into a single one to create the xAxis and series arrays
    {
      $group: {
        _id: null,
        xAxisData: { $push: '$_id' },
        seriesData: { $push: `$${metLabel}` },
      },
    },
    // Project the final ECharts options structure, wrapped in dataSource with chartType
    {
      $project: {
        chartType: task.output_format,
        dataSource: buildEChartsOptions(task, dimLabel, metLabel, xAxisType),
      },
    },
  ];

  return stages;
}
