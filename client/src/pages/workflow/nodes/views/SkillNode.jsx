import React from 'react';
import { useTranslation } from 'react-i18next';
import { ThunderboltOutlined } from '@ant-design/icons';
import AddonNodeLayout from './AddonNodeLayout';

const SkillNode = ({ data, selected, onOpenSettings, id }) => {
  const { t } = useTranslation();
  const skillCount = Array.isArray(data.skillIds)
    ? data.skillIds.length
    : typeof data.skillIds === 'string' && data.skillIds.trim()
      ? 1
      : 0;
  const isRunning = data.status === 'running';

  return (
    <AddonNodeLayout
      data={data}
      selected={selected}
      onOpenSettings={onOpenSettings}
      id={id}
      icon={<ThunderboltOutlined />}
      primaryColor="#722ed1"
      title={t('workflow.nodes.skill.title', 'Skill Sphere')}
      subtitle={t('workflow.nodes.skill.type', 'AI Plugin')}
    >
      {/* 技能数量角标 */}
      {skillCount > 0 && !isRunning && (
        <div
          style={{
            position: 'absolute',
            bottom: -5,
            right: -5,
            background: '#faad14',
            color: '#fff',
            fontSize: '9px',
            fontWeight: 700,
            padding: '2px 5px',
            borderRadius: '10px',
            border: '2px solid #fff',
          }}
        >
          {skillCount}
        </div>
      )}
    </AddonNodeLayout>
  );
};

export default SkillNode;
