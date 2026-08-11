import { formRepository } from '../repositories/form.repository.js';
import { formRecordRepository } from '../repositories/formRecord.repository.js';
import resourceService from './resource.service.js';
import ApplicationRepository from '../repositories/application.repository.js';
import PermissionAssignmentRepository from '../repositories/permissionAssignment.repository.js';
import ApiError from '../utils/ApiError.js';
import { APP_PERMISSIONS } from '../constants/permissions.js';
import { validateFieldsStructure } from '../utils/fieldValidator.js';
import { normalizeFieldsRecordable } from '../utils/formFieldUtils.js';
import permissionService from './permission.service.js';
import accessService from './access.service.js';
import PublishSettingRepository from '../repositories/publishSetting.repository.js';
import RecordShareMetaRepository from '../repositories/recordShareMeta.repository.js';
import RoleRepository from '../repositories/role.repository.js';

/**
 * Helper to check if user has access to a form.
 */
const _checkFormAccess = async (form, userId, action) => {
  const userIdStr = userId.toString();
  if (form.owner === userIdStr) return true;

  const hasGranular = await permissionService.checkPermission(form, userIdStr, action, null, 'owner');
  if (hasGranular) return true;

  const appId = form.appId;

  if (action === 'VIEW') {
    const hasView = await accessService.checkAppPermission(
      appId,
      userIdStr,
      APP_PERMISSIONS.FORM_VIEW,
    );
    if (hasView) return true;
    const hasFill = await accessService.checkAppPermission(
      appId,
      userIdStr,
      APP_PERMISSIONS.FORM_FILL,
    );
    if (hasFill) return true;
  }

  const hasFormDesign = await accessService.checkAppPermission(
    appId,
    userIdStr,
    APP_PERMISSIONS.FORM_DESIGN,
  );
  if (hasFormDesign) return true;

  const hasAppManage = await accessService.checkAppPermission(
    appId,
    userIdStr,
    APP_PERMISSIONS.APP_MANAGE,
  );
  if (hasAppManage) return true;

  return false;
};

/**
 * Create a new form.
 */
const createForm = async (formData, userId) => {
  const { appId, name, description, actions, fields, showIndex, parentId } = formData;

  if (!name) {
    throw ApiError.badRequest('Please provide a name for the form', 'FORM_NAME_REQUIRED');
  }

  const normalizedFields = normalizeFieldsRecordable(fields);
  try {
    validateFieldsStructure(normalizedFields);
  } catch (e) {
    throw ApiError.badRequest(e.message, 'FIELD_VALIDATION');
  }

  const created = await formRepository.create({
    name,
    description,
    actions,
    fields: normalizedFields,
    showIndex,
    appId,
    owner: userId.toString(),
  });

  try {
    await resourceService.upsertResourceItem(
      appId,
      {
        type: 'form',
        refId: created.id.toString(),
        parentId,
        meta: {},
      },
      userId,
    );
  } catch (e) {
    console.error('Failed to create AppResource for form:', e);
    if (e instanceof ApiError) throw e;
    throw ApiError.internal(
      `Failed to create AppResource for form: ${e.message}`,
      'APP_RESOURCE_CREATE_FAILED',
    );
  }
  return created;
};

/**
 * Get all forms for an application.
 */
const getForms = async (appId, userId) => {
  const app = await ApplicationRepository.findById(appId);
  if (!app) throw ApiError.notFound('App not found');

  const userIdStr = userId.toString();
  const isOwner = app.owner === userIdStr;

  if (isOwner) {
    return formRepository.findSummaryByAppId(appId);
  }

  const hasManage = await accessService.checkAppPermission(appId, userIdStr, APP_PERMISSIONS.APP_MANAGE);
  const hasFormDesign = await accessService.checkAppPermission(appId, userIdStr, APP_PERMISSIONS.FORM_DESIGN);
  const hasFormView = await accessService.checkAppPermission(appId, userIdStr, APP_PERMISSIONS.FORM_VIEW);

  if (hasManage || hasFormDesign || hasFormView) {
    return formRepository.findSummaryByAppId(appId);
  }

  // For now, if no app-level access, we check granular via permissionService (one by one or we could optimize later)
  const allForms = await formRepository.findSummaryByAppId(appId);
  const accessibleForms = [];
  for (const form of allForms) {
    if (await _checkFormAccess(form, userIdStr, 'VIEW')) {
      accessibleForms.push(form);
    }
  }
  return accessibleForms;
};

