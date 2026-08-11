import asyncHandler from 'express-async-handler';
import { ApiError } from '../utils/ApiError.js';
import OrganizationMemberRepository from '../repositories/organizationMember.repository.js';
import OrganizationRepository from '../repositories/organization.repository.js';
import permissionCache from '../services/permissionCache.service.js';
import { APP_PERMISSIONS } from '../constants/permissions.js';
import DocumentRepository from '../repositories/document.repository.js';
import { formRepository } from '../repositories/form.repository.js';
import { formRecordRepository } from '../repositories/formRecord.repository.js';
import ViewRepository from '../repositories/view.repository.js';
import ResourceRepository from '../repositories/resource.repository.js';

/**
 * Helper function to get cached resource or fetch from DB
 * @param {Object} req - Express request object
 * @param {String} resourceType - Type of resource
 * @param {String} resourceId - Resource ID
 * @param {Model} Model - Mongoose model
 * @param {String} selectFields - Optional fields to select
 * @returns {Promise<Object>} Resource object
 */
async function getCachedResource(req, resourceType, resourceId, selectFields = null) {
  const cacheKey = `${resourceType}_${resourceId}`;
  if (!req._resourceCache) req._resourceCache = {};

  let resource = req._resourceCache[cacheKey];
  if (!resource) {
    if (resourceType === 'document') {
      resource = await DocumentRepository.findById(resourceId);
    } else if (resourceType === 'view') {
      resource = await ViewRepository.findById(resourceId);
    } else if (resourceType === 'form') {
      resource = await formRepository.findById(resourceId);
    }

    if (!resource) {
      // Fallback: Check if resourceId is actually an app_resource ID (PostgreSQL)
      const resourceEntry = await ResourceRepository.findById(resourceId);
      if (resourceEntry && resourceEntry.type === resourceType && resourceEntry.refId) {
        if (resourceType === 'document') {
          resource = await DocumentRepository.findById(resourceEntry.refId);
        } else if (resourceType === 'view') {
          resource = await ViewRepository.findById(resourceEntry.refId);
        } else if (resourceType === 'form') {
          resource = await formRepository.findById(resourceEntry.refId);
        }
      }
    }

    if (!resource) {
      throw ApiError.notFound(`${resourceType} not found`, 'RESOURCE_NOT_FOUND');
    }
    req._resourceCache[cacheKey] = resource;
  }

  return resource;
}

/**
 * Helper function to get permission checker function for a resource type
 * @param {String} resourceType - Type of resource
 * @returns {Promise<Function>} Permission checker function
 */
async function getPermissionChecker(resourceType) {
  if (resourceType === 'form') {
    const formService = await import('../services/form.service.js');
    return formService.default._checkFormAccess;
  } else if (resourceType === 'view') {
    const viewService = await import('../services/view.service.js');
    return viewService._checkViewAccess;
  } else if (resourceType === 'document') {
    const documentService = await import('../services/document.service.js');
    return documentService.default.checkPermission;
  } else {
    throw ApiError.badRequest(`Unsupported resource type: ${resourceType}`);
  }
}

/**
 * Middleware to attach organization context to request
 * Reads X-Organization-ID header and verifies membership
 */
export const attachOrganization = asyncHandler(async (req, res, next) => {
  const organizationId = req.headers['x-organization-id'];

  if (!organizationId) {
    throw ApiError.badRequest('Organization ID is required', 'ORG_ID_REQUIRED');
  }

  // Verify user is a member of this organization
  const member = await OrganizationMemberRepository.findOne(req.user.id, organizationId);

  if (!member || member.status !== 'ACTIVE') {
    throw ApiError.forbidden('You are not a member of this organization', 'NOT_A_MEMBER');
  }

  const organization = await OrganizationRepository.findById(organizationId);
  if (!organization || organization.status !== 'ACTIVE') {
    throw ApiError.forbidden('This organization is not active or not found', 'ORG_NOT_ACTIVE');
  }

  // Attach organization and member info to request
  req.organization = organization;
  req.member = member;

  // Load permissions from cache or rebuild if missing
  let permissions = member._permCache;
  // console.log('permissions', permissions);
  if (!permissions) {
    permissions = await permissionCache.updateMemberCache(req.user.id, organizationId);
  }

  // Set req.permissions to global for backward compatibility with existing requirePermission calls
  req.permissions = permissions.global;
  // Attach full permission object for advanced checks
  req.allPermissions = permissions;

  next();
});

