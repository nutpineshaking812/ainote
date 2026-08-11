import React, { useState } from 'react';
import { Button, message } from 'antd';
import { CopyOutlined, CheckOutlined } from '@ant-design/icons';
import { marked } from 'marked';

interface CopyButtonProps {
  content: any; // 你要复制的 JSON 数据
  lang: string;
}

const CopyButton: React.FC<CopyButtonProps> = ({ content, lang }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    // 1. 创建一个隐藏的 textarea 用于触发选中逻辑
    // 必须有选中的元素，execCommand('copy') 才会生效
    const textArea = document.createElement('textarea');
    textArea.value = content;
    // 隐藏元素，使其对用户不可见
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '0';
    document.body.appendChild(textArea);
    textArea.select();

    let html = content;
    if (lang === 'markdown') {
      // 转换为 HTML 格式
      html = marked.parse(content);
    }
    // 2. 定义复制事件的处理函数
    const onCopy = (e: ClipboardEvent) => {
      e.preventDefault(); // 阻止默认的“只复制文本”行为
      const clipboardData = e.clipboardData;
      if (clipboardData) {
        // 1. 自定义类型：模仿 Notion，无需 'web ' 前缀
        clipboardData.setData('text/plain', content);
        clipboardData.setData('text/html', html);
        clipboardData.setData(`application/x-ainote-${lang}`, content);
      }
      // 成功后移除监听器
      document.removeEventListener('copy', onCopy);
    };
    // 3. 监听复制事件并执行命令
    document.addEventListener('copy', onCopy);
    try {
      // 这一步会触发上面的 onCopy 回调
      const successful = document.execCommand('copy');
      if (successful) {
        setCopied(true);
        message.success('已存入剪贴板');
        setTimeout(() => setCopied(false), 3000);
      } else {
        throw new Error('拷贝失败');
      }
    } catch (err) {
      message.error('浏览器暂不支持此复制方式');
      console.error('Legacy Copy Error:', err);
    } finally {
      // 4. 清理辅助元素
      document.body.removeChild(textArea);
    }
  };

  return (
    <Button
      type="text"
      size="small"
      icon={
        copied ? <CheckOutlined style={{ color: 'var(--ant-color-success)' }} /> : <CopyOutlined />
      }
      variant="text"
      onClick={handleCopy}
    >
      {/* {copied ? '已复制' : '复制组件'} */}
    </Button>
  );
};

export default CopyButton;
