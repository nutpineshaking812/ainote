import asyncHandler from 'express-async-handler';
import skillService from '../services/skill.service.js';
import { sendSuccess } from '../utils/response.js';
import { zodToJsonSchema } from 'zod-to-json-schema';

const getAvailableSkills = asyncHandler(async (req, res) => {
  const orgId = req.organization.id;
  const appId = req.query.appId;
  const scope = req.query.scope;
  const userId = req.user._id;

  const rawSkills = await skillService.getAvailableSkills({ userId, orgId, appId, scope });

  const formattedSkills = rawSkills.map((skill) => {
    let jsonSchema = {};
    const inputSchema = skill.inputSchema;

    const isZod =
      inputSchema &&
      (typeof inputSchema.safeParse === 'function' || (inputSchema._def && inputSchema.parse));

    if (isZod) {
      try {
        jsonSchema = zodToJsonSchema(inputSchema);
        if (Object.keys(jsonSchema.properties || {}).length === 0 && inputSchema._def?.shape) {
          const shape =
            typeof inputSchema._def.shape === 'function'
              ? inputSchema._def.shape()
              : inputSchema._def.shape;
          const recoveredProps = {};
          const required = [];

          if (shape) {
            Object.entries(shape).forEach(([key, value]) => {
              recoveredProps[key] = {
                type: 'string',
                description: value.description || value._def?.description || '',
              };
              if (!value.isOptional || !value._def?.defaultValue) required.push(key);
            });
            jsonSchema = {
              type: 'object',
              properties: recoveredProps,
              required: required.length > 0 ? required : undefined,
            };
          }
        }
      } catch (err) {
        jsonSchema = { type: 'object', properties: {} };
      }
    } else {
      jsonSchema = inputSchema || { type: 'object', properties: {} };
    }

    if (jsonSchema.$schema) delete jsonSchema.$schema;
    if (!jsonSchema.type) jsonSchema.type = 'object';
    if (!jsonSchema.properties) jsonSchema.properties = {};

    const { implementationRef, hideResult, ...cleanSkill } = skill;
    return {
      ...cleanSkill,
      inputSchema: jsonSchema,
    };
  });

  return sendSuccess(res, formattedSkills);
});

const getSystemSkills = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const result = await skillService.getSystemSkills({ page, limit });
  return sendSuccess(res, result);
});

const getOrganizationSkills = asyncHandler(async (req, res) => {
  const orgId = req.organization.id;
  const userId = req.user._id;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;

  const result = await skillService.getOrganizationSkills({ userId, orgId, page, limit });
  return sendSuccess(res, result);
});

const discoverDocumentSkills = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { tags, teamId } = req.query;

  // Use teamId from query if provided, otherwise fallback to current org context
  const targetId = teamId || req.organization.id;

  // tags might be a comma-separated string or array.
  const tagArray = Array.isArray(tags)
    ? tags
    : typeof tags === 'string'
      ? tags.split(',').filter(Boolean)
      : tags
        ? [tags]
        : [];

  const skills = await skillService.discoverDocumentSkills({
    userId,
    tags: tagArray,
    teamId: targetId,
    currentOrg: req.organization,
  });
  return sendSuccess(res, skills);
});

const installFromGit = asyncHandler(async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ success: false, message: 'URL is required' });
  }

  const result = await skillService.installFromGit(url);
  return sendSuccess(res, result);
});

const uninstallSkill = asyncHandler(async (req, res) => {
  const { repoFolderName } = req.body;
  if (!repoFolderName) {
    return res.status(400).json({ success: false, message: 'repoFolderName is required' });
  }

  const result = await skillService.uninstallSkill(repoFolderName);
  return sendSuccess(res, result);
});

const getPackageSkills = asyncHandler(async (req, res) => {
  const result = await skillService.getPackageSkills();

  // For security, sanitize the data before sending to the frontend
  // This hides absolute server paths and extracts the repository folder name
  const safeResult = result.map((skill) => {
    const fullPath = skill.implementationRef || '';
    const isInstalled = fullPath.includes('/installed/');
    let repoFolderName = null;

    if (isInstalled) {
      const parts = fullPath.split('/installed/');
      if (parts.length >= 2) {
        repoFolderName = parts[1].split('/')[0];
      }
    }

    return {
      ...skill,
      // Mask absolute path: only show relative part for debugging/info
      implementationRef: isInstalled
        ? `installed/${repoFolderName}${fullPath.split(repoFolderName)[1] || ''}`
        : skill.id.replace('pkg:', ''),
      repoFolderName,
      isRemovable: !!repoFolderName,
    };
  });

  return sendSuccess(res, safeResult);
});

const syncSkills = asyncHandler(async (req, res) => {
  const userId = req.user?._id;
  const orgId = req.organization?.id;

  const result = await skillService.syncPackageSkills({ userId, orgId });
  return sendSuccess(res, result);
});

export default {
  getAvailableSkills,
  getSystemSkills,
  getOrganizationSkills,
  getPackageSkills,
  discoverDocumentSkills,
  installFromGit,
  uninstallSkill,
  syncSkills,
};
