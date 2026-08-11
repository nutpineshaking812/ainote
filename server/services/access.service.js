import ApplicationRepository from '../repositories/application.repository.js';
import { formRepository } from '../repositories/form.repository.js';
import { formRecordRepository } from '../repositories/formRecord.repository.js';
import { ApiError } from '../utils/ApiError.js';
import { APP_PERMISSIONS } from '../constants/permissions.js';

const ensureAppOwnership = async (appId, userId, preLoadedPermissions = null) => {
  const app = await ApplicationRepository.findById(appId);
  if (!app) throw ApiError.notFound('Application not found', 'APP_NOT_FOUND');

  let permissions;
  if (preLoadedPermissions) {
    if (preLoadedPermissions.isOwner) return app;
    permissions = preLoadedPermissions.apps[appId.toString()] || [];
  } else {
    permissions = await (
      await import('./appPermission.service.js')
    ).getUserAppPermissions(appId, userId, app.organizationId);
  }

  if (permissions.includes(APP_PERMISSIONS.APP_MANAGE)) return app;

  throw ApiError.forbidden('Manage permission required for this application', 'APP_FORBIDDEN');
};

const ensureAppAccess = async (appId, userId, preLoadedPermissions = null) => {
  const app = await ApplicationRepository.findById(appId);
  if (!app) throw ApiError.notFound('Application not found', 'APP_NOT_FOUND');

  let permissions;
  if (preLoadedPermissions) {
    if (preLoadedPermissions.isOwner) return app;
    permissions = preLoadedPermissions.apps[appId.toString()] || [];
  } else {
    permissions = await (
      await import('./appPermission.service.js')
    ).getUserAppPermissions(appId, userId, app.organizationId);
  }

  if (
    permissions.includes(APP_PERMISSIONS.APP_VIEW) ||
    permissions.includes(APP_PERMISSIONS.APP_MANAGE) ||
    permissions.includes(APP_PERMISSIONS.FORM_FILL)
  ) {
    return app;
  }

  throw ApiError.forbidden('Not authorized to access this application', 'APP_FORBIDDEN');
};

const ensureFormOwnership = async (appId, formId, userId) => {
  const form = await formRepository.findOneByAppAndId(appId, formId);
  if (!form) throw ApiError.notFound('Form not found in application', 'FORM_NOT_FOUND');

  if (form.owner.toString() === userId.toString()) return form;

  const hasDesign = await checkAppPermission(appId, userId, APP_PERMISSIONS.FORM_DESIGN);
  if (hasDesign) return form;

  const hasAppManage = await checkAppPermission(appId, userId, APP_PERMISSIONS.APP_MANAGE);
  if (hasAppManage) return form;

  throw ApiError.forbidden('Design permission required for this form', 'FORM_FORBIDDEN');
};

const ensureFormRecordOwnership = async (appId, formId, recordId, userId) => {
  const record = await formRecordRepository.findOneByFormAndId(formId, recordId);
  if (!record || record.appId.toString() !== appId.toString())
    throw ApiError.notFound('Record not found', 'RECORD_NOT_FOUND');

  const form = await formRepository.findById(formId);
  if (!form) throw ApiError.notFound('Form not found', 'FORM_NOT_FOUND');

  if (form.owner.toString() === userId.toString()) return record;

  const hasDesign = await checkAppPermission(appId, userId, APP_PERMISSIONS.FORM_DESIGN);
  if (hasDesign) return record;

  const hasAppManage = await checkAppPermission(appId, userId, APP_PERMISSIONS.APP_MANAGE);
  if (hasAppManage) return record;

  throw ApiError.forbidden('Not authorized to access this record', 'RECORD_FORBIDDEN');
};

const checkAppPermission = async (appId, userId, permissionType) => {
  const app = await ApplicationRepository.findById(appId);
  if (!app) return false;

  if (app.owner.toString() === userId.toString()) return true;

  const appPermissionService = (await import('./appPermission.service.js')).default;
  return appPermissionService.hasAppPermission(appId, userId, app.organizationId, permissionType);
};

export default {
  ensureAppOwnership,
  ensureAppAccess,
  ensureFormOwnership,
  ensureFormRecordOwnership,
  checkAppPermission,
};
