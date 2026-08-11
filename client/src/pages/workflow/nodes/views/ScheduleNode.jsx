import React from 'react';
import { Tag } from 'antd';
import { ClockCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { getScheduleSummary } from '../../utils/cron';
import BaseNodeLayout from './BaseNodeLayout';

const ScheduleNode = (props) => {
  const { data, id } = props;
  const { t } = useTranslation();

  return (
    <BaseNodeLayout
      {...props}
      id={id}
      icon={<ClockCircleOutlined />}
      color="#52c41a"
      title={t('workflow.nodes.schedule.title')}
      subtitle={getScheduleSummary(data, t)}
      hideLeftHandle={true}
    >
      <div style={{ marginTop: 8 }}>
        <Tag
          color="green"
          style={{ fontSize: '10px', borderRadius: '4px', fontFamily: 'monospace' }}
        >
          {data.cron || 'Scheduled'}
        </Tag>
      </div>
    </BaseNodeLayout>
  );
};

export default ScheduleNode;
