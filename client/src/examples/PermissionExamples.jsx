// ============================================
// 快速开始：权限控制系统使用示例
// ============================================

import React from 'react';
import { Button, Space, Menu } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';

// 导入权限组件和 Hook
import Permission from '../components/Permission';
import { usePermissionState } from '../hooks/usePermissionState';
import { PERMISSIONS, APP_PERMISSIONS } from '../constants/permissions';

// ============================================
// 示例 1: 使用 Permission 组件控制按钮显示
// ============================================
export const Example1_ButtonControl = () => {
  return (
    <Space>
      {/* 只有拥有 APP_CREATE 权限的用户才能看到此按钮 */}
      <Permission require="APP_CREATE" scope="org">
        <Button type="primary" icon={<PlusOutlined />}>
          新建应用
        </Button>
      </Permission>

      {/* 只有拥有 MANAGE 权限的用户才能看到此按钮 */}
      <Permission require="MANAGE" scope="app">
        <Button icon={<EditOutlined />}>编辑</Button>
      </Permission>

      {/* 只有拥有 APP_DELETE 权限的用户才能看到此按钮 */}
      <Permission require="APP_DELETE" scope="org">
        <Button danger icon={<DeleteOutlined />}>
          删除应用
        </Button>
      </Permission>
    </Space>
  );
};

// ============================================
// 示例 2: 使用 Hook 批量检查权限
// ============================================
export const Example2_HookUsage = () => {
  // 一次性检查多个权限
  const can = usePermissionState({
    createApp: { permission: 'APP_CREATE', scope: 'org' },
    deleteApp: { permission: 'APP_DELETE', scope: 'org' },
    manageApp: { permission: 'MANAGE', scope: 'app' },
    viewData: { permission: 'VIEW', scope: 'app' },
  });

  return (
    <Space>
      {can.createApp && <Button type="primary">新建应用</Button>}
      {can.deleteApp && <Button danger>删除应用</Button>}
      {can.manageApp && <Button>编辑</Button>}
      {can.viewData && <Button>查看数据</Button>}
    </Space>
  );
};

// ============================================
// 示例 3: 表格操作列权限控制
// ============================================
export const Example3_TableActions = () => {
  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space>
          {/* 编辑按钮 - 需要 MANAGE 权限 */}
          <Permission require="MANAGE" scope="app">
            <Button type="link" onClick={() => handleEdit(record)}>
              编辑
            </Button>
          </Permission>

          {/* 删除按钮 - 需要 MANAGE 权限 */}
          <Permission require="MANAGE" scope="app">
            <Button type="link" danger onClick={() => handleDelete(record)}>
              删除
            </Button>
          </Permission>
        </Space>
      ),
    },
  ];

  return <Table columns={columns} dataSource={data} />;
};

// ============================================
// 示例 4: 下拉菜单权限控制
// ============================================
export const Example4_DropdownMenu = ({ app }) => {
  const menu = (
    <Menu>
      {/* 编辑 - 需要 MANAGE 权限 */}
      <Permission require="MANAGE" scope="app">
        <Menu.Item key="edit" onClick={() => handleEdit(app)}>
          编辑应用
        </Menu.Item>
      </Permission>

      {/* 设置 - 需要 MANAGE 权限 */}
      <Permission require="MANAGE" scope="app">
        <Menu.Item key="settings" onClick={() => goToSettings(app)}>
          应用设置
        </Menu.Item>
      </Permission>

      {/* 删除 - 需要 APP_DELETE 权限 */}
      <Permission require="APP_DELETE" scope="org">
        <Menu.Item key="delete" danger onClick={() => handleDelete(app)}>
          删除应用
        </Menu.Item>
      </Permission>
    </Menu>
  );

  return (
    <Dropdown overlay={menu} trigger={['click']}>
      <Button>操作</Button>
    </Dropdown>
  );
};

// ============================================
// 示例 5: 复杂条件权限控制
// ============================================
export const Example5_ComplexConditions = () => {
  const can = usePermissionState({
    manage: { permission: 'MANAGE', scope: 'app' },
    view: { permission: 'VIEW', scope: 'app' },
  });

  // 根据权限显示不同的内容
  if (can.manage) {
    return <FullEditor />;
  } else if (can.view) {
    return <ReadOnlyViewer />;
  } else {
    return <NoAccessMessage />;
  }
};

// ============================================
// 示例 6: 无权限时显示替代内容
// ============================================
export const Example6_Fallback = () => {
  return (
    <Permission
      require="MANAGE"
      scope="app"
      fallback={<Empty description="您没有权限查看此内容" />}
    >
      <SensitiveDataPanel />
    </Permission>
  );
};

// ============================================
// 示例 7: 满足任一权限即可
// ============================================
export const Example7_RequireAny = () => {
  return (
    <Permission requireAny={['MANAGE', 'VIEW']} scope="app">
      <DataTable />
    </Permission>
  );
};

// ============================================
// 示例 8: 必须同时满足多个权限
// ============================================
export const Example8_RequireAll = () => {
  return (
    <Permission requireAll={['ORG_MANAGE', 'MEMBER_MANAGE']} scope="org">
      <AdvancedAdminPanel />
    </Permission>
  );
};
