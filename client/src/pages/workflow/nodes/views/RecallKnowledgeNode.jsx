import React from 'react';
import { useTranslation } from 'react-i18next';
import { DatabaseOutlined } from '@ant-design/icons';
import AddonNodeLayout from './AddonNodeLayout';

const RecallKnowledgeNode = ({ data, selected, onOpenSettings, id }) => {
  const { t } = useTranslation();

  const hasWorkflow = !!data.workflowId;

  return (
    <AddonNodeLayout
      data={data}
      selected={selected}
      onOpenSettings={onOpenSettings}
      id={id}
      icon={<DatabaseOutlined />}
      primaryColor="#fa8c16"
      title={data.label || t('workflow.nodes.recallKnowledge.title', '加载知识')}
      subtitle={
        hasWorkflow
          ? t('workflow.nodes.recallKnowledge.configured', 'Knowledge Source')
          : t('workflow.nodes.recallKnowledge.unconfigured', '未配置召回策略')
      }
    >
      {/* 角标：未配置时显示警告 */}
      {!hasWorkflow && (
        <div
          style={{
            position: 'absolute',
            bottom: -4,
            right: -4,
            width: 12,
            height: 12,
            background: '#ff4d4f',
            borderRadius: '50%',
            border: '2px solid #fff',
          }}
        />
      )}
    </AddonNodeLayout>
  );
};

export default RecallKnowledgeNode;
