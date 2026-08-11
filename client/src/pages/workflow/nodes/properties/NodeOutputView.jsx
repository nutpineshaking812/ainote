import React from 'react';
import { Tag, Typography, Empty } from 'antd';
import { useTranslation } from 'react-i18next';

import XMarkdownDisplay from '../../../../components/common/XMarkdownDisplay';

const { Text } = Typography;

const NodeOutputView = ({ node }) => {
  const { t } = useTranslation();
  /* 
    Enhanced Output View:
    If lastResult follows the debug structure { result, resolvedConfig }, split the view.
    Otherwise, show it as a single block.
  */
  const { status, lastResult, lastError } = node.data || {};
  
  let resolvedConfig = null;
  let finalResult = lastResult;

  if (lastResult && typeof lastResult === 'object' && 'resolvedConfig' in lastResult && 'result' in lastResult) {
    resolvedConfig = lastResult.resolvedConfig;
    finalResult = lastResult.result;
  }

  const formatJson = (data) => {
    const jsonStr = typeof data === 'object' ? JSON.stringify(data, null, 2) : String(data);
    return `\`\`\`json\n${jsonStr}\n\`\`\``;
  };

  return (
    <div style={{ padding: '8px 0' }}>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text type="secondary" style={{ fontSize: 12 }}>{t('workflow.designer.executionStatus', 'Execution Status')}</Text>
        <Tag 
          color={status === 'success' ? '#f6ffed' : status === 'error' ? '#fff1f0' : '#f5f5f5'} 
          style={{ 
            borderColor: status === 'success' ? '#b7eb8f' : status === 'error' ? '#ffa39e' : '#d9d9d9',
            color: status === 'success' ? '#389e0d' : status === 'error' ? '#cf1322' : '#595959',
            margin: 0,
            fontSize: 10,
            textTransform: 'uppercase',
            fontWeight: 600
          }}
        >
          {status || t('common.idle', 'IDLE')}
        </Tag>
      </div>
      
      {resolvedConfig && (
        <div style={{ marginBottom: 16 }}>
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8, fontWeight: 500 }}>
              {t('workflow.designer.inputRef', 'Resolved Input')}
            </Text>
            <div style={{ border: '1px solid #f0f0f0', borderRadius: 8, overflow: 'hidden' }}>
              <XMarkdownDisplay>
                {formatJson(resolvedConfig)}
              </XMarkdownDisplay>
            </div>
        </div>
      )}

      <div>
          {resolvedConfig && (
            <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8, fontWeight: 500 }}>
              {t('workflow.designer.outputRes', 'Result')}
            </Text>
          )}
          
          {(finalResult || lastError) ? (
            <div style={{ border: '1px solid #f0f0f0', borderRadius: 8, overflow: 'hidden' }}>
              <XMarkdownDisplay>
                {lastError ? `\`\`\`text\nError:\n${lastError}\n\`\`\`` : formatJson(finalResult)}
              </XMarkdownDisplay>
            </div>
          ) : (
             <div style={{ 
               background: '#f5f5f5', 
               padding: 16, 
               borderRadius: 8, 
               color: '#8c8c8c',
               fontSize: 12,
               border: '1px solid #f0f0f0' 
             }}>
               // {t('workflow.designer.noOutputYet', 'No output data yet.')}
             </div>
          )}
      </div>
    </div>
  );
};

export default NodeOutputView;
