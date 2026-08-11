import ApplicationRepository from '../repositories/application.repository.js';
import UserDashboardRepository from '../repositories/userDashboard.repository.js';
import OrganizationRepository from '../repositories/organization.repository.js';
import RoleRepository from '../repositories/role.repository.js';
import PermissionAssignmentRepository from '../repositories/permissionAssignment.repository.js';
import ApiKeyRepository from '../repositories/apiKey.repository.js';
import ApiError from '../utils/ApiError.js';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import ResourceRepository from '../repositories/resource.repository.js';

const getApplications = async (organizationId, userId) => {
  if (!organizationId) {
    throw ApiError.badRequest('Organization ID is required', 'ORG_ID_REQUIRED');
  }

  const { getAccessibleAppIds } = await import('./appPermission.service.js');
  const accessibleAppIds = await getAccessibleAppIds(userId, organizationId);

  if (accessibleAppIds.length === 0) {
    const org = await OrganizationRepository.findById(organizationId);
    if (org && org.type === 'PERSONAL') {
      const defaultApp = await createApplication(
        {
          name: '我的空间',
          description: '你的第一个个人工作空间',
          icon: 'RocketOutlined',
          iconColor: '#00b96b',
        },
        userId,
        organizationId,
      );
      return [defaultApp];
    }
    return [];
  }

  // Fetch from PostgreSQL
  const apps = await ApplicationRepository.find({
    organizationId,
  });

  return apps.filter(a => accessibleAppIds.includes(a.id)).map(a => ({ ...a, _id: a.id }));
};

const getApplicationById = async (appId, organizationId) => {
  const application = await ApplicationRepository.findById(appId);

  if (!application || application.isDeleted) {
    throw ApiError.notFound('Application not found', 'APP_NOT_FOUND');
  }

  if (organizationId && application.organizationId.toString() !== organizationId.toString()) {
    throw ApiError.forbidden('Not authorized to access this application', 'APP_FORBIDDEN');
  }

  return { ...application, _id: application.id };
};

const createApplication = async (appData, userId, organizationId) => {
  const { name, description, icon, iconColor } = appData;

  if (!name) {
    throw ApiError.badRequest('Please provide a name for the application', 'APP_NAME_REQUIRED');
  }

  if (!organizationId) {
    throw ApiError.badRequest('Organization ID is required', 'ORG_ID_REQUIRED');
  }

  const application = await ApplicationRepository.create({
    name,
    description,
    icon,
    iconColor,
    owner: userId,
    organizationId,
  });

  const { createDefaultPermissions } = await import('./appPermission.service.js');
  await createDefaultPermissions(application.id, userId);

  return { ...application, _id: application.id };
};

const updateApplication = async (appId, updateData, organizationId) => {
  await getApplicationById(appId, organizationId);

  delete updateData.organizationId;
  delete updateData.owner;
  delete updateData.id;
  delete updateData._id;

  const updated = await ApplicationRepository.update(appId, updateData);
  return { ...updated, _id: updated.id };
};

const deleteApplication = async (appId, userId, organizationId) => {
  const application = await getApplicationById(appId, organizationId);

  const hasResources = await ResourceRepository.hasResources(appId.toString());

  if (hasResources) {
    throw ApiError.badRequest(
      'Cannot delete application with existing resources (forms, views, documents or conversations). Please delete all resources first.',
      'APP_NOT_EMPTY',
    );
  }

  // Soft delete app
  await ApplicationRepository.delete(appId);

  // Cleanup roles and assignments
  await RoleRepository.deleteMany({ appId: appId.toString(), scope: 'APP' });
  await PermissionAssignmentRepository.deleteMany({ resourceId: appId, scope: 'APP' });

  // Cleanup dashboard
  await UserDashboardRepository.deleteByRef('Application', appId);
};

/**
 * Get all API keys for an application
 */
const getApiKeys = async (appId, organizationId) => {
  await getApplicationById(appId, organizationId);
  const keys = await ApiKeyRepository.findByApp(appId);
  return keys.map((key) => ({
    _id: key.id,
    name: key.name,
    prefix: key.prefix,
    createdAt: key.createdAt,
    lastUsedAt: key.lastUsedAt,
  }));
};

/**
 * Create a new API key for an application
 */
const createApiKey = async (appId, name, organizationId) => {
  await getApplicationById(appId, organizationId);

  if (!name || !name.trim()) {
    throw ApiError.badRequest('API key name is required', 'KEY_NAME_REQUIRED');
  }

  const apiKey = `app_sk_${crypto.randomBytes(32).toString('hex')}`;
  const prefix = apiKey.substring(7, 15);
  const hash = await bcrypt.hash(apiKey, 10);

  await ApiKeyRepository.create({
    appId,
    name: name.trim(),
    prefix,
    hash,
  });

  return { key: apiKey };
};

/**
 * Revoke (delete) an API key
 */
const revokeApiKey = async (appId, keyId, organizationId) => {
  await getApplicationById(appId, organizationId);
  const key = await ApiKeyRepository.findById(keyId);

  if (!key || key.appId.toString() !== appId.toString()) {
    throw ApiError.notFound('API key not found', 'KEY_NOT_FOUND');
  }

  await ApiKeyRepository.delete(keyId);
};

export default {
  getApplications,
  getApplicationById,
  createApplication,
  updateApplication,
  deleteApplication,
  getApiKeys,
  createApiKey,
  revokeApiKey,
};
