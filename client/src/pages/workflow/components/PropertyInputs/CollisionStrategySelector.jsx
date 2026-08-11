import React from 'react';
import { Radio } from 'antd';
import { useTranslation } from 'react-i18next';

/**
 * CollisionStrategySelector - A standard selector for resource conflict resolution strategies.
 * Supports: overwrite, skip
 */
const CollisionStrategySelector = ({ value, onChange, options: customOptions, ...props }) => {
  const { t } = useTranslation();

  const defaultOptions = [
    { label: t('workflow.designer.collisionOverwrite', 'Overwrite'), value: 'overwrite' },
    { label: t('workflow.designer.collisionSkip', 'Skip'), value: 'skip' },
  ];

  const options = customOptions || defaultOptions;

  return (
    <Radio.Group 
      buttonStyle="solid" 
      value={value} 
      onChange={onChange}
      {...props}
    >
      {options.map(opt => (
        <Radio.Button key={opt.value} value={opt.value}>
          {opt.label}
        </Radio.Button>
      ))}
    </Radio.Group>
  );
};

export default CollisionStrategySelector;
