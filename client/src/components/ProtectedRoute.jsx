import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import { useOrg } from '../store/OrgContext';
import { Spin, Result, Button } from 'antd';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { organizations, loading: orgLoading, error: orgError, refreshOrganizations } = useOrg();
  const location = useLocation();

  // Show loading while checking auth or org status
  if (authLoading || orgLoading) {
    return (
      <Spin
        size="large"
        style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}
      />
    );
  }

  // Check authentication first
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Handle organization loading error (backend unavailable)
  if (orgError) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f0f2f5' }}>
        <Result
          status="500"
          title="Remote Service Unavailable"
          subTitle="We're having trouble connecting to the backend server. Please check your connection or try again later."
          extra={
            <Button type="primary" onClick={refreshOrganizations}>
              Retry Connection
            </Button>
          }
        />
      </div>
    );
  }

  // Check organization status (but allow access to onboarding page)
  const hasOrganization = organizations && organizations.length > 0;
  const isOnboardingPage = location.pathname === '/onboarding';

  // If no organization and not on onboarding page, redirect to onboarding
  if (!hasOrganization && !isOnboardingPage) {
    return <Navigate to="/onboarding" replace />;
  }

  // If has organization and on onboarding page, redirect to dashboard
  if (hasOrganization && isOnboardingPage) {
    return <Navigate to="/" replace />;
  }

  // Render children if provided, otherwise render Outlet for nested routes
  return children || <Outlet />;
};

export default ProtectedRoute;
