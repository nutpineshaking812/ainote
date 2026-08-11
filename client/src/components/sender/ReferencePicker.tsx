import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { List, Space, Tag, Typography } from 'antd';
import { FileOutlined, SnippetsOutlined } from '@ant-design/icons';
import TabbedInfiniteList from '../common/TabbedInfiniteList';
import { recentDocuments } from '../../api/documents';
import { listTemplates } from '../../api/templates';

const { Text } = Typography;

type DocumentRecord = {
  id: string;
  title: string;
  parentName?: string;
  updatedAt?: string;
  raw: any;
};

type TemplateRecord = {
  id: string;
  name: string;
  description?: string;
  scope?: string;
  raw: any;
};

type ReferencePickerProps = {
  width?: number | null;
  height?: number;
  appId?: string;
  onSelectDocument?: (doc: any) => void;
  onSelectTemplate?: (tpl: any) => void;
  onClose?: () => void;
  activeTabKey?: string;
  onActiveTabChange?: (key: string) => void;
  refreshKey?: number;
};

const normalizeTemplateList = (payload: any): any[] => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  return [];
};

const buildDocumentRecord = (doc: any): DocumentRecord | null => {
  const id = doc?._id || doc?.id;
  if (!id) return null;
  return {
    id,
    title: doc?.title || doc?.name || '未命名文档',
    parentName: doc?.parentName || doc?.folderName,
    updatedAt: doc?.updatedAt || doc?.createdAt,
    raw: doc,
  };
};

const buildTemplateRecord = (tpl: any): TemplateRecord | null => {
  const id = tpl?._id || tpl?.id;
  if (!id) return null;
  return {
    id,
    name: tpl?.name || '未命名模板',
    description: tpl?.description,
    scope: tpl?.scope,
    raw: tpl,
  };
};

const formatDateLabel = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const now = Date.now();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const dayMs = 24 * 60 * 60 * 1000;
  const ts = date.getTime();
  if (ts >= startOfToday.getTime()) {
    return `今天 ${date.getHours().toString().padStart(2, '0')}:${date
      .getMinutes()
      .toString()
      .padStart(2, '0')}`;
  }
  if (ts >= now - 7 * dayMs) {
    return `${(date.getMonth() + 1).toString().padStart(2, '0')}月${date
      .getDate()
      .toString()
      .padStart(2, '0')}日`;
  }
  return `${date.getFullYear()}年${(date.getMonth() + 1).toString().padStart(2, '0')}月${date
    .getDate()
    .toString()
    .padStart(2, '0')}日`;
};

export type ReferencePickerHandle = { focus: () => void };