/**
 * Get a single form by its ID.
 */
const getFormById = async (formId, userId) => {
  const form = await formRepository.findById(formId);
  if (!form) {
    throw ApiError.notFound('Form not found', 'FORM_NOT_FOUND');
  }

  const normalizedFields = normalizeFieldsRecordable(form.fields);
  return { ...form, fields: normalizedFields };
};

/**
 * Update a form.
 */
const updateForm = async (formId, updateData, userId) => {
  const form = await formRepository.findById(formId);
  if (!form) throw ApiError.notFound('Form not found', 'FORM_NOT_FOUND');

  if (Array.isArray(updateData.fields)) {
    const normalizedFields = normalizeFieldsRecordable(updateData.fields);
    try {
      validateFieldsStructure(normalizedFields);
    } catch (e) {
      throw ApiError.badRequest(e.message, 'FIELD_VALIDATION');
    }
    updateData.fields = normalizedFields;
  }

  delete updateData.shares;

  const updated = await formRepository.update(formId, updateData);

  // No syncMeta needed as metadata is dynamically resolved
  return updated;
};

/**
 * Share a form.
 */
const shareForm = async (formId, shares, userId) => {
  const form = await formRepository.findById(formId);
  if (!form) throw ApiError.notFound('Form not found');

  const app = await ApplicationRepository.findById(form.appId);
  if (!app) throw ApiError.notFound('App not found');
  const organizationId = app.organizationId;

  const permissionCache = (await import('./permissionCache.service.js')).default;

  await PermissionAssignmentRepository.deleteMany({ resourceId: formId, scope: 'RESOURCE' });

  for (const share of shares) {
    const roleName = `Resource ${share.permission}`;
    let role = await RoleRepository.findOne({
      organizationId,
      name: roleName,
      scope: 'APP',
    });

    if (!role) {
      role = await RoleRepository.create({
        name: roleName,
        organizationId,
        scope: 'APP',
        permissions: [share.permission],
        isSystem: true,
      });
    }

    const principalId = share.targetType === 'ALL' ? organizationId : share.targetId.toString();

    await PermissionAssignmentRepository.create({
      organizationId,
      principalType: share.targetType,
      principalId,
      roleId: role.id,
      scope: 'RESOURCE',
      resourceId: formId,
      createdBy: userId.toString(),
    });

    if (share.targetType === 'USER') {
      await permissionCache.invalidateMemberCache(principalId, organizationId);
    } else if (share.targetType === 'DEPARTMENT') {
      await permissionCache.invalidateDepartmentMembersCache(principalId, organizationId);
    }
  }

  if (shares.some((s) => s.targetType === 'ALL')) {
    await permissionCache.invalidateOrganizationCaches(organizationId);
  }

  return { success: true };
};

/**
 * Delete a form.
 */
const deleteForm = async (formId, userId) => {
  const form = await formRepository.findById(formId);
  if (!form) throw ApiError.notFound('Form not found', 'FORM_NOT_FOUND');

  const dataCount = await formRecordRepository.countByFormId(formId);
  if (dataCount > 0) {
    throw ApiError.badRequest(
      '无法删除，表单中已有数据。请先删除相关数据再尝试。',
      'FORM_HAS_DATA',
    );
  }

  await formRepository.delete(formId);
  await PublishSettingRepository.deleteByFormId(formId);
  await RecordShareMetaRepository.deleteByFormId(formId);
  await resourceService.removeResourceItem(form.appId, 'form', formId, userId);

  import('./resource.events.js').then((m) => {
    m.default.emitDeleted({ resourceId: formId, type: 'form', appId: form.appId });
  });
};

export default {
  createForm,
  getForms,
  getFormById,
  updateForm,
  deleteForm,
  shareForm,
  _checkFormAccess,
};
