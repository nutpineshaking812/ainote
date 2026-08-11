import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import EChartsComponent, { createChartOption } from '../components/chart/EChartsComponent';
import { Row, Col, Card, Select, Button, Space } from 'antd';

/**
 * EChartsComponent 演示页面
 */
const EChartsDemo = () => {
  const { t } = useTranslation();
  const [chartType, setChartType] = useState('bar');
  const [loading, setLoading] = useState(false);

  // 示例数据
  const mockData = {
    xAxis: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
    yAxis: ['阿里云', '腾讯云', '华为云'],
    legend: ['销售额', '用户数', '转化率'],
    series: [
      { name: '销售额', data: [120, 200, 150, 80, 70, 110, 130] },
      { name: '用户数', data: [200, 150, 250, 180, 220, 150, 170] },
      { name: '转化率', data: [12, 21, 29, 26, 35, 27, 33] },
    ],
    pieData: [
      { value: 1048, name: '搜索引擎' },
      { value: 735, name: '直接访问' },
      { value: 580, name: '邮件营销' },
      { value: 484, name: '联盟广告' },
      { value: 300, name: '视频广告' },
    ],
    radarIndicator: [
      { name: '销售', max: 6500 },
      { name: '市场', max: 16000 },
      { name: '开发', max: 30000 },
      { name: '客户支持', max: 38000 },
      { name: '体验', max: 52000 },
      { name: '运维', max: 25000 },
    ],
    radarData: [{ name: '预算分配', value: [4200, 3000, 20000, 35000, 50000, 18000] }],
    wordData: [
      { name: 'React', value: 9000 },
      { name: 'Vue', value: 8000 },
      { name: 'Angular', value: 7000 },
      { name: 'Svelte', value: 5000 },
      { name: 'TypeScript', value: 8500 },
      { name: 'JavaScript', value: 9500 },
      { name: 'Python', value: 7500 },
      { name: 'Java', value: 8200 },
      { name: 'Node.js', value: 8800 },
      { name: 'Express', value: 6500 },
    ],
    heatmapData: Array.from({ length: 168 }, (_, i) => [
      i % 7,
      Math.floor(i / 7),
      Math.floor(Math.random() * 100),
    ]),
  };

  const getChartOption = () => {
    switch (chartType) {
      case 'bar':
        return createChartOption('bar', {
          xAxis: mockData.xAxis,
          legend: ['销售额'],
          series: [{ name: '销售额', data: mockData.series[0].data }],
        });
      case 'line':
        return createChartOption('line', {
          xAxis: mockData.xAxis,
          legend: mockData.legend,
          series: mockData.series,
        });
      case 'pie':
        return createChartOption('pie', {
          legend: mockData.pieData.map((d) => d.name),
          pieData: mockData.pieData,
        });
      case 'radar':
        return createChartOption('radar', {
          legend: ['预算分配'],
          radarIndicator: mockData.radarIndicator,
          series: mockData.radarData,
        });
      case 'gauge':
        return createChartOption('gauge', { value: 75, name: '系统健康度' });
      case 'scatter':
        return createChartOption('scatter', {
          series: [
            {
              name: '散点数据',
              data: Array.from({ length: 50 }, () => [Math.random() * 100, Math.random() * 100]),
            },
          ],
        });
      case 'heatmap':
        return createChartOption('heatmap', {
          xAxis: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
          yAxis: Array.from({ length: 24 }, (_, i) => `${i}:00`),
          heatmapData: mockData.heatmapData,
        });
      case 'wordcloud':
        return createChartOption('wordcloud', { wordData: mockData.wordData });
      default:
        return {};
    }
  };

  const handleRefresh = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 1000);
  };

  return (
    <div style={{ padding: '20px', background: '#f0f2f5', minHeight: '100vh' }}>
      <Card title={t('echartsDemo.title')} style={{ marginBottom: '20px' }}>
        <Space>
          <span>{t('echartsDemo.selectChartType')}</span>
          <Select
            value={chartType}
            onChange={setChartType}
            style={{ width: 200 }}
            options={[
              { label: t('echartsDemo.bar'), value: 'bar' },
              { label: t('echartsDemo.line'), value: 'line' },
              { label: t('echartsDemo.pie'), value: 'pie' },
              { label: t('echartsDemo.radar'), value: 'radar' },
              { label: t('echartsDemo.gauge'), value: 'gauge' },
              { label: t('echartsDemo.scatter'), value: 'scatter' },
              { label: t('echartsDemo.heatmap'), value: 'heatmap' },
              { label: t('echartsDemo.wordcloud'), value: 'wordcloud' },
            ]}
          />
          <Button onClick={handleRefresh} loading={loading}>
            {t('echartsDemo.refresh')}
          </Button>
        </Space>
      </Card>

      <Row gutter={[20, 20]}>
        <Col span={24}>
          <Card title={t('echartsDemo.chartExample', { chartType: chartType.toUpperCase() })}>
            <EChartsComponent
              type={chartType}
              option={getChartOption()}
              loading={loading}
              height={500}
            />
          </Card>
        </Col>
      </Row>

      <Card title={t('echartsDemo.usageGuide')} style={{ marginTop: '20px' }}>
        <pre style={{ background: '#f5f5f5', padding: '10px', borderRadius: '4px' }}>
          {`// 基础用法
import EChartsComponent, { createChartOption } from '@/components/EChartsComponent';

// 方式1：使用辅助函数创建配置
const option = createChartOption('bar', {
  xAxis: ['周一', '周二', '周三'],
  legend: ['销售额'],
  series: [{ name: '销售额', data: [120, 200, 150] }]
});

<EChartsComponent
  type="bar"
  option={option}
  title="销售数据"
  height={400}
  loading={false}
/>

// 方式2：自定义 ECharts 配置
const customOption = {
  xAxis: { type: 'category', data: ['A', 'B', 'C'] },
  yAxis: { type: 'value' },
  series: [{ data: [10, 20, 30], type: 'bar' }]
};

<EChartsComponent
  type="bar"
  option={customOption}
  title="自定义图表"
  height={400}
/>

// 支持的图表类型
- 'bar'      : 柱状图
- 'line'     : 折线图
- 'pie'      : 饼图
- 'radar'    : 雷达图
- 'gauge'    : 仪表盘
- 'scatter'  : 散点图
- 'heatmap'  : 热力图
- 'wordcloud': 词云图
`}
        </pre>
      </Card>
    </div>
  );
};

export default EChartsDemo;
