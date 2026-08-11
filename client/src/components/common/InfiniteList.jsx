import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Empty, List, Spin } from 'antd';

const normalizeResult = (result, pageSize) => {
  if (Array.isArray(result)) {
    return {
      records: result,
      hasMore: result.length === pageSize,
    };
  }

  const records = Array.isArray(result?.data) ? result.data : [];
  const hasMore =
    typeof result?.hasMore === 'boolean' ? result.hasMore : records.length === pageSize;

  return { records, hasMore };
};

const defaultRenderItem = (item) => (
  <List.Item>
    <List.Item.Meta title={item?.title || '未命名'} description={item?.description} />
  </List.Item>
);

const InfiniteList = ({
  fetchPage,
  renderItem = defaultRenderItem,
  itemKey = 'id',
  pageSize = 20,
  initialPage = 1,
  threshold = 2,
  autoLoadFirstPage = true,
  refreshKey,
  endingText = '已经到底了',
  emptyDescription = '暂无数据',
  listProps = {},
  className,
  onLoadError,
  onDataChange,
}) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);

  const { className: listClassName, style: listStyle, ...restListProps } = listProps;

  const nextPageRef = useRef(initialPage);
  const loadingRef = useRef(false);
  const hasMoreRef = useRef(true);
  const itemsRef = useRef([]);
  const scrollContainerRef = useRef(null);

  const mergedClassName = useMemo(() => {
    return [listClassName, className].filter(Boolean).join(' ');
  }, [className, listClassName]);

  const getItemIdentifier = useCallback(
    (item) => {
      if (!item) return undefined;
      if (typeof itemKey === 'function') return itemKey(item);
      if (typeof itemKey === 'string' && itemKey) return item?.[itemKey];
      return item?.id || item?._id || item?.key;
    },
    [itemKey],
  );

  const loadPage = useCallback(
    async ({ reset = false } = {}) => {
      if (loadingRef.current) return;
      if (!hasMoreRef.current && !reset) return;

      if (reset) {
        nextPageRef.current = initialPage;
        setItems([]);
        setHasMore(true);
        hasMoreRef.current = true;
        itemsRef.current = [];
      }

      loadingRef.current = true;
      setLoading(true);

      const targetPage = nextPageRef.current;
      const lastSnapshot = itemsRef.current;
      const lastItem = lastSnapshot[lastSnapshot.length - 1];
      const lastItemId = reset ? undefined : getItemIdentifier(lastItem);

      try {
        const result = await fetchPage(targetPage, pageSize, lastItemId);
        const { records, hasMore: nextHasMore } = normalizeResult(result, pageSize);

        setItems((prev) => {
          const nextItems = reset ? records : prev.concat(records);
          itemsRef.current = nextItems;
          return nextItems;
        });
        setHasMore(nextHasMore);
        hasMoreRef.current = nextHasMore;
        nextPageRef.current = targetPage + 1;
        setError(null);
      } catch (err) {
        const message = err?.message || '列表数据加载失败';
        setError(message);
        onLoadError?.(err);
      } finally {
        setLoading(false);
        loadingRef.current = false;
      }
    },
    [fetchPage, pageSize, initialPage, getItemIdentifier, onLoadError],
  );

  useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);

  useEffect(() => {
    if (!autoLoadFirstPage) return;
    loadPage({ reset: true });
  }, [autoLoadFirstPage, refreshKey, loadPage]);

  useEffect(() => {
    itemsRef.current = items;
    onDataChange?.(items);
  }, [items, onDataChange]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return undefined;

    const maybeLoadMore = () => {
      if (loadingRef.current || !hasMoreRef.current) return;
      const { scrollHeight, clientHeight, scrollTop } = container;
      if (scrollHeight - clientHeight - scrollTop <= threshold) {
        loadPage();
      }
    };

    maybeLoadMore();

    if (typeof window !== 'undefined' && 'ResizeObserver' in window) {
      const observer = new window.ResizeObserver(maybeLoadMore);
      observer.observe(container);
      return () => observer.disconnect();
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', maybeLoadMore);
      return () => window.removeEventListener('resize', maybeLoadMore);
    }

    return undefined;
  }, [items, threshold, loadPage]);

  const handleScroll = useCallback(
    (e) => {
      if (!hasMore || loadingRef.current) return;
      const { scrollHeight, scrollTop, clientHeight } = e.currentTarget;
      if (scrollHeight - scrollTop - clientHeight <= threshold) {
        loadPage();
      }
    },
    [hasMore, threshold, loadPage],
  );

  const showInitialLoading = loading && items.length === 0;
  const showEmptyState = !loading && items.length === 0 && !hasMore;

  const mergedListStyle = useMemo(() => {
    return {
      padding: 0,
      ...listStyle,
    };
  }, [listStyle]);

  return (
    <div
      className="infinite-list"
      style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}
    >
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: 4 }}
      >
        {showInitialLoading ? (
          <div
            style={{
              height: '100%',
              minHeight: 200,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Spin size="large" />
          </div>
        ) : showEmptyState ? (
          <div style={{ padding: '24px 0' }}>
            <Empty description={emptyDescription} />
          </div>
        ) : (
          <List
            {...restListProps}
            className={mergedClassName}
            style={mergedListStyle}
            dataSource={items}
            renderItem={(item, index) => renderItem(item, index, items)}
          />
        )}
      </div>
      <div style={{ padding: '0px 0', textAlign: 'center', flexShrink: 0 }}>
        {loading && <Spin size="small" />}
        {!hasMore && items.length > 0 && !loading && (
          <span style={{ color: '#999' }}>{endingText}</span>
        )}
        {error && !loading && <div style={{ color: '#ff4d4f' }}>{error}</div>}
      </div>
    </div>
  );
};

export default InfiniteList;
