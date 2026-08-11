import React, { useState, useEffect, useMemo } from 'react';
import {
  createBrowserRouter,
  createHashRouter,
  createRoutesFromElements,
  Route,
  RouterProvider,
} from 'react-router-dom';
import { isTauri } from './utils/platform';
import { App as AntdApp, ConfigProvider } from 'antd';
import { useTranslation } from 'react-i18next';
import './utils/dayjs'; // Import configured dayjs
import enUS from 'antd/locale/en_US';
import zhCN from 'antd/locale/zh_CN';
import theme from './theme'; // Import the custom theme
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import OnboardingOrganization from './pages/OnboardingOrganization.jsx';
import DashboardPage from './pages/form/DashboardPage.jsx';
import AppDetailPage from './pages/app-detail/AppDetailPage.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';

// Lazy load heavy components for extreme performance optimization
const FormBuilderPage = React.lazy(() => import('./pages/form/FormBuilderPage.jsx'));
const CreateViewPage = React.lazy(() => import('./pages/views/CreateViewPage.jsx'));
const WorkflowDesigner = React.lazy(() => import('./pages/workflow/WorkflowDesigner.jsx'));
const WorkflowListPage = React.lazy(() => import('./pages/workflow/WorkflowListPage.jsx'));
const WorkflowHistoryPage = React.lazy(() => import('./pages/workflow/WorkflowHistoryPage.jsx'));
const WorkflowExecutionDetailPage = React.lazy(
  () => import('./pages/workflow/WorkflowExecutionDetailPage.jsx'),
);
const EChartsDemo = React.lazy(() => import('./pages/EChartsDemo.jsx'));
const UnifiedChatDemo = React.lazy(() => import('./pages/UnifiedChatDemo.tsx'));
const AgentDockDemo = React.lazy(() => import('./pages/AgentDockDemo.jsx'));
const EmbeddedEmployeePage = React.lazy(() => import('./pages/embed/EmbeddedEmployeePage.jsx'));
const IntegrationDemoPage = React.lazy(() => import('./pages/embed/IntegrationDemoPage.jsx'));
import PermissionRoute from './components/PermissionRoute.jsx';
import AppPermissionGuard from './components/AppPermissionGuard.jsx';
import { PERMISSIONS, APP_PERMISSIONS } from './constants/permissions';
import './App.css';
import PublicFormFillPage from './pages/public/PublicFormFillPage.jsx';
import PublicQueryPage from './pages/public/PublicQueryPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import GenericTreeDemo from './components/common/GenericTree/Demo.jsx';
import OrgSettingsPage from './pages/admin/OrgSettingsPage.jsx';
import OrgInfoPage from './pages/admin/OrgInfoPage.jsx';
import TeamManagementPage from './pages/admin/TeamManagementPage.jsx';
import OrgInvitationsPage from './pages/admin/OrgInvitationsPage.jsx';
import ConsumptionLedgerPage from './pages/admin/ConsumptionLedgerPage.jsx';
import AdminsPage from './pages/admin/AdminsPage.jsx';
import RoleTemplatesPage from './pages/admin/RoleTemplatesPage.jsx';
import OrgWidgetsPage from './pages/admin/OrgWidgetsPage.jsx';
import SkillListPage from './pages/admin/skills/SkillListPage.jsx';
import CategoryMgmtPage from './pages/admin/CategoryMgmtPage.jsx';
import McpManagementPage from './pages/admin/skills/McpManagementPage.jsx';
import EmployeeListPage from './pages/digital-employees/EmployeeListPage.jsx';
import KnowledgeSetListPage from './pages/knowledge-sets/KnowledgeSetListPage.jsx';
import KnowledgeSetDetailPage from './pages/knowledge-sets/KnowledgeSetDetailPage.jsx';
import { AgentPlayroom } from './features/chat/components/AgentPlayroom.jsx';
import { AgentPlayroomProvider } from './features/chat/context/AgentPlayroomContext.jsx';

