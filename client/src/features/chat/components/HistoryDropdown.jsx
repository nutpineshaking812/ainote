import React, { useMemo, useRef, useState } from 'react';
import { Popover, Button, Empty } from 'antd';
import { UnorderedListOutlined } from '@ant-design/icons';
import ConversationList from './ConversationList.jsx';

export default function HistoryDropdown({ threads, loading, activeKey, onSelect, onNewThread }) {
  const containerRef = useRef(null);
  const [open, setOpen] = useState(false);

  const hasThreads = Array.isArray(threads) && threads.length > 0;

  const content = useMemo(() => {
    if (!hasThreads) {
      return (
        <div style={{ padding: '16px 8px', width: 260 }}>
          <Empty description="暂无会话" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          <Button block size="small" type="primary" style={{ marginTop: 12 }} onClick={onNewThread}>
            新建会话
          </Button>
        </div>
      );
    }
    return (
      <div style={{ width: 300, height: 360 }}>
        <ConversationList
          threads={threads}
          loading={loading}
          activeKey={activeKey}
          onActiveChange={(key) => {
            onSelect?.(key);
            setOpen(false);
          }}
          onNewThread={() => {
            onNewThread?.();
            setOpen(false);
          }}
        />
      </div>
    );
  }, [hasThreads, threads, loading, activeKey, onSelect, onNewThread]);

  return (
    <div>
      <Popover
        placement="bottomRight"
        content={content}
        trigger="click"
        open={open}
        onOpenChange={setOpen}
      >
        <Button
          className="dropdown-btn"
          size="small"
          icon={<UnorderedListOutlined />}
          loading={loading}
          style={{ minWidth: 88 }}
        >
          会话
        </Button>
      </Popover>
    </div>
  );
}
