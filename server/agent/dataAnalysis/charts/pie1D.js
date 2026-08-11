/**
 * @fileoverview Generates aggregation stages for a 1D Pie Chart.
 */

/**
 * Builds the ECharts options object for a 1D pie chart.
 * This is a helper function that constructs the final $project stage.
 * @param {object} task - The task object from the LLM.
 * @param {string} dimLabel - The label for the dimension (used as the series name).
 * @returns {object} The ECharts options configuration.
 */
function buildEChartsOptions(task, dimLabel) {
  return {
    title: { text: task.title, left: 'center', top: '0' },
    tooltip: { trigger: 'item' },
    legend: { show: true, orient: 'vertical', left: 'left' },
    series: [
      {
        name: dimLabel,
        type: 'pie',
        radius: '50%',
        data: '$seriesData',
      },
    ],
  };
}

/**
 * Generates the final aggregation stages for a 1D pie chart.
 *
 * @param {object} task - The task object from the LLM.
 * @param {object} met - The metric object.
 * @returns {object[]} An array of the final aggregation stages for the pie chart.
 */
export function generatePie1D(task, met) {
  const dimLabel = task.dimensions[0].field;
  const metLabel = met.label;

  const stages = [
    { $sort: { [metLabel]: -1 } },
    // Project into the { name, value } format required by ECharts pie series
    { $project: { _id: 1, name: '$_id', value: `$${metLabel}` } },
    // Group all documents into a single one to create the seriesData array
    { $group: { _id: null, seriesData: { $push: '$$ROOT' } } },
    // Project the final ECharts options structure, wrapped in dataSource with chartType
    {
      $project: {
        chartType: task.output_format,
        dataSource: buildEChartsOptions(task, dimLabel),
      },
    },
  ];

  return stages;
}