import AdminLayout from './pages/admin/layout/AdminLayout.jsx';
// App Settings
import AppSettingsLayout from './pages/app-settings/AppSettingsLayout.jsx';
import AppInfoPage from './pages/app-settings/AppInfoPage.jsx';
import AppRolesMgmtPage from './pages/app-settings/AppRolesMgmtPage.jsx';
import AppMembersPage from './pages/app-settings/AppMembersPage.jsx';
import ResourcePermissionsPage from './pages/app-settings/ResourcePermissionsPage.jsx';
import AppDataRulesPage from './pages/app-settings/AppDataRulesPage.jsx';
import DeveloperPage from './pages/app-settings/DeveloperPage.jsx';
import AppAiLogicPage from './pages/app-settings/AppAiLogicPage.jsx';
import IntegrationsPage from './pages/app-settings/IntegrationsPage.jsx';
import AgentMemoryView from './pages/app-settings/memory/AgentMemoryView.jsx';
import { LocalDatabaseProvider } from './lib/local-db/LocalDatabaseContext';
import NoteEditor from './pages/BlockNoteDemo';

const localeMap = {
  en: enUS,
  zh: zhCN,
};

function App() {
  const { i18n } = useTranslation();
  const [locale, setLocale] = useState(enUS);

  useEffect(() => {
    setLocale(localeMap[i18n.language] || enUS);
  }, [i18n.language]);

  const router = useMemo(
    () => {
      const createRouter = isTauri ? createHashRouter : createBrowserRouter;
      return createRouter(
        createRoutesFromElements(
          <>
            {/* Public Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/public/forms/:formId/fill" element={<PublicFormFillPage />} />
            <Route path="/public/forms/:formId/query" element={<PublicQueryPage />} />
            <Route
              path="/unified-chat-demo"
              element={
                <React.Suspense fallback={null}>
                  <UnifiedChatDemo />
                </React.Suspense>
              }
            />
            <Route
              path="/agent-dock-demo"
              element={
                <React.Suspense fallback={null}>
                  <AgentDockDemo />
                </React.Suspense>
              }
            />
            <Route path="blocknote" element={<NoteEditor />} />

            {/* 数字员工内嵌页面（公开路由，通过 API Key 鉴权） */}
            <Route
              path="/embed/employee"
              element={
                <React.Suspense fallback={null}>
                  <EmbeddedEmployeePage />
                </React.Suspense>
              }
            />

            {/* 数字员工集成示例页面 */}
            <Route
              path="/embed/demo"
              element={
                <React.Suspense fallback={null}>
                  <IntegrationDemoPage />
                </React.Suspense>
              }
            />

            {/* Protected Routes */}
            <Route element={<ProtectedRoute />}>
              {/* Onboarding - requires auth but handles org check specially */}
              <Route path="/" element={<DashboardPage />} />
              <Route path="/onboarding" element={<OnboardingOrganization />} />
              <Route path="/profile" element={<ProfilePage />} />
              {/* App Scoped Routes */}
              <Route path="/apps/:appId" element={<AppPermissionGuard />}>
                <Route index element={<AppDetailPage />} />
                <Route path="forms/:formId" element={<FormBuilderPage />} />
                <Route path="views/:viewId" element={<CreateViewPage />} />
                <Route path="workflows" element={<WorkflowListPage />} />
                <Route path="digital-employees" element={<EmployeeListPage />} />
                <Route path="digital-employees/:employeeId" element={<EmployeeListPage />} />
                <Route path="knowledge-sets" element={<KnowledgeSetListPage />} />
                <Route path="knowledge-sets/:id" element={<KnowledgeSetDetailPage />} />
                <Route
                  path="workflows/:workflowId"
                  element={
                    <React.Suspense fallback={null}>
                      <WorkflowDesigner />
                    </React.Suspense>
                  }
                />
                <Route
                  path="workflows/:workflowId/history"
                  element={
                    <React.Suspense fallback={null}>
                      <WorkflowHistoryPage />
                    </React.Suspense>
                  }
                />
                <Route
                  path="workflows/:workflowId/history/:executionId"
                  element={
                    <React.Suspense fallback={null}>
                      <WorkflowExecutionDetailPage />
                    </React.Suspense>
                  }
                />
                <Route path="integrations" element={<IntegrationsPage />} />
                <Route
                  path="playroom"
                  element={
                    <AgentPlayroomProvider>
                      <AgentPlayroom />
                    </AgentPlayroomProvider>
                  }
                />

                {/* App Settings Routes */}
                <Route
                  element={
                    <PermissionRoute
                      requireAny={[APP_PERMISSIONS.APP_MANAGE]}
                      scope={['org', 'app']}
                    >
                      <AppSettingsLayout />
                    </PermissionRoute>
                  }
                >
                  <Route path="settings/info" element={<AppInfoPage />} />
                  <Route path="settings/permissions" element={<AppRolesMgmtPage />} />
                  <Route path="settings/permissions/roles" element={<AppRolesMgmtPage />} />
                  <Route path="settings/permissions/members" element={<AppMembersPage />} />
                  <Route
                    path="settings/permissions/resources"
                    element={<ResourcePermissionsPage />}
                  />
                  <Route path="settings/permissions/data" element={<AppDataRulesPage />} />
                  <Route path="settings/ai/logic" element={<AppAiLogicPage />} />
                  <Route path="settings/ai/memory" element={<AgentMemoryView />} />
                  <Route path="settings/integrations" element={<IntegrationsPage />} />
                  <Route path="settings/developer" element={<DeveloperPage />} />
                </Route>
              </Route>

              {/* Organization/Independent Workflows */}
              <Route
                path="/organization/workflows/:workflowId"
                element={
                  <PermissionRoute
                    requireAny={[PERMISSIONS.ORG_MANAGE]} // or appropriate permission for editing org skills?
                    scope="org"
                  >
                    <WorkflowDesigner />
                  </PermissionRoute>
                }
              />

              {/* Admin Routes with Sidebar Layout */}
              <Route
                path="/admin"
                element={
                  <PermissionRoute
                    requireAny={[
                      PERMISSIONS.ORG_MANAGE,
                      PERMISSIONS.MEMBER_MANAGE,
                      PERMISSIONS.ROLE_MANAGE,
                      PERMISSIONS.DEPT_MANAGE,
                      PERMISSIONS.WIDGET_MANAGE,
                    ]}
                    scope="org"
                  >
                    <AdminLayout />
                  </PermissionRoute>
                }
              >
                <Route path="organization" element={<OrgInfoPage />} />
                <Route path="enterprise" element={<OrgInfoPage />} />
                <Route path="team" element={<TeamManagementPage />} />
                <Route path="invitations" element={<OrgInvitationsPage />} />
                <Route path="ledger" element={<ConsumptionLedgerPage />} />
                <Route path="roles" element={<AdminsPage />} />
                <Route path="app-role-templates" element={<RoleTemplatesPage />} />
                <Route path="widgets" element={<OrgWidgetsPage />} />
                <Route path="skills" element={<SkillListPage />} />
                <Route path="mcp" element={<McpManagementPage />} />
                <Route path="categories" element={<CategoryMgmtPage />} />

                <Route path="settings" element={<OrgSettingsPage />} />
              </Route>
            </Route>
          </>,
        ),
      );
    },
    [],
  );

  return (
    <ConfigProvider theme={theme} locale={locale}>
      <AntdApp>
        <LocalDatabaseProvider>
          <RouterProvider router={router} />
        </LocalDatabaseProvider>
      </AntdApp>
    </ConfigProvider>
  );
}

export default App;