/**
 * Middleware factory to check if user has a specific permission
 * @param {String} permission - Required permission
 * @returns {Function} Express middleware
 */
export const requirePermission = (permission) => {
  return asyncHandler(async (req, res, next) => {
    if (!req.allPermissions) {
      throw ApiError.forbidden('Permissions not loaded', 'PERMISSIONS_NOT_LOADED');
    }

    // Owner bypasses all permission checks
    if (req.allPermissions.isOwner) {
      return next();
    }

    if (!req.permissions || !req.permissions.includes(permission)) {
      throw ApiError.forbidden(
        `You do not have the required permission: ${permission}`,
        'INSUFFICIENT_PERMISSIONS',
      );
    }

    next();
  });
};

/**
 * Middleware to check if user has any of the specified permissions
 * @param {Array<String>} permissions - Array of permissions (OR logic)
 * @returns {Function} Express middleware
 */
export const requireAnyPermission = (permissions) => {
  return asyncHandler(async (req, res, next) => {
    if (!req.allPermissions) {
      throw ApiError.forbidden('Permissions not loaded', 'PERMISSIONS_NOT_LOADED');
    }

    // Owner bypasses all permission checks
    if (req.allPermissions.isOwner) {
      return next();
    }

    const hasAny = permissions.some((perm) => req.permissions && req.permissions.includes(perm));
    if (!hasAny) {
      throw ApiError.forbidden(
        `You do not have any of the required permissions: ${permissions.join(', ')}`,
        'INSUFFICIENT_PERMISSIONS',
      );
    }

    next();
  });
};

/**
 * Middleware factory to check if user has a specific application-level permission
 * Enhanced to support automatic appId lookup from formId/viewId/docId/recordId
 *
 * @param {String} permission - Required permission
 * @param {Object} options - Configuration options
 * @param {String} options.resourceIdField - Field name to extract resource ID ('formId', 'viewId', 'docId', 'recordId', 'id')
 * @param {String} options.resourceIdSource - Source of resource ID ('params', 'query', 'body')
 * @param {String} options.resourceType - Explicit resource type ('form', 'view', 'document', 'record')
 * @returns {Function} Express middleware
 */
