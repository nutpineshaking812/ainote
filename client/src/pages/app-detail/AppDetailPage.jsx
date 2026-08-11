import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Button, message, Tooltip, Splitter } from 'antd';
import { MenuUnfoldOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import './AppDetailPage.css';
import { getApp } from '../../api/apps';
import { touchRecent as apiPushRecentApp } from '../../api/dashboard';
import ResourceTreeProvider from '../../features/resource-tree/context/ResourceTreeContext';
import { AppResourcesProvider, useAppResources } from './context/AppResourcesContext';
import useResourceRouting from './hooks/useResourceRouting';
import AppSidebar from './components/AppSidebar';
import ResourceContentArea from './components/ResourceContentArea';
import resourceEventBus from './utils/resourceEventBus';
import useAppStore from '../../store/useAppStore';

const { Content } = Layout;

/**
 * Inner component that uses context hooks
 */
const AppDetailPageInner = ({ appId, appName }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { siderCollapsed, setSiderCollapsed } = useAppResources();

  // Initialize routing synchronization
  useResourceRouting();

  const toggleSider = useCallback(() => setSiderCollapsed((v) => !v), [setSiderCollapsed]);

  // Handle resource deletion callback
  const handleAfterDelete = useCallback((deletedId) => {
    // Emit event for other components to react
    resourceEventBus.emit('resource:deleted', { id: deletedId });
  }, []);

  // Listen to resource events for cross-component coordination
  useEffect(() => {
    const handleResourceCreated = ({ type, id }) => {
      // Could trigger notifications or analytics here
    };

    const handleResourceDeleted = ({ type, id }) => {
      // Could trigger cleanup or notifications here
    };

    resourceEventBus.on('resource:created', handleResourceCreated);
    resourceEventBus.on('resource:deleted', handleResourceDeleted);

    return () => {
      resourceEventBus.off('resource:created', handleResourceCreated);
      resourceEventBus.off('resource:deleted', handleResourceDeleted);
    };
  }, []);

  return (
    <Layout style={{ height: '100vh', background: 'transparent' }}>
      <ResourceTreeProvider>
        <Splitter
          style={{ height: '100%', background: 'transparent' }}
          styles={{
            dragger: {
              // display: 'none',
            },
          }}
        >
          <Splitter.Panel
            min={200}
            max={420}
            defaultSize={260}
            size={siderCollapsed ? 0 : undefined}
            onResize={(size) => {
              if (size === 0 && !siderCollapsed) {
                setSiderCollapsed(true);
              } else if (size > 0 && siderCollapsed) {
                setSiderCollapsed(false);
              }
            }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              background: '#fbfbfa',
            }}
          >
            <AppSidebar appName={appName} />
          </Splitter.Panel>

          <Splitter.Panel>
            <Content style={{ height: '100%', overflow: 'hidden', background: '#fff' }}>
              <ResourceContentArea onAfterDelete={handleAfterDelete} />
            </Content>
          </Splitter.Panel>
        </Splitter>
      </ResourceTreeProvider>
    </Layout>
  );
};

/**
 * Main page component with context provider
 */
const AppDetailPage = () => {
  const { t } = useTranslation();
  const { appId } = useParams();
  const location = useLocation();
  const setCurrentAppId = useAppStore((state) => state.setCurrentAppId);

  // Initialize appName from location state if available (passed from dashboard)
  const [appName, setAppName] = useState(location.state?.appName || '');

  // Sync appName from location state when route changes (e.g. from Sidebar switcher)
  useEffect(() => {
    if (location.state?.appName) {
      setAppName(location.state.appName);
    } else {
      // If no state, we might need to fetch it (handled by fetchAppData effect)
      // but we should clear the old names to prevent stale titles
      setAppName('');
    }
  }, [location.state?.appName, appId]);

  useEffect(() => {
    if (appId) {
      setCurrentAppId(appId);
    }
    return () => {
      // Clear global appId when leaving the app detail scope
      setCurrentAppId(null);
    };
  }, [appId, setCurrentAppId]);

  useEffect(() => {
    const recordRecent = async () => {
      try {
        await apiPushRecentApp({ refId: appId, refType: 'Application' });
      } catch (err) {
        console.error(t('appDetail.pushRecentFailed'), err);
      }
    };

    const fetchAppData = async () => {
      // Only fetch if we don't have a name yet
      if (appName) return;

      try {
        const appData = await getApp(appId);
        if (appData?.name) {
          setAppName(appData.name);
        }
      } catch (error) {
        message.error(error.message || t('appDetail.loadAppFailed'));
      }
    };

    if (appId) {
      recordRecent();
      fetchAppData();
    }
  }, [appId, appName, t]);

  return (
    <AppResourcesProvider appId={appId} appName={appName}>
      <AppDetailPageInner appId={appId} appName={appName} />
    </AppResourcesProvider>
  );
};

export default AppDetailPage;
