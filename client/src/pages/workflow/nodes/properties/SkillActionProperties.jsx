import React from 'react';
import { Form, Select, Divider } from 'antd';
import { useTranslation } from 'react-i18next';
import NodePropertyCollapse from './NodePropertyCollapse';
import ParameterList from './components/ParameterList';
import VariableInput from '../../components/PropertyInputs/VariableInput';

const SkillActionProperties = ({ node, setNodes, currentNodeId }) => {
  const { t } = useTranslation();

  return (
    <NodePropertyCollapse node={node} setNodes={setNodes}>
      <Form.Item label={t('common.action', 'Action')} name="action">
        <Select>
          <Select.Option value="install">
            {t('admin.ability.installSkill', 'Install Skill')}
          </Select.Option>
          <Select.Option value="uninstall">{t('common.uninstall', 'Uninstall')}</Select.Option>
          <Select.Option value="list">{t('common.list', 'List Installed')}</Select.Option>
          <Select.Option value="saveSystem">
            {t('workflow.nodes.skillAction.saveSystem', 'Create/Update System Skill')}
          </Select.Option>
          <Select.Option value="deleteSystem">
            {t('workflow.nodes.skillAction.deleteSystem', 'Delete System Skill')}
          </Select.Option>
        </Select>
      </Form.Item>

      <Form.Item noStyle dependencies={['action']}>
        {({ getFieldValue }) => {
          const action = getFieldValue('action');

          if (action === 'install') {
            return (
              <Form.Item
                label={t('admin.ability.gitUrl', 'Git Repository URL')}
                name="gitUrl"
                rules={[{ required: true, message: t('admin.ability.urlRequired') }]}
              >
                <VariableInput 
                  placeholder="https://github.com/user/repo.git" 
                  
                  currentNodeId={currentNodeId || node?.id}
                />
              </Form.Item>
            );
          }

          if (['uninstall', 'deleteSystem'].includes(action)) {
            return (
              <Form.Item
                label={t('common.folderName', 'Folder Name')}
                name="folderName"
                rules={[{ required: true, message: t('common.required', 'Required') }]}
              >
                <VariableInput 
                  placeholder="e.g. my-awesome-skill" 
                  
                  currentNodeId={currentNodeId || node?.id}
                />
              </Form.Item>
            );
          }

          if (action === 'saveSystem') {
            return (
              <>
                <Divider plain>{t('common.details', 'Details')}</Divider>
                <Form.Item
                  label={t('common.folderName', 'Folder Name')}
                  name="folderName"
                  rules={[{ required: true, message: t('common.required') }]}
                >
                  <VariableInput 
                    placeholder="e.g. system-helper" 
                    
                    currentNodeId={currentNodeId || node?.id}
                  />
                </Form.Item>
                <Form.Item
                  label={t('common.name', 'Name')}
                  name="name"
                  rules={[{ required: true, message: t('common.required') }]}
                >
                  <VariableInput 
                    placeholder="Skill Display Name" 
                    
                    currentNodeId={currentNodeId || node?.id}
                  />
                </Form.Item>
                <Form.Item label={t('common.description', 'Description')} name="description">
                  <VariableInput 
                    rows={2} 
                    
                    currentNodeId={currentNodeId || node?.id}
                  />
                </Form.Item>

                <Form.Item
                  label={t('workflow.nodes.skill.sop', 'SOP (Instruction)')}
                  name="sopContent"
                >
                  <VariableInput
                    rows={6}
                    placeholder="# Skill SOP\n\nDescribe the steps and rules for this skill..."
                    
                    currentNodeId={currentNodeId || node?.id}
                  />
                </Form.Item>

                <Form.Item
                  label={t('workflow.nodes.skill.parameters', 'Input Parameters')}
                  name="parameters"
                >
                  <ParameterList />
                </Form.Item>
              </>
            );
          }

          return null;
        }}
      </Form.Item>
    </NodePropertyCollapse>
  );
};

export default SkillActionProperties;
