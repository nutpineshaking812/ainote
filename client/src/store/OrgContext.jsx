import React, { createContext, useState, useContext, useEffect, useCallback, useMemo } from 'react';
import { getMyOrganizations, switchOrganization } from '../api/organizations';
import { useAuth } from './AuthContext';

const OrgContext = createContext();

export const useOrg = () => {
  const context = useContext(OrgContext);
  if (!context) {
    throw new Error('useOrg must be used within an OrgProvider');
  }
  return context;
};

/** Sort organizations so PERSONAL workspace always comes first. */
const sortOrganizations = (orgs = []) =>
  [...orgs].sort((a, b) => {
    if (a.type === 'PERSONAL') return -1;
    if (b.type === 'PERSONAL') return 1;
    return 0;
  });

export const OrgProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [organizations, setOrganizations] = useState([]);
  const [currentOrganization, setCurrentOrganization] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(!!localStorage.getItem('token'));
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState(null);

  // Defined first so loadOrganizations can reference it safely
  const switchToOrganization = useCallback(async (organizationId) => {
    try {
      const data = await switchOrganization(organizationId);
      setCurrentOrganization(data.organization);
      setPermissions(data.permissions || []);
      localStorage.setItem('currentOrganizationId', organizationId);
    } catch (err) {
      console.error('Failed to switch organization:', err);
      throw err;
    }
  }, []);

  const loadOrganizations = useCallback(async () => {
    if (!localStorage.getItem('token')) return;

    try {
      setLoading(true);
      setError(null);
      const data = await getMyOrganizations();
      const sorted = sortOrganizations(data.organizations);
      setOrganizations(sorted);

      const savedOrgId = localStorage.getItem('currentOrganizationId');
      const target = savedOrgId && sorted.find((org) => org.id === savedOrgId);
      await switchToOrganization(target ? savedOrgId : sorted[0]?.id);
    } catch (err) {
      console.error('Failed to load organizations:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [switchToOrganization]);

  // Initialize from login/register response — avoids an extra API round-trip
  const initializeOrganizations = useCallback((orgs, currentOrgId, perms) => {
    const sorted = sortOrganizations(orgs);
    setOrganizations(sorted);

    const org = currentOrgId
      ? sorted.find((o) => o.id === currentOrgId)
      : sorted[0];

    if (org) {
      setCurrentOrganization(org);
      localStorage.setItem('currentOrganizationId', org.id);
    }

    if (perms) setPermissions(perms);
    setInitialized(true);
    setLoading(false);
    setError(null);
  }, []);

  // Load organizations when authenticated (skip if already initialized by login flow)
  useEffect(() => {
    if (isAuthenticated && !initialized) {
      loadOrganizations();
    } else if (!isAuthenticated) {
      setOrganizations([]);
      setCurrentOrganization(null);
      setPermissions([]);
      setInitialized(false);
      setError(null);
    }
  }, [isAuthenticated, initialized, loadOrganizations]);

  const hasPermission = useCallback(
    (permission) => permissions.includes(permission),
    [permissions],
  );

  const hasAnyPermission = useCallback(
    (permissionList) => permissionList.some((p) => permissions.includes(p)),
    [permissions],
  );

  const value = useMemo(
    () => ({
      organizations,
      currentOrganization,
      permissions,
      loading,
      error,
      isPersonalMode: currentOrganization?.type === 'PERSONAL',
      switchToOrganization,
      hasPermission,
      hasAnyPermission,
      loadOrganizations,
      refreshOrganizations: loadOrganizations,
      initializeOrganizations,
    }),
    [
      organizations,
      currentOrganization,
      permissions,
      loading,
      error,
      switchToOrganization,
      hasPermission,
      hasAnyPermission,
      loadOrganizations,
      initializeOrganizations,
    ],
  );

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
};