const ReferencePicker = forwardRef<ReferencePickerHandle, ReferencePickerProps>(
  (
    {
      height = 360,
      appId,
      onSelectDocument,
      onSelectTemplate,
      onClose,
      activeTabKey,
      onActiveTabChange,
      refreshKey = 0,
    },
    ref,
  ) => {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [activeIndex, setActiveIndex] = useState<number>(0);
    const [currentItems, setCurrentItems] = useState<any[]>([]);
    const [navMode, setNavMode] = useState<'tabs' | 'items'>('tabs');

    useImperativeHandle(ref, () => ({
      focus: () => {
        (containerRef.current as any)?.focus?.({ preventScroll: true });
      },
    }));
    const documentFetcher = useCallback(
      async (_page: number, pageSize: number, lastItemId?: string) => {
        try {
          const response = await recentDocuments({ limit: pageSize, lastId: lastItemId });
          const resp: any = response as any;
          const source = Array.isArray(resp?.items)
            ? response
            : Array.isArray(resp)
              ? { items: response }
              : resp?.data?.items
                ? resp.data
                : resp;
          const items: any[] = Array.isArray((source as any)?.items) ? (source as any).items : [];
          const mapped = items
            .map(buildDocumentRecord)
            .filter((item: any): item is DocumentRecord => !!item);
          const hasMore =
            typeof source?.pagination?.hasMore === 'boolean'
              ? source.pagination.hasMore
              : mapped.length === pageSize;
          return { data: mapped, hasMore };
        } catch (error) {
          console.warn('Failed to fetch documents for picker', error);
          return { data: [], hasMore: false };
        }
      },
      [],
    );

    const templateFetcher = useCallback(
      async (page: number, pageSize: number) => {
        if (page > 1) {
          return { data: [], hasMore: false };
        }
        try {
          const payload: any = await listTemplates({ appId, type: 'prompt', pageSize });
          const items: any[] = normalizeTemplateList(payload)
            .map(buildTemplateRecord)
            .filter((item: any): item is TemplateRecord => !!item);
          return { data: items, hasMore: false };
        } catch (error) {
          console.warn('Failed to fetch templates for picker', error);
          return { data: [], hasMore: false };
        }
      },
      [appId],
    );

    const renderDocumentItem = useCallback(
      (item: DocumentRecord, index: number) =>
        renderCommonItem({
          key: item.id,
          index,
          onClick: () => {
            onSelectDocument?.(item.raw);
            onClose?.();
          },
          title: item.title,
          icon: <FileOutlined />,
          iconBg: '#f6ffed',
          iconColor: '#52c41a',
          extraTag: item.parentName ? <Tag>{item.parentName}</Tag> : undefined,
        }),
      [onClose, onSelectDocument, activeIndex, navMode],
    );

    const renderTemplateItem = useCallback(
      (item: TemplateRecord, index: number) =>
        renderCommonItem({
          key: item.id,
          index,
          onClick: () => {
            onSelectTemplate?.(item.raw);
            onClose?.();
          },
          title: item.name,
          icon: <SnippetsOutlined />,
          iconBg: '#f6ffed',
          iconColor: '#52c41a',
          extraTag: item.scope ? (
            <Tag color={item.scope === 'app' ? 'orange' : 'default'}>
              {item.scope === 'app' ? '应用模板' : '个人模板'}
            </Tag>
          ) : undefined,
        }),
      [onClose, onSelectTemplate, activeIndex, navMode],
    );

    const tabs = useMemo(
      () => [
        {
          key: 'templates',
          label: '系统提示语',
          fetchPage: templateFetcher,
          renderItem: renderTemplateItem,
          itemKey: 'id',
          listProps: { split: false },
          infiniteListProps: {
            refreshKey: `templates-${refreshKey}`,
            onDataChange: (items: any[]) => {
              if (activeTabKey === 'templates') {
                setCurrentItems(items);
                setActiveIndex((idx) => Math.min(Math.max(0, idx), Math.max(0, items.length - 1)));
              }
            },
          },
        },
        {
          key: 'documents',
          label: '引用文档',
          fetchPage: documentFetcher,
          renderItem: renderDocumentItem,
          itemKey: 'id',
          listProps: { split: false },
          infiniteListProps: {
            refreshKey: `documents-${refreshKey}`,
            onDataChange: (items: any[]) => {
              if (activeTabKey === 'documents') {
                setCurrentItems(items);
                setActiveIndex((idx) => Math.min(Math.max(0, idx), Math.max(0, items.length - 1)));
              }
            },
          },
        },
      ],
      [
        documentFetcher,
        renderDocumentItem,
        renderTemplateItem,
        templateFetcher,
        refreshKey,
        activeTabKey,
      ],
    );

    const renderCommonItem = useCallback(
      (args: {
        key: string;
        index: number;
        onClick: () => void;
        title: string;
        icon: React.ReactNode;
        iconBg: string;
        iconColor: string;
        extraTag?: React.ReactNode;
      }) => (
        <List.Item
          key={args.key}
          onClick={args.onClick}
          role={navMode === 'items' ? 'option' : undefined}
          aria-selected={navMode === 'items' && args.index === activeIndex}
          style={{
            cursor: 'pointer',
            height: 38,
            paddingLeft: 4,
            background: navMode === 'items' && args.index === activeIndex ? '#f0f0f0' : undefined,
          }}
        >
          <div style={{ width: '100%', display: 'flex', alignItems: 'center' }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                flexShrink: 0,
                background: args.iconBg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: args.iconColor,
              }}
            >
              {args.icon}
            </div>
            <Text ellipsis style={{ flex: '1 1 auto', minWidth: 0 }}>
              {args.title}
            </Text>
            {args.extraTag ? (
              <span style={{ marginLeft: 'auto', flexShrink: 0 }}>{args.extraTag}</span>
            ) : null}
          </div>
        </List.Item>
      ),
      [navMode, activeIndex],
    );

    const listViewportHeight = Math.max(height - 40, 240);

    // reset index when tab changes
    useEffect(() => {
      setActiveIndex(0);
      setNavMode('tabs');
    }, [activeTabKey, refreshKey]);

    // Ensure selected item is visible when navigating in items mode
    useEffect(() => {
      if (navMode !== 'items') return;
      const root = containerRef.current;
      if (!root) return;
      const nodes = root.querySelectorAll('[role="option"]');
      const target = nodes?.[activeIndex] as HTMLElement | undefined;
      if (target && typeof target.scrollIntoView === 'function') {
        try {
          target.scrollIntoView({ block: 'nearest' });
        } catch (_) {
          // noop
        }
      }
    }, [navMode, activeIndex, activeTabKey, currentItems]);

    useEffect(() => {
      if (navMode !== 'tabs') return;
      const root = containerRef.current;
      if (!root) return;
      const scroller =
        (root.querySelector(
          '.tabbed-infinite-list-tabs .ant-tabs-tabpane-active .infinite-list > div',
        ) as HTMLElement | null) ||
        (root.querySelector('.infinite-list > div') as HTMLElement | null);
      if (scroller) {
        requestAnimationFrame(() => {
          scroller.scrollTop = 0;
        });
      }
    }, [navMode, activeTabKey]);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLDivElement>) => {
        // Tabs navigation mode: Up/Down switches tab; Right enters items
        if (navMode === 'tabs') {
          if (e.key === 'ArrowRight') {
            e.preventDefault();
            setNavMode('items');
            setActiveIndex(0);
            return;
          }
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            const order = ['templates', 'documents'];
            const currIdx = Math.max(0, order.indexOf(activeTabKey || order[0]));
            const nextIdx = e.key === 'ArrowDown' ? currIdx + 1 : currIdx - 1;
            const clampedIdx = Math.max(0, Math.min(order.length - 1, nextIdx));
            const nextKey = order[clampedIdx];
            if (nextKey !== activeTabKey) {
              onActiveTabChange?.(nextKey);
              setActiveIndex(0);
            }
            return;
          }
          if (e.key === 'Backspace') {
            e.preventDefault();
            onClose?.();
            return;
          }
        }

        // Items navigation mode: Up/Down moves selection; Left returns to tabs
        if (navMode === 'items') {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex((idx) => Math.min(idx + 1, Math.max(0, currentItems.length - 1)));
            return;
          }
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex((idx) => Math.max(idx - 1, 0));
            return;
          }
          if (e.key === 'ArrowLeft' || e.key === 'Backspace') {
            e.preventDefault();
            // Switch back to tabs mode without changing activeTabKey
            setNavMode('tabs');
            setActiveIndex(0);
            return;
          }
        }

        // Common actions
        if (e.key === 'Enter') {
          e.preventDefault();
          if (navMode !== 'items') return;
          const item = currentItems[activeIndex];
          if (!item) return;
          if (activeTabKey === 'documents') {
            onSelectDocument?.(item.raw);
          } else {
            onSelectTemplate?.(item.raw);
          }
          onClose?.();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          onClose?.();
        }
      },
      [
        navMode,
        activeTabKey,
        activeIndex,
        currentItems,
        onActiveTabChange,
        onClose,
        onSelectDocument,
        onSelectTemplate,
      ],
    );

    return (
      <div
        style={{
          minWidth: 320,
          height,
          display: 'flex',
          flexDirection: 'column',
          minHeight: height,
          outline: 'none',
          padding: 8,
        }}
        tabIndex={0}
        ref={containerRef}
        onKeyDown={handleKeyDown}
        role="listbox"
      >
        {/* @ts-expect-error Using JS component without TS types */}
        <TabbedInfiniteList
          tabs={tabs as any}
          listHeight={listViewportHeight}
          className={`reference-picker ${navMode === 'items' ? 'nav-mode-items' : 'nav-mode-tabs'}`}
          activeKey={activeTabKey}
          onTabChange={onActiveTabChange}
          enableSearch={false}
        />
      </div>
    );
  },
);

export default ReferencePicker;
