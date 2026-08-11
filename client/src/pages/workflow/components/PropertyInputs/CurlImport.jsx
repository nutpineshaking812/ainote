import React, { useState } from 'react';
import { Button, Modal, Input, message, Form } from 'antd';

function parseCurl(curlString) {
  if (!curlString) return null;
  const cleanString = curlString.replace(/\\\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
  
  let method = 'GET';
  let url = '';
  const headers = {};
  let body = '';

  const argReg = /(-X|--request|-H|--header|-d|--data|--data-raw|--data-binary|--data-ascii|--data-urlencode)\s+('[^']*'|"[^"]*"|[^\s]+)/g;
  
  let match;
  while ((match = argReg.exec(cleanString)) !== null) {
    const flag = match[1];
    let val = match[2];
    
    if ((val.startsWith("'") && val.endsWith("'")) || (val.startsWith('"') && val.endsWith('"'))) {
      val = val.substring(1, val.length - 1);
    }
    
    if (flag === '-X' || flag === '--request') {
      method = val.toUpperCase();
    } else if (flag === '-H' || flag === '--header') {
      const idx = val.indexOf(':');
      if (idx !== -1) {
        const k = val.substring(0, idx).trim();
        const v = val.substring(idx + 1).trim();
        headers[k] = v;
      }
    } else if (flag.startsWith('-d') || flag.startsWith('--data')) {
      body = val;
      if (method === 'GET') method = 'POST';
    }
  }

  const tokens = [];
  const tokenReg = /('[^']*'|"[^"]*"|[^\s]+)/g;
  while ((match = tokenReg.exec(cleanString)) !== null) {
    tokens.push(match[1]);
  }
  
  for (let i = 1; i < tokens.length; i++) {
    let t = tokens[i];
    if ((t.startsWith("'") && t.endsWith("'")) || (t.startsWith('"') && t.endsWith('"'))) {
      t = t.substring(1, t.length - 1);
    }
    const prev = tokens[i - 1];
    if (prev.startsWith('-') || prev.startsWith('--')) {
      continue;
    }
    if (t.startsWith('http://') || t.startsWith('https://')) {
      url = t;
      break;
    }
  }
  
  if (!url) {
    for (let i = 1; i < tokens.length; i++) {
      let t = tokens[i];
      if ((t.startsWith("'") && t.endsWith("'")) || (t.startsWith('"') && t.endsWith('"'))) {
        t = t.substring(1, t.length - 1);
      }
      const prev = tokens[i - 1];
      if (prev.startsWith('-') || prev.startsWith('--')) {
        continue;
      }
      if (t && !t.startsWith('-') && (t.includes('.') || t.includes('/'))) {
        url = t;
        break;
      }
    }
  }

  return {
    method,
    url,
    headers: Object.keys(headers).length > 0 ? JSON.stringify(headers, null, 2) : '',
    body
  };
}

const CurlImport = ({ node, setNodes, currentNodeId }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [curlText, setCurlText] = useState('');
  const form = Form.useFormInstance();

  const handleImport = () => {
    if (!curlText.trim()) {
      message.warning('请输入 cURL 命令行');
      return;
    }
    const parsed = parseCurl(curlText);
    if (!parsed) {
      message.error('解析 cURL 失败，请检查格式');
      return;
    }

    // 1. 同步更新 Ant Design Form 存储中的字段
    if (form) {
      form.setFieldsValue({
        pluginParams: {
          method: parsed.method,
          url: parsed.url,
          headers: parsed.headers,
          body: parsed.body,
        }
      });
    }

    // 2. 同步更新 React Flow 状态
    if (typeof setNodes === 'function') {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id === (currentNodeId || node?.id)) {
            return {
              ...n,
              data: {
                ...n.data,
                pluginParams: {
                  ...(n.data?.pluginParams || {}),
                  method: parsed.method,
                  url: parsed.url,
                  headers: parsed.headers,
                  body: parsed.body,
                },
              },
            };
          }
          return n;
        }),
      );
    }

    message.success('导入成功');
    setModalVisible(false);
    setCurlText('');
  };

  return (
    <>
      <Button type="primary" ghost block onClick={() => setModalVisible(true)}>
        点击导入 cURL
      </Button>
      <Modal
        title="从 cURL 导入"
        open={modalVisible}
        onOk={handleImport}
        onCancel={() => {
          setModalVisible(false);
          setCurlText('');
        }}
        destroyOnClose
      >
        <Input.TextArea
          placeholder="在此粘贴您的 cURL 命令行，例如：&#10;curl -X POST https://api.example.com/data \&#10;  -H 'Authorization: Bearer 123' \&#10;  -d '{&quot;name&quot;: &quot;test&quot;}'"
          rows={8}
          value={curlText}
          onChange={(e) => setCurlText(e.target.value)}
        />
      </Modal>
    </>
  );
};

export default CurlImport;
