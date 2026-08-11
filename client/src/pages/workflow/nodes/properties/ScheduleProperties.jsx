import React, { useMemo } from 'react';
import {
  Form,
  Select,
  TimePicker,
  Input,
  InputNumber,
  DatePicker,
  Segmented,
  Card,
  Typography,
  Space,
  Divider,
} from 'antd';
import { useTranslation } from 'react-i18next';
import {
  ClockCircleOutlined,
  CalendarOutlined,
  SyncOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import NodePropertyCollapse from './NodePropertyCollapse';
import SchemaConfigList from './SchemaConfigList';

const { Text } = Typography;

const ScheduleProperties = ({ node, setNodes }) => {
  const { t } = useTranslation();

  // Normalize data for Ant Design form (strings/dates to dayjs)
  const normalizedNode = useMemo(() => {
    const data = { ...node.data };
    if (data.time && typeof data.time === 'string') {
      data.time = dayjs(data.time, 'HH:mm');
    }
    if (
      data.specificTime &&
      (typeof data.specificTime === 'string' || data.specificTime instanceof Date)
    ) {
      data.specificTime = dayjs(data.specificTime);
    }
    return { ...node, data };
  }, [node]);

  const handleValuesChange = (allValues, updateNodes) => {
    let normalizedValues = { ...allValues };

    if (allValues.scheduleMode && allValues.scheduleMode !== 'advanced') {
      if (['daily', 'weekly', 'monthly'].includes(allValues.scheduleMode)) {
        const time = allValues.time ? dayjs(allValues.time) : dayjs();
        const min = time.minute();
        const hour = time.hour();

        let cron = `${min} ${hour} * * *`;
        if (allValues.scheduleMode === 'weekly') {
          cron = `${min} ${hour} * * ${allValues.dayOfWeek || '*'}`;
        } else if (allValues.scheduleMode === 'monthly') {
          cron = `${min} ${hour} ${allValues.dayOfMonth || '*'} * *`;
        }
        normalizedValues.cron = cron;
        normalizedValues.time = time.format('HH:mm');
      }
    } else if (allValues.time) {
      normalizedValues.time = dayjs(allValues.time).format('HH:mm');
    }
    updateNodes(normalizedValues);
  };

  const renderSummary = (values) => {
    const { scheduleMode, time, dayOfWeek, dayOfMonth, intervalValue, intervalUnit, specificTime } =
      values;
    let text = '';
    const timeStr = time ? dayjs(time).format('HH:mm') : '--:--';

    switch (scheduleMode) {
      case 'daily':
        text = t('workflow.designer.summaryDaily', { time: timeStr });
        break;
      case 'weekly':
        const dayLabel =
          [
            t('common.sunday'),
            t('common.monday'),
            t('common.tuesday'),
            t('common.wednesday'),
            t('common.thursday'),
            t('common.friday'),
            t('common.saturday'),
          ][dayOfWeek] || '';
        text = t('workflow.designer.summaryWeekly', { day: dayLabel, time: timeStr });
        break;
      case 'monthly':
        text = t('workflow.designer.summaryMonthly', { day: dayOfMonth, time: timeStr });
        break;
      case 'interval':
        text = t('workflow.designer.summaryInterval', { value: intervalValue, unit: intervalUnit });
        break;
      case 'once':
        text = t('workflow.designer.summaryOnce', {
          time: specificTime ? dayjs(specificTime).format('YYYY-MM-DD HH:mm') : '...',
        });
        break;
      case 'advanced':
        text = t('workflow.designer.summaryAdvanced');
        break;
      default:
        text = '';
    }

    return (
      <Card
        size="small"
        style={{
          background: '#f9f9f9',
          border: '1px dashed #d9d9d9',
          borderRadius: 8,
          marginBottom: 20,
        }}
        bodyStyle={{ padding: '12px 16px' }}
      >
        <Space align="start">
          {/* <SyncOutlined style={{ color: '#1677ff', marginTop: 4 }} /> */}
          <div>
            <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 2 }}>
              {t('workflow.designer.executionPlan', 'Execution Plan')}
            </div>
            <Text strong style={{ fontSize: 14 }}>
              {text || t('common.notConfigured', 'Not Configured')}
            </Text>
          </div>
        </Space>
      </Card>
    );
  };

  return (
    <NodePropertyCollapse
      node={normalizedNode}
      setNodes={setNodes}
      onValuesChange={handleValuesChange}
      hideOutput
    >
      <Form.Item noStyle shouldUpdate>
        {(form) => renderSummary(form.getFieldsValue())}
      </Form.Item>

      <Form.Item
        label={t('workflow.designer.scheduleFrequency')}
        name="scheduleMode"
        initialValue="daily"
      >
        <Select
          size="large"
          suffixIcon={<CalendarOutlined />}
          options={[
            {
              label: (
                <Space>
                  <ClockCircleOutlined />
                  {t('workflow.designer.daily')}
                </Space>
              ),
              value: 'daily',
            },
            {
              label: (
                <Space>
                  <CalendarOutlined />
                  {t('workflow.designer.weekly')}
                </Space>
              ),
              value: 'weekly',
            },
            {
              label: (
                <Space>
                  <CalendarOutlined />
                  {t('workflow.designer.monthly')}
                </Space>
              ),
              value: 'monthly',
            },
            {
              label: (
                <Space>
                  <SyncOutlined />
                  {t('workflow.designer.interval')}
                </Space>
              ),
              value: 'interval',
            },
            {
              label: (
                <Space>
                  <ClockCircleOutlined />
                  {t('workflow.designer.once')}
                </Space>
              ),
              value: 'once',
            },
            {
              label: (
                <Space>
                  <SettingOutlined />
                  {t('workflow.designer.advanced')}
                </Space>
              ),
              value: 'advanced',
            },
          ]}
        />
      </Form.Item>

      <Divider style={{ margin: '12px 0 24px' }} />

      <Form.Item noStyle shouldUpdate={(prev, curr) => prev.scheduleMode !== curr.scheduleMode}>
        {({ getFieldValue }) => {
          const scheduleMode = getFieldValue('scheduleMode');

          return (
            <div style={{ padding: '0 4px' }}>
              {scheduleMode === 'interval' && (
                <Space direction="vertical" style={{ width: '100%' }} size={16}>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <Form.Item
                      label={t('workflow.designer.intervalValue', 'Every')}
                      name="intervalValue"
                      style={{ flex: 1, marginBottom: 0 }}
                      initialValue={10}
                    >
                      <InputNumber min={1} style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item
                      label={t('workflow.designer.intervalUnit', 'Unit')}
                      name="intervalUnit"
                      style={{ flex: 1, marginBottom: 0 }}
                      initialValue="minutes"
                    >
                      <Select
                        options={[
                          { label: t('common.seconds', 'Seconds'), value: 'seconds' },
                          { label: t('common.minutes', 'Minutes'), value: 'minutes' },
                          { label: t('common.hours', 'Hours'), value: 'hours' },
                        ]}
                      />
                    </Form.Item>
                  </div>
                </Space>
              )}

              {scheduleMode === 'once' && (
                <Form.Item
                  label={t('workflow.designer.specificTime', 'Run At')}
                  name="specificTime"
                >
                  <DatePicker showTime format="YYYY-MM-DD HH:mm" style={{ width: '100%' }} />
                </Form.Item>
              )}

              {scheduleMode === 'weekly' && (
                <Form.Item label={t('workflow.designer.dayOfWeek')} name="dayOfWeek">
                  <Select
                    placeholder={t('workflow.designer.selectDay', 'Select Day')}
                    options={[
                      { label: t('common.sunday', 'Sunday'), value: '0' },
                      { label: t('common.monday', 'Monday'), value: '1' },
                      { label: t('common.tuesday', 'Tuesday'), value: '2' },
                      { label: t('common.wednesday', 'Wednesday'), value: '3' },
                      { label: t('common.thursday', 'Thursday'), value: '4' },
                      { label: t('common.friday', 'Friday'), value: '5' },
                      { label: t('common.saturday', 'Saturday'), value: '6' },
                    ]}
                  />
                </Form.Item>
              )}

              {scheduleMode === 'monthly' && (
                <Form.Item label={t('workflow.designer.dayOfMonth')} name="dayOfMonth">
                  <Select
                    placeholder={t('workflow.designer.selectDate', 'Select Date')}
                    options={Array.from({ length: 31 }, (_, i) => ({
                      label: `${i + 1}${t('common.daySuffix', ' 日')}`,
                      value: `${i + 1}`,
                    }))}
                  />
                </Form.Item>
              )}

              {['daily', 'weekly', 'monthly'].includes(scheduleMode) && (
                <Form.Item label={t('workflow.designer.executionTime')} name="time">
                  <TimePicker format="HH:mm" style={{ width: '100%' }} />
                </Form.Item>
              )}

              {scheduleMode === 'advanced' && (
                <Form.Item
                  label={t('workflow.designer.cronExpression')}
                  name="cron"
                  extra={t(
                    'workflow.designer.cronExtra',
                    'Standard 5-digit cron: min hour day month dow',
                  )}
                >
                  <Input placeholder="0 9 * * *" />
                </Form.Item>
              )}
            </div>
          );
        }}
      </Form.Item>

      <SchemaConfigList
        mode="input"
        label="输入定义 (Input Schema)"
        node={node}
        setNodes={setNodes}
      />
    </NodePropertyCollapse>
  );
};

export default ScheduleProperties;