export const requireAppPermission = (permission, options = {}) => {
  return asyncHandler(async (req, res, next) => {
    if (!req.allPermissions) {
      throw ApiError.forbidden('Permissions not loaded', 'PERMISSIONS_NOT_LOADED');
    }

    let appId = req.params.appId;

    // If appId not in params, try to derive it from resource ID
    if (!appId && options.resourceIdField) {
      const { resourceIdField, resourceIdSource = 'query' } = options;
      const resourceId = req[resourceIdSource][resourceIdField];

      if (!resourceId) {
        throw ApiError.badRequest(
          `${resourceIdField} is required for permission check`,
          'RESOURCE_ID_REQUIRED',
        );
      }

      // Special case: record lookup needs two-step lookup (record -> form -> appId)
      const isRecord = options.resourceType === 'record' || resourceIdField === 'recordId';
      if (isRecord) {
        const cacheKey = `recordId_${resourceId}`;
        if (!req._resourceCache) req._resourceCache = {};

        let record = req._resourceCache[cacheKey];
        if (!record) {
          record = await formRecordRepository.findById(resourceId);
          if (!record) {
            throw ApiError.notFound('Record not found', 'RECORD_NOT_FOUND');
          }
          req._resourceCache[cacheKey] = record;
        }

        // Now get the form to extract appId
        const formCacheKey = `formId_${record.formId}`;
        let form = req._resourceCache[formCacheKey];
        if (!form) {
          form = await formRepository.findById(record.formId);
          if (!form) {
            throw ApiError.notFound('Form not found', 'FORM_NOT_FOUND');
          }
          req._resourceCache[formCacheKey] = form;
        }

        appId = form.appId;
      } else {
        // Standard case: direct lookup for formId/viewId/docId
        const resourceTypeMap = {
          formId: 'form',
          viewId: 'view',
          docId: 'document',
        };

        const resourceType = options.resourceType || resourceTypeMap[resourceIdField];
        if (!resourceType) {
          throw ApiError.badRequest(`Unsupported resourceIdField: ${resourceIdField}`);
        }

        const resource = await getCachedResource(req, resourceType, resourceId, 'appId appRef');

        appId = resource.appId || resource.appRef;
      }
    }

    if (!appId) {
      throw ApiError.badRequest('appId is required for app permission check', 'APP_ID_REQUIRED');
    }

    // Owner bypasses all permission checks
    if (req.allPermissions.isOwner) {
      return next();
    }

    const appPerms = req.allPermissions.apps[appId.toString()] || [];

    // 1. app:manage includes all other permissions
    if (appPerms.includes(APP_PERMISSIONS.APP_MANAGE)) {
      return next();
    }

    // 2. Explicit permission match
    if (appPerms.includes(permission)) {
      return next();
    }

    throw ApiError.forbidden(
      `You do not have the required application permission: ${permission}`,
      'INSUFFICIENT_PERMISSIONS',
    );
  });
};

/**
 * Middleware to check if user is the owner of a resource
 * @param {String} resourceType - Type of resource ('form', 'view', 'document')
 * @param {Object} options - Configuration options
 * @param {String} options.idField - Field name for resource ID (default: 'id')
 * @param {String} options.idSource - Source of ID ('params', 'body') (default: 'params')
 * @returns {Function} Express middleware
 */
export const requireResourceOwner = (resourceType, options = {}) => {
  return asyncHandler(async (req, res, next) => {
    const { idField = 'id', idSource = 'params' } = options;
    const resourceId = req[idSource][idField];

    if (!resourceId) {
      throw ApiError.badRequest(`${idField} is required`, 'ID_REQUIRED');
    }

    const resource = await getCachedResource(req, resourceType, resourceId);

    // Check ownership
    const ownerField = resourceType === 'document' || resourceType === 'view' ? 'ownerId' : 'owner';
    const resourceOwner = resource[ownerField] ? resource[ownerField].toString() : null;
    if (resourceOwner !== req.user.id.toString()) {
      throw ApiError.forbidden(`You are not the owner of this ${resourceType}`, 'NOT_OWNER');
    }

    // Cache resource for service layer to avoid duplicate query
    req[resourceType] = resource;
    next();
  });
};

/**
 *  Middleware to check resource-level permissions (for shared resources)
 * @param {String} resourceType - Type of resource ('form', 'view', 'document')
 * @param {String} action - Required action ('VIEW', 'EDIT')
 * @param {Object} options - Configuration options
 * @returns {Function} Express middleware
 */
export const requireResourcePermission = (resourceType, action, options = {}) => {
  return asyncHandler(async (req, res, next) => {
    const { idField = 'id', idSource = 'params' } = options;
    const resourceId = req[idSource][idField];

    if (!resourceId) {
      throw ApiError.badRequest(`${idField} is required`, 'ID_REQUIRED');
    }

    const checkAccessFunction = await getPermissionChecker(resourceType);
    const resource = await getCachedResource(req, resourceType, resourceId);

    // Check permission using service's logic
    const hasAccess = await checkAccessFunction(resource, req.user.id, action);
    if (!hasAccess) {
      throw ApiError.forbidden(
        `You do not have ${action} permission for this ${resourceType}`,
        'INSUFFICIENT_PERMISSIONS',
      );
    }

    // Cache resource for service layer
    req[resourceType] = resource;
    next();
  });
};
