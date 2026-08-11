import asyncHandler from 'express-async-handler';
import * as publishService from '../services/publish.service.js';
import { formRepository } from '../repositories/form.repository.js';
import PublishSettingRepository from '../repositories/publishSetting.repository.js';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';

const defaultFillLink = {
  isPublic: false,
  useAccessCode: false,
  accessCodeHash: '',
  accessCodePlain: '',
  useLinkExpiry: false,
  linkExpiresAt: null,
};

const defaultRecordShare = {
  isPublic: false,
  defaultFieldPermissions: {},
  defaultExpiryHours: null,
};

const defaultQueryLink = {
  isPublic: false,
  useAccessCode: false,
  accessCodeHash: '',
  accessCodePlain: '',
  useLinkExpiry: false,
  linkExpiresAt: null,
  fieldPermissions: {},
};

// GET fill config
export const getFillConfig = asyncHandler(async (req, res) => {
  const { appId, formId } = req.params;
  const form = await formRepository.findOneByAppAndId(appId, formId);
  if (!form) throw ApiError.notFound('Form not found', 'FORM_NOT_FOUND');

  const settings = await PublishSettingRepository.findByFormId(formId);
  const block = settings ? settings.fillLink : defaultFillLink;

  return sendSuccess(res, {
    isPublic: block.isPublic,
    useAccessCode: block.useAccessCode,
    accessCode: block.useAccessCode ? block.accessCodePlain || '' : '',
    useLinkExpiry: block.useLinkExpiry,
    linkExpiresAt: block.linkExpiresAt,
  });
});

// POST update fill config
export const updateFillConfig = asyncHandler(async (req, res) => {
  const { appId, formId } = req.params;
  const block = await publishService.updateFillConfig(appId, formId, req.body);

  return sendSuccess(res, {
    isPublic: block.isPublic,
    useAccessCode: block.useAccessCode,
    accessCode: block.useAccessCode ? block.accessCodePlain || '' : '',
    useLinkExpiry: block.useLinkExpiry,
    linkExpiresAt: block.linkExpiresAt,
  });
});

// GET record share global defaults
export const getRecordShareConfig = asyncHandler(async (req, res) => {
  const { appId, formId } = req.params;
  const form = await formRepository.findOneByAppAndId(appId, formId);
  if (!form) throw ApiError.notFound('Form not found', 'FORM_NOT_FOUND');

  const settings = await PublishSettingRepository.findByFormId(formId);
  return sendSuccess(res, settings ? settings.recordShare : defaultRecordShare);
});

// POST update record share defaults
export const updateRecordShareConfig = asyncHandler(async (req, res) => {
  const { appId, formId } = req.params;
  const recordShare = await publishService.updateRecordShareConfig(appId, formId, req.body);
  return sendSuccess(res, recordShare);
});

// GET query config
export const getQueryConfig = asyncHandler(async (req, res) => {
  const { appId, formId } = req.params;
  const form = await formRepository.findOneByAppAndId(appId, formId);
  if (!form) throw ApiError.notFound('Form not found', 'FORM_NOT_FOUND');

  const settings = await PublishSettingRepository.findByFormId(formId);
  const qblock = settings ? settings.queryLink : defaultQueryLink;

  return sendSuccess(res, {
    isPublic: qblock.isPublic,
    useAccessCode: qblock.useAccessCode,
    accessCode: qblock.useAccessCode ? qblock.accessCodePlain || '' : '',
    useLinkExpiry: qblock.useLinkExpiry,
    linkExpiresAt: qblock.linkExpiresAt,
    fieldPermissions: qblock.fieldPermissions || {},
  });
});

// POST update query config
export const updateQueryConfig = asyncHandler(async (req, res) => {
  const { appId, formId } = req.params;
  const qblock2 = await publishService.updateQueryConfig(appId, formId, req.body);

  return sendSuccess(res, {
    isPublic: qblock2.isPublic,
    useAccessCode: qblock2.useAccessCode,
    accessCode: qblock2.useAccessCode ? qblock2.accessCodePlain || '' : '',
    useLinkExpiry: qblock2.useLinkExpiry,
    linkExpiresAt: qblock2.linkExpiresAt,
    fieldPermissions: qblock2.fieldPermissions || {},
  });
});

// GET external API config
export const getExternalApiConfig = asyncHandler(async (req, res) => {
  const { appId, formId } = req.params;
  const form = await formRepository.findOneByAppAndId(appId, formId);
  if (!form) throw ApiError.notFound('Form not found', 'FORM_NOT_FOUND');

  const settings = await PublishSettingRepository.findByFormId(formId);
  const externalApi = settings ? settings.externalApi : { enabled: false, tokens: [] };
  return sendSuccess(res, externalApi);
});

// POST update external API status
export const updateExternalApiStatus = asyncHandler(async (req, res) => {
  const { appId, formId } = req.params;
  const { enabled } = req.body;

  let settings = await PublishSettingRepository.findByFormId(formId);
  if (!settings) {
    settings = await PublishSettingRepository.create({
      formId: formId.toString(),
      appId: appId.toString(),
      externalApi: { enabled: !!enabled, tokens: [] },
      createdAt: new Date(),
      updatedAt: new Date()
    });
  } else {
    settings = await PublishSettingRepository.update(settings.id, {
      externalApi: { ...(settings.externalApi || {}), enabled: !!enabled },
      updatedAt: new Date()
    });
  }

  return sendSuccess(res, { enabled: settings.externalApi.enabled });
});

// POST create external API token
export const createExternalApiToken = asyncHandler(async (req, res) => {
  const { appId, formId } = req.params;
  const newToken = await publishService.createExternalApiToken(appId, formId, req.body);
  return sendSuccess(res, newToken);
});

// POST update external API token
export const updateExternalApiToken = asyncHandler(async (req, res) => {
  const { appId, formId, tokenId } = req.params;
  const token = await publishService.updateExternalApiToken(appId, formId, tokenId, req.body);
  return sendSuccess(res, token);
});

// DELETE external API token
export const deleteExternalApiToken = asyncHandler(async (req, res) => {
  const { appId, formId, tokenId } = req.params;
  await publishService.deleteExternalApiToken(appId, formId, tokenId);
  return sendSuccess(res, { deleted: true });
});
