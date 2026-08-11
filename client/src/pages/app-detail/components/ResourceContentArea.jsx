import React from 'react';
import { useTranslation } from 'react-i18next';
import { Skeleton } from 'antd';
import { useAppResources } from '../context/AppResourcesContext';
import useAppStore from '../../../store/useAppStore';
import { PRELOAD_MAP } from '../hooks/useResourceRouting';

const FormResourcePanel = React.lazy(PRELOAD_MAP.form);
const ViewResourcePanel = React.lazy(PRELOAD_MAP.view);
const DocumentResourcePanel = React.lazy(PRELOAD_MAP.document);
const PdfResourcePanel = React.lazy(PRELOAD_MAP.pdf);
const MediaResourcePanel = React.lazy(() => import('./MediaResourcePanel'));
const FolderResourcePanel = React.lazy(() => import('./FolderResourcePanel'));
const DefaultResourcePanel = React.lazy(() => import('./DefaultResourcePanel'));
import AppHome from './AppHome';

const AgentPlayroom = React.lazy(() => import('../../../features/chat/components/AgentPlayroom'));
import { AgentPlayroomProvider } from '../../../features/chat/context/AgentPlayroomContext';

/**
 * Empty state when no resource is selected
 */
const EmptyState = ({ hasResources }) => {
  const { t } = useTranslation();
  return (
    <div style={{ textAlign: 'center', color: '#888', marginTop: 80 }}>
      {hasResources
        ? t('resourceContentArea.selectResource')
        : t('resourceContentArea.noResources')}
    </div>
  );
};

/**
 * Factory component for rendering the appropriate resource panel
 */
const ResourcePanelFactory = ({ resource, onAfterDelete }) => {
  const appId = useAppStore((state) => state.currentAppId);
  const { t } = useTranslation();

  if (!resource) return null;
  // console.log('ResourcePanelFactory', resource);

  switch (resource.type) {
    case 'playroom':
      return (
        <AgentPlayroomProvider>
          <AgentPlayroom />
        </AgentPlayroomProvider>
      );
    case 'form':
      return <FormResourcePanel appId={appId} resource={resource} onAfterDelete={onAfterDelete} />;
    case 'view':
      return <ViewResourcePanel appId={appId} resource={resource} />;
    case 'document':
      return <DocumentResourcePanel key="document-panel" appId={appId} resource={resource} />;
    case 'pdf':
      return <PdfResourcePanel appId={appId} resource={resource} />;
    case 'video':
    case 'audio':
    case 'mp4':
    case 'mp3':
      return <MediaResourcePanel resource={resource} onAfterDelete={onAfterDelete} />;
    case 'folder':
      return <FolderResourcePanel resource={resource} onAfterDelete={onAfterDelete} />;
    default:
      return <DefaultResourcePanel appId={appId} resource={resource} onAfterDelete={onAfterDelete} />;
  }
};

/**
 * Main content area that displays the selected resource panel
 */
const ResourceContentArea = ({ onAfterDelete }) => {
  const { selectedResource, loadingResources, isRoutingReady } = useAppResources();

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {(!isRoutingReady || loadingResources) && !selectedResource ? (
        <div style={{ padding: 24 }}>
          <Skeleton active paragraph={{ rows: 12 }} />
        </div>
      ) : selectedResource ? (
        <React.Suspense
          fallback={
            <div style={{ padding: 24 }}>
              <Skeleton active paragraph={{ rows: 12 }} />
            </div>
          }
        >
          <ResourcePanelFactory resource={selectedResource} onAfterDelete={onAfterDelete} />
        </React.Suspense>
      ) : (
        <AppHome />
      )}
    </div>
  );
};

export default ResourceContentArea;
