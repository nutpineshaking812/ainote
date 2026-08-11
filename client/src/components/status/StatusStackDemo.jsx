import React, { useEffect, useState } from 'react';
import StatusStack from './StatusStack.jsx';

const SAMPLE_ITEMS = [
  { id: 'pending', label: 'Pending', description: '等待响应', color: '#64748b' },
  { id: 'running', label: 'Running', description: '正在执行', color: '#2563eb' },
  { id: 'verifying', label: 'Verifying', description: '校验结果', color: '#9333ea' },
];

export default function StatusStackDemo() {
  const [items, setItems] = useState([SAMPLE_ITEMS[0]]);
  console.log('StatusStackDemo items:', items);

  useEffect(() => {
    const timers = SAMPLE_ITEMS.map((item, index) =>
      window.setTimeout(() => {
        setItems((prev) => {
          const exists = prev.some((prevItem) => prevItem.id === item.id);
          if (exists) return prev;
          return [...prev, item];
        });
      }, index * 1200),
    );
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  return <StatusStack items={items} />;
}
