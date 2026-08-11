import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Empty, Input, Tabs } from 'antd';
import { ArrowLeftOutlined, SearchOutlined } from '@ant-design/icons';
import InfiniteList from './InfiniteList';
import './TabbedInfiniteList.css';

const TabsLayout = ({ tabs, activeKey, onTabChange, tabBarExtraContent }) => {
  const tabItems = tabs.map((tab) => ({
    key: tab.key,
    label: tab.label,
    disabled: tab.disabled,
    children: tab.children,
    style: { height: '100%', paddingLeft: 5, margin: 0 },
    className: 'tabbed-infinite-list-tabpane',
  }));

  return (
    <Tabs
      tabPosition="left"
      activeKey={activeKey}
      onChange={onTabChange}
      items={tabItems}
      type="line"
      style={{
        height: '100%',
      }}
      styles={{
        content: { height: '100%' },
        item: { margin: 0 },
      }}
      rootClassName="tabbed-infinite-list-tabs"
      tabBarExtraContent={tabBarExtraContent}
      renderTabBar={(tabBarProp, DefaultTabBar) => {
        return (
          <div
            className="tabbed-infinite-list-tabbar"
            style={{
              outline: 'none',
              padding: 0,
            }}
          >
            <DefaultTabBar {...tabBarProp} />
          </div>
        );
      }}
    />
  );
};

const SearchLayout = ({
  inputRef,
  keyword,
  onKeywordChange,
  onInputFocus,
  onInputBlur,
  onSubmit,
  onExit,
  placeholder,
  listNode,
  listHeight,
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={onExit} type="text">
          返回
        </Button>
        <Input
          ref={inputRef}
          placeholder={placeholder}
          allowClear
          value={keyword}
          onChange={onKeywordChange}
          onFocus={onInputFocus}
          onBlur={onInputBlur}
          onPressEnter={onSubmit}
        />
        <Button type="primary" onClick={onSubmit} icon={<SearchOutlined />}>
          搜索
        </Button>
      </div>
      <div style={{ flexGrow: 1, height: 0 }}>{listNode}</div>
    </div>
  );
};

