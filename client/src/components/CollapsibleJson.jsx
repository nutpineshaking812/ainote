import React from 'react';
import { Collapse, Typography } from 'antd';
const { Panel } = Collapse;
const { Paragraph } = Typography;

// Simple reusable collapsible JSON viewer.
// Props:
// - data: object or string to display (will JSON.stringify if object)
// - title: optional header string
// - defaultActive: boolean, true = expanded by default
export default function CollapsibleJson({
  data,
  title = 'Pipeline',
  defaultActive = false,
  style,
}) {
  let pretty = '';
  if (data == null) {
    pretty = 'null';
  } else if (typeof data === 'string') {
    // try to parse JSON string for pretty print, otherwise display raw
    try {
      const parsed = JSON.parse(data);
      pretty = JSON.stringify(parsed, null, 2);
    } catch (e) {
      pretty = data;
    }
  } else {
    try {
      pretty = JSON.stringify(data, null, 2);
    } catch (e) {
      pretty = String(data);
    }
  }

  return (
    <div style={style} className="collapsible-json">
      <Collapse ghost defaultActiveKey={defaultActive ? ['1'] : []}>
        <Panel header={title} key="1">
          <Paragraph style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 12 }}>
            {pretty}
          </Paragraph>
        </Panel>
      </Collapse>
    </div>
  );
}
