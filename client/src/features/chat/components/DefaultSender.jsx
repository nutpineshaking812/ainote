import React, { useState, useCallback } from 'react';
import { SendOutlined } from '@ant-design/icons';
import { SenderComponent } from '../../../components/sender';

const DefaultSender = ({
  disabled,
  loading,
  onCancel,
  onSubmit,
  placeholder = '',
  appId,
  initialReferences = [],
}) => {
  // const [value, setValue] = useState('');
  // const [slotConfig, setSlotConfig] = useState([]);
  const sendRef = React.useRef(null);

  // const handleChange = useCallback((nextValue, _event, config = []) => {
  //   setValue(nextValue);
  //   setSlotConfig(config);
  //   console.log('Sender value changed:', nextValue, config);
  // }, []);

  const handleSubmit = useCallback(
    (value, slotConfig) => {
      const document = slotConfig
        .map((slot) => {
          return {
            label: slot.label,
            id: slot.value,
            type: slot.type,
          };
        });
      if (!value) return;

      onSubmit?.(value, {
        refs: document,
        appId: appId,
      });
    },
    [onSubmit, appId],
  );

  return (
    <SenderComponent
      ref={sendRef}
      appId={appId}
      displayMode="header"
      placeholder={placeholder}
      disabled={disabled}
      loading={loading}
      onCancel={onCancel}
      onSubmit={handleSubmit}
      // onChange={handleChange}
      initialSelectionTokens={initialReferences}
    />
  );
};

export default DefaultSender;
