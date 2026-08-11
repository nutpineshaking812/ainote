import React from 'react';
import { Typography } from 'antd';

/**
 * Render a label with an optional required star.
 * Props:
 * - text: string label text
 * - required: boolean whether to show required star
 */
export default function RequiredLabel({ text, required }) {
  // return <Typography.Title level={2}>h2. Ant Design</Typography.Title>;
  if (required) {
    return (
      <Typography.Text strong type="danger">
        <strong>*</strong>&nbsp;{text}
      </Typography.Text>
    );
  }
  return <Typography.Text>{text}</Typography.Text>;
}
