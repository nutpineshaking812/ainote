import React from 'react';
import { useNavigate } from 'react-router-dom';

// Presentational component now relies on summary-provided recentDocuments passed via props.
// Fallback: if documents prop missing or empty, shows placeholder (no internal fetch).
const RecentDocuments = ({ documents = [], limit = 6 }) => {
  const navigate = useNavigate();
  const docs = Array.isArray(documents) ? documents.slice(0, limit) : [];

  if (!docs.length) {
    return <div style={{ padding: '12px 6px', color: '#999' }}>暂无最近笔记。</div>;
  }

  // http://localhost:5000/apps/691d99371a36adb803207548#/document/69241ef4e52eeae29db40793
  return (
    <div style={{ minHeight: 200 }}>
      {docs.map((d) => (
        <div
          key={d._id || d.refId}
          style={{ padding: '10px 6px', borderBottom: '1px solid #f0f0f0', cursor: 'pointer' }}
          onClick={() => navigate(`/apps/${d.appId}#/document/${d._id || d.refId}`)}
        >
          <div style={{ fontWeight: 600 }}>{d.title || '无标题笔记'}</div>
          <div style={{ fontSize: 12, color: '#666' }}>
            {d.updatedAt ? new Date(d.updatedAt).toLocaleString() : ''}
          </div>
        </div>
      ))}
    </div>
  );
};

export default RecentDocuments;
