import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Modal, Input, List, Avatar, Empty, Space, Button } from 'antd';
import { SearchOutlined, FileOutlined } from '@ant-design/icons';
import useDebounce from '../hooks/useDebounce';

/**
 * FileSelectorModal
 * Props:
 *  - visible: boolean
 *  - onCancel: () => void
 *  - onSelect: (file) => void
 *  - fetchFiles?: (query) => Promise<Array<{ id, name, size, mime }>>
 */
export default function FileSelectorModal({
  visible,
  onCancel,
  onSelect,
  fetchFiles,
  pageSize = 20,
}) {
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState([]);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);
  const [lastId, setLastId] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [hoveredId, setHoveredId] = useState(null);

  const cacheRef = useRef(new Map());
  const inFlightRef = useRef(new Map());
  const controllerRef = useRef(null);
  const sentinelRef = useRef(null);

  const buildKey = (q, cursor) => `${q || ''}|${cursor || ''}`;

  const loadPage = useCallback(
    async (q, cursor, { replace = false, signal } = {}) => {
      if (!fetchFiles) return;
      const key = buildKey(q, cursor);
      // cache hit
      if (cacheRef.current.has(key)) {
        const cached = cacheRef.current.get(key);
        setFiles((prev) => (replace ? [...cached.items] : [...prev, ...cached.items]));
        setHasMore(!!cached.hasMore);
        setLastId(cached.nextLastId || null);
        return;
      }
      // dedupe in-flight
      if (inFlightRef.current.has(key)) {
        const p = inFlightRef.current.get(key);
        const res = await p;
        if (res && res.items) {
          if (replace) setFiles(res.items);
          else setFiles((prev) => [...prev, ...res.items]);
          setHasMore(!!res.pagination?.hasMore);
          setLastId(res.pagination?.nextLastId || res.items[res.items.length - 1]?.id || null);
        }
        return;
      }

      // cancel previous controller
      if (controllerRef.current && typeof controllerRef.current.abort === 'function') {
        try {
          controllerRef.current.abort();
        } catch (e) {}
      }
      const ac = signal || new AbortController();
      controllerRef.current = ac;

      setLoading(true);
      const call = (async () => {
        try {
          const r = await fetchFiles(q || '', {
            lastId: cursor,
            limit: pageSize,
            signal: ac.signal,
          });
          const items = Array.isArray(r) ? r : r && r.items ? r.items : [];
          const pagination =
            r && r.pagination
              ? r.pagination
              : { nextLastId: null, hasMore: items.length >= pageSize };
          cacheRef.current.set(key, {
            items,
            nextLastId: pagination.nextLastId,
            hasMore: pagination.hasMore,
            pagination,
          });
          return { items, pagination };
        } finally {
        }
      })();

      inFlightRef.current.set(key, call);
      try {
        const result = await call;
        if (!result) return;
        if (replace) setFiles(result.items);
        else setFiles((prev) => [...prev, ...result.items]);
        setHasMore(!!result.pagination?.hasMore);
        setLastId(
          result.pagination?.nextLastId || result.items[result.items.length - 1]?.id || null,
        );
      } catch (err) {
        if (err && err.name === 'AbortError') {
          // cancelled
        } else {
          console.warn('load more files error', err);
        }
      } finally {
        inFlightRef.current.delete(key);
        setLoading(false);
      }
    },
    [fetchFiles, pageSize],
  );

  // load initial when visible or debouncedQuery changes
  useEffect(() => {
    if (!visible) return;
    setFiles([]);
    setLastId(null);
    setHasMore(true);
    loadPage(debouncedQuery, null, { replace: true });
    return () => {
      if (controllerRef.current && typeof controllerRef.current.abort === 'function')
        try {
          controllerRef.current.abort();
        } catch (e) {}
    };
  }, [visible, debouncedQuery, loadPage]);

  // infinite loading via IntersectionObserver sentinel
  useEffect(() => {
    if (!visible) return;
    const node = sentinelRef.current;
    if (!node) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const ent of entries) {
          if (ent.isIntersecting && hasMore && !loading) {
            loadPage(debouncedQuery, lastId, { replace: false });
          }
        }
      },
      { root: node.parentElement, rootMargin: '120px' },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [visible, sentinelRef, hasMore, loading, lastId, debouncedQuery, loadPage]);
  // Group files into time buckets: today, 7 days, 30 days, older
  const now = Date.now();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const dayMs = 24 * 60 * 60 * 1000;

  const buckets = {
    today: [],
    week: [],
    month: [],
    older: [],
  };
  for (const f of files) {
    const t = f.updatedAt
      ? new Date(f.updatedAt).getTime()
      : f.createdAt
        ? new Date(f.createdAt).getTime()
        : 0;
    if (!t) {
      buckets.older.push(f);
      continue;
    }
    if (t >= startOfToday.getTime()) buckets.today.push(f);
    else if (t >= now - 7 * dayMs) buckets.week.push(f);
    else if (t >= now - 30 * dayMs) buckets.month.push(f);
    else buckets.older.push(f);
  }

  const formatDateShort = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);

    // 判断日期所属分组以决定格式
    const now = Date.now();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const dayMs = 24 * 60 * 60 * 1000;

    const t = date.getTime();

    if (t >= startOfToday.getTime()) {
      // Today: hh:mm
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `今天 ${hours}:${minutes}`;
    } else if (t >= now - 7 * dayMs) {
      // Past week: MM.dd
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${month}月${day}日`;
    } else if (t >= now - 30 * dayMs) {
      // Past 30 days: MM.dd
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${month}月${day}日`;
    } else {
      // Older: yyyy.MM.dd
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}年${month}月${day}日`;
    }
  };

  const renderItem = (f) => {
    // console.log('Rendering file item:', f);
    const key = f.id || f.name || Math.random().toString(36).slice(2, 9);
    const title = f.name || '未命名文件';
    const dateStr = f.updatedAt || f.createdAt || '';
    const updated = formatDateShort(dateStr);
    const parentName = f.parentName || '';

    return (
      <List.Item
        key={key}
        onClick={() => onSelect && onSelect(f)}
        onMouseEnter={() => setHoveredId(key)}
        onMouseLeave={() => setHoveredId(null)}
        style={{
          cursor: 'pointer',
          background: hoveredId === key ? '#fafafa' : undefined,
          paddingLeft: 12,
          paddingRight: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <Avatar icon={<FileOutlined />} />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              fontWeight: 500,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {title}
          </span>
          {parentName && (
            <span
              style={{
                fontSize: 12,
                color: '#999',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                flex: '0 1 auto',
              }}
            >
              {parentName}
            </span>
          )}
        </div>
        <span
          style={{
            color: '#bbb',
            fontSize: 12,
            whiteSpace: 'nowrap',
            marginLeft: 0,
            flexShrink: 0,
          }}
        >
          {updated}
        </span>
      </List.Item>
    );
  };

  return (
    <Modal
      open={visible}
      title="选择文件"
      onCancel={onCancel}
      footer={null}
      width={640}
      zIndex={9999}
    >
      <Space orientation="vertical" style={{ width: '100%' }}>
        <Input
          placeholder="搜索文件名..."
          prefix={<SearchOutlined />}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          allowClear
        />

        {files.length === 0 && !loading ? (
          <Empty description="没有找到文件" />
        ) : (
          <div style={{ maxHeight: 400, overflow: 'auto' }}>
            {buckets.today.length > 0 && (
              <>
                <div
                  style={{
                    padding: '12px 12px 8px 12px',
                    fontSize: 12,
                    fontWeight: 500,
                    color: '#999',
                  }}
                >
                  Today
                </div>
                <List loading={loading} dataSource={buckets.today} renderItem={renderItem} />
              </>
            )}

            {buckets.week.length > 0 && (
              <>
                <div
                  style={{
                    padding: '12px 12px 8px 12px',
                    fontSize: 12,
                    fontWeight: 500,
                    color: '#999',
                  }}
                >
                  Past week
                </div>
                <List loading={false} dataSource={buckets.week} renderItem={renderItem} />
              </>
            )}

            {buckets.month.length > 0 && (
              <>
                <div
                  style={{
                    padding: '12px 12px 8px 12px',
                    fontSize: 12,
                    fontWeight: 500,
                    color: '#999',
                  }}
                >
                  Past 30 days
                </div>
                <List loading={false} dataSource={buckets.month} renderItem={renderItem} />
              </>
            )}

            {buckets.older.length > 0 && (
              <>
                <div
                  style={{
                    padding: '12px 12px 8px 12px',
                    fontSize: 12,
                    fontWeight: 500,
                    color: '#999',
                  }}
                >
                  Older
                </div>
                <List loading={false} dataSource={buckets.older} renderItem={renderItem} />
              </>
            )}

            {loading && <div style={{ padding: 12, textAlign: 'center' }}>加载中…</div>}
            {!hasMore && files.length > 0 && (
              <div style={{ padding: 8, textAlign: 'center', color: '#888' }}>没有更多文件</div>
            )}
            <div ref={sentinelRef} style={{ height: 1 }} />
          </div>
        )}
      </Space>
    </Modal>
  );
}
