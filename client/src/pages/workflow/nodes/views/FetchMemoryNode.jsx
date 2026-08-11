import React from 'react';
import { useTranslation } from 'react-i18next';
import { HistoryOutlined } from '@ant-design/icons';
import AddonNodeLayout from './AddonNodeLayout';

const FetchMemoryNode = ({ data, selected, onOpenSettings, id }) => {
  const { t } = useTranslation();

  return (
    <AddonNodeLayout
      data={data}
      selected={selected}
      onOpenSettings={onOpenSettings}
      id={id}
      icon={<HistoryOutlined />}
      primaryColor="#52c41a"
      title={data.label || t('workflow.nodes.fetchMemory.title', 'Fetch Memory')}
      subtitle={t('workflow.nodes.fetchMemory.type', 'Memory Source')}
    />
  );
};

export default FetchMemoryNode;
