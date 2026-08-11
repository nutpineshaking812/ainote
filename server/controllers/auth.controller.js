import asyncHandler from 'express-async-handler';
import { sendSuccess } from '../utils/response.js';
import * as authService from '../services/auth.service.js';
import InvitationRepository from '../repositories/invitation.repository.js';
import QuotaRepository from '../repositories/quota.repository.js';
import { ApiError } from '../utils/ApiError.js';
import env from '../config/env.js';
import OrganizationRepository from '../repositories/organization.repository.js';

// @desc    Register a new user
// @route   POST /api/v1/auth/register
// @access  Public
export const register = asyncHandler(async (req, res) => {
  const result = await authService.registerUser(req.body);
  return sendSuccess(res, { message: 'User registered successfully', ...result }, 201);
});

// @desc    Auth user & get token
// @route   POST /api/v1/auth/login
// @access  Public
export const login = asyncHandler(async (req, res) => {
  const result = await authService.loginUser(req.body);
  return sendSuccess(res, result);
});

// @desc    Get user's invitation codes
// @route   GET /api/v1/auth/invitations
// @access  Private
export const getInvitations = asyncHandler(async (req, res) => {
  const invitations = await InvitationRepository.findByInviter(req.user.id, 'PLATFORM');
  const userQuota = await QuotaRepository.findOne('USER', req.user.id);

  return sendSuccess(res, {
    invitations,
    slots: userQuota ? userQuota.invitationSlots : 0,
  });
});

// @desc    Generate a new invitation code (Platform only)
// @route   POST /api/v1/auth/invitations
// @access  Private
export const generateInvitation = asyncHandler(async (req, res) => {
  const { maxUses } = req.body;
  const invitation = await authService.generatePlatformInvitation(req.user.id, maxUses);
  return sendSuccess(res, invitation, 201);
});

// @desc    Verify invitation code without consuming it
// @route   GET /api/v1/auth/invitation/:code
// @access  Public
export const verifyInvitation = asyncHandler(async (req, res) => {
  const { code } = req.params;

  const isFixedCode = code === env.FIXED_INVITATION_CODE;
  const invitation = await InvitationRepository.findByCode(code);

  let targetOrg = null;
  if (invitation && invitation.targetOrganizationId) {
    targetOrg = await OrganizationRepository.findById(invitation.targetOrganizationId);
  }

  if (isFixedCode && !invitation) {
    return sendSuccess(res, {
      code: code,
      organization: null,
      maxUses: -1,
      uses: 0,
    });
  }

  if (!invitation || (invitation.expiresAt && invitation.expiresAt < new Date())) {
    throw ApiError.badRequest('Invalid or expired invitation code', 'INVALID_INVITE_CODE');
  }

  if (invitation.maxUses !== -1 && invitation.uses >= invitation.maxUses) {
    throw ApiError.badRequest('Invitation code has reached maximum uses', 'INVITE_CODE_FULL');
  }

  return sendSuccess(res, {
    code: invitation.code,
    organization: targetOrg
      ? {
          id: targetOrg.id,
          name: targetOrg.name,
        }
      : null,
    maxUses: invitation.maxUses,
    uses: invitation.uses,
  });
});