const TabbedInfiniteList = ({
  tabs = [],
  defaultActiveKey,
  activeKey: controlledActiveKey,
  className,
  onTabChange,
  onSearch,
  onSearchChange,
  searchPlaceholder = '搜索当前列表',
  searchButtonText = '搜索',
  listHeight = 460,
  searchFetchPage,
  searchRenderItem,
  searchItemKey = 'id',
  searchListProps = {},
  searchInfiniteListProps = {},
  searchEmptyDescription = '暂无搜索结果',
  enableSearch = true,
}) => {
  const derivedDefaultKey = defaultActiveKey || tabs[0]?.key;
  const isControlled = typeof controlledActiveKey !== 'undefined';
  const [internalActiveKey, setInternalActiveKey] = useState(derivedDefaultKey);
  const activeKey = isControlled ? controlledActiveKey : internalActiveKey;
  const [mode, setMode] = useState('tabs');
  const [searchValue, setSearchValue] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);

  const searchInputRef = useRef(null);
  const trimmedSearchValue = searchValue.trim();
  const allowSearch = enableSearch && typeof searchFetchPage === 'function';

  useEffect(() => {
    if (!tabs.length) {
      if (!isControlled) {
        setInternalActiveKey(undefined);
      }
      return;
    }
    if (!activeKey || !tabs.find((tab) => tab.key === activeKey)) {
      const nextKey = tabs[0].key;
      if (!isControlled) {
        setInternalActiveKey(nextKey);
      }
      onTabChange?.(nextKey);
    }
  }, [tabs, activeKey, isControlled, onTabChange]);

  const activeTab = useMemo(() => tabs.find((tab) => tab.key === activeKey), [tabs, activeKey]);

  const searchFetcher = useMemo(() => {
    if (!allowSearch) return null;
    return (page, pageSize, lastId) =>
      searchFetchPage({
        keyword: trimmedSearchValue,
        page,
        pageSize,
        lastId,
        activeTabKey: activeKey,
      });
  }, [allowSearch, searchFetchPage, trimmedSearchValue, activeKey]);

  const handleTabChange = useCallback(
    (key) => {
      if (!isControlled) {
        setInternalActiveKey(key);
      }
      onTabChange?.(key);
    },
    [isControlled, onTabChange],
  );

  const enterSearchMode = useCallback(() => {
    if (!allowSearch) return;
    setMode('search');
    setSearchFocused(true);
  }, [allowSearch]);

  const exitSearchMode = useCallback(() => {
    setMode('tabs');
    setSearchValue('');
    setSearchFocused(false);
    onSearchChange?.('', activeKey);
  }, [activeKey, onSearchChange]);

  useEffect(() => {
    if (mode === 'search' && allowSearch) {
      searchInputRef.current?.focus({ preventScroll: true });
    }
  }, [mode, allowSearch]);

  useEffect(() => {
    if (!allowSearch && mode === 'search') {
      setMode('tabs');
    }
  }, [allowSearch, mode]);

  //   useEffect(() => {
  //     if (mode !== 'search') return;
  //     if (!trimmedSearchValue && !searchFocused) {
  //       exitSearchMode();
  //     }
  //   }, [mode, trimmedSearchValue, searchFocused, exitSearchMode]);

  const handleSearchValueChange = useCallback(
    (e) => {
      const value = e?.target?.value ?? '';
      setSearchValue(value);
      onSearchChange?.(value, mode === 'search' ? 'search' : activeKey);
    },
    [onSearchChange, mode, activeKey],
  );

  const handleSearchSubmit = useCallback(() => {
    const keyword = searchValue.trim();
    onSearch?.(keyword, mode === 'search' ? 'search' : activeKey);
  }, [onSearch, searchValue, mode, activeKey]);

  const renderActiveList = (tab) => {
    if (!tab) {
      return <Empty description="暂无可用的标签" />;
    }
    if (typeof tab.fetchPage !== 'function') {
      return <Empty description="当前标签未配置数据源" />;
    }

    const {
      fetchPage,
      renderItem,
      itemKey,
      height: tabHeight,
      listProps: tabListProps,
      infiniteListProps = {},
    } = tab;

    return (
      <InfiniteList
        key={tab.key}
        fetchPage={fetchPage}
        renderItem={renderItem}
        itemKey={itemKey}
        height={tabHeight || listHeight}
        listProps={tabListProps}
        {...infiniteListProps}
      />
    );
  };

  const renderSearchList = () => {
    if (!searchFetcher) {
      return <Empty description={searchEmptyDescription} />;
    }

    const fallbackRender = tabs.find((tab) => typeof tab.renderItem === 'function')?.renderItem;
    const effectiveRenderItem = searchRenderItem || fallbackRender;
    if (typeof effectiveRenderItem !== 'function') {
      return <Empty description={searchEmptyDescription} />;
    }

    return (
      <InfiniteList
        key={`search-${trimmedSearchValue || 'all'}`}
        fetchPage={searchFetcher}
        renderItem={effectiveRenderItem}
        itemKey={searchItemKey}
        height={listHeight}
        listProps={searchListProps}
        refreshKey={`search-${trimmedSearchValue}`}
        emptyDescription={searchEmptyDescription}
        {...searchInfiniteListProps}
      />
    );
  };

  const containerClassName = ['tabbed-infinite-list', className].filter(Boolean).join(' ');
  const tabExtraSlot = allowSearch
    ? {
        right: (
          <Button
            icon={<SearchOutlined />}
            type="primary"
            onClick={enterSearchMode}
            style={{ marginBottom: 10 }}
          >
            {searchButtonText}
          </Button>
        ),
      }
    : undefined;

  if (mode === 'search' && allowSearch) {
    return (
      <div className={containerClassName} style={{ flexGrow: 1, height: 0 }}>
        <SearchLayout
          inputRef={searchInputRef}
          keyword={searchValue}
          onKeywordChange={handleSearchValueChange}
          onInputFocus={() => setSearchFocused(true)}
          onInputBlur={() => setSearchFocused(false)}
          onSubmit={handleSearchSubmit}
          onExit={exitSearchMode}
          placeholder={searchPlaceholder}
          listNode={renderSearchList()}
          listHeight={listHeight}
        />
      </div>
    );
  }

  const buildChildNodes = (tab) => {
    return renderActiveList(tab);
  };

  return (
    <div className={containerClassName} style={{ flexGrow: 1, height: 0 }}>
      <TabsLayout
        tabs={tabs.map((tab) => ({
          key: tab.key,
          label: tab.label,
          disabled: tab.disabled,
          children: tab.children ? tab.children : buildChildNodes(tab),
        }))}
        activeKey={activeKey}
        onTabChange={handleTabChange}
        tabBarExtraContent={tabExtraSlot}
      />
    </div>
  );
};

export default TabbedInfiniteList;
