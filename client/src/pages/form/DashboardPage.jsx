import React from 'react';
import { useOrg } from '../../store/OrgContext';
import PersonalWorkspaceDashboard from '../../features/dashboard/PersonalWorkspaceDashboard';
import TeamWorkspaceDashboard from '../../features/dashboard/TeamWorkspaceDashboard';
import { getApps } from '../../api/apps';
import { useNavigate } from 'react-router-dom';
import { Spin } from 'antd';

const DashboardPage = () => {
  const { isPersonalMode } = useOrg();
  const navigate = useNavigate();
  const [loading, setLoading] = React.useState(isPersonalMode);

  React.useEffect(() => {
    if (isPersonalMode) {
      const redirectToApp = async () => {
        try {
          const apps = await getApps();
          if (apps && apps.length > 0) {
            navigate(`/apps/${apps[0].id}`, { replace: true, state: { appName: apps[0].name } });
          } else {
            setLoading(false);
          }
        } catch (err) {
          console.error('Failed to auto-redirect to app', err);
          setLoading(false);
        }
      };
      redirectToApp();
    }
  }, [isPersonalMode, navigate]);

  if (loading) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          background: '#f5f7fa',
        }}
      >
        <Spin size="large" tip="Entering Studio..." />
      </div>
    );
  }

  // Each dashboard component now handles its own Layout wrapper and PageHeader
  // this allows for more flexible UI differentiation between personal and team modes.
  return isPersonalMode ? <PersonalWorkspaceDashboard /> : <TeamWorkspaceDashboard />;
};

export default DashboardPage;
