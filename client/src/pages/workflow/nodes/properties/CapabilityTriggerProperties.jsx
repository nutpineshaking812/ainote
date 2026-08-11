import { Form, Typography, Divider, Switch } from 'antd';
import { useTranslation } from 'react-i18next';
import NodePropertyCollapse from './NodePropertyCollapse';
import CategorySelect from '../../../../components/common/CategorySelect';
import SchemaConfigList from './SchemaConfigList';

const { Text } = Typography;

const CapabilityTriggerProperties = ({ node, setNodes }) => {
  const { t } = useTranslation();

  return (
    <NodePropertyCollapse node={node} setNodes={setNodes}>
      <Form.Item
        label={t('workflow.nodes.capability.matchTags', 'Matching Tags')}
        name="matchTags"
        tooltip={t(
          'workflow.nodes.capability.matchTagsTooltip',
          'Standardized metadata tags to trigger this capability (e.g. "Weekly").',
        )}
      >
        <CategorySelect
          placeholder={t('workflow.nodes.capability.tagsPlaceholder', 'Enter capability tags')}
        />
      </Form.Item>

      <Form.Item
        label={t('workflow.nodes.capability.showStream', 'Show in Chat')}
        name="showStream"
        valuePropName="checked"
        tooltip={t(
          'workflow.nodes.capability.showStreamTooltip',
          'If enabled, this capability execution will be shown as a streaming message in the chat sidebar.',
        )}
      >
        <Switch size="small" />
      </Form.Item>

      <div style={{ padding: '0 4px 12px 4px' }}>
        <Text type="secondary" style={{ fontSize: '11px' }}>
          {t(
            'workflow.nodes.capability.hint',
            'This flow serves as a standardized capability for data matching these tags.',
          )}
        </Text>
      </div>

      <SchemaConfigList
        mode="input"
        label="输入定义 (Input Schema)"
        node={node}
        setNodes={setNodes}
      />
    </NodePropertyCollapse>
  );
};

export default CapabilityTriggerProperties;
