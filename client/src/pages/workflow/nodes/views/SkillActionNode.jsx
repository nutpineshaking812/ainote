import React from 'react';
import { Tag } from 'antd';
import {
  RobotOutlined,
  CloudDownloadOutlined,
  DeleteOutlined,
  BarsOutlined,
  PlusOutlined,
  EditOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import BaseNodeLayout from './BaseNodeLayout';

const SkillActionNode = (props) => {
  const { data, id } = props;
  const { t } = useTranslation();

  const getActionIcon = () => {
    switch (data.action) {
      case 'install': return <CloudDownloadOutlined />;
      case 'uninstall': return <DeleteOutlined />;
      case 'list': return <BarsOutlined />;
      case 'createSystem': return <PlusOutlined />;
      case 'saveSystem':
      case 'updateSystem': return <EditOutlined />;
      case 'deleteSystem': return <DeleteOutlined />;
      default: return null;
    }
  };

  const getSubtitle = () => {
    if (data.action === 'install') return data.gitUrl || 'Git URL';
    if (data.action === 'saveSystem') return data.name || data.folderName || 'Skill Name';
    return data.folderName || data.repoFolderName || 'Target Item';
  };

  return (
    <BaseNodeLayout
      {...props}
      id={id}
      icon={<RobotOutlined />}
      color="#eb2f96"
      title={t('workflow.nodes.skillAction.title', 'Skill Action')}
      subtitle={getSubtitle()}
    >
      <div style={{ marginTop: 8 }}>
        <Tag
          icon={getActionIcon()}
          color={['uninstall', 'deleteSystem'].includes(data.action) ? 'red' : 'blue'}
          style={{ fontSize: '10px', borderRadius: '4px', margin: 0 }}
        >
          {data.action ? t(`workflow.nodes.skillAction.${data.action}`, data.action) : 'No Action'}
        </Tag>
      </div>
    </BaseNodeLayout>
  );
};

export default SkillActionNode;
