import api from './index';

// Get all skills (filtered by params like scope)
export const getSkills = async (params) => {
  return await api.get('/skills', {
    params,
  });
};

// Convenience method for Organization skills
export const getOrganizationSkills = async (params) => {
  return await api.get('/skills/organization', { params });
};

// Convenience method for System skills
export const getSystemSkills = async (params) => {
  return await api.get('/skills/system', { params });
};

// Convenience method for Package skills
export const getPackageSkills = async (params) => {
  return await api.get('/skills/package', { params });
};

// Keep for backward compatibility if needed, or deprecate
export const getAvailableSkills = getSkills;

// Install skill from Git
export const installSkill = async (url) => {
  return await api.post('/skills/install', { url });
};

// Uninstall skill repository
export const uninstallSkill = async (repoFolderName) => {
  return await api.post('/skills/uninstall', { repoFolderName });
};
