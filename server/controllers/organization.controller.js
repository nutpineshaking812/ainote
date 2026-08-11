import asyncHandler from 'express-async-handler';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';
import OrganizationRepository from '../repositories/organization.repository.js';
import OrganizationMemberRepository from '../repositories/organizationMember.repository.js';
import UserRepository from '../repositories/user.repository.js';
import DepartmentRepository from '../repositories/department.repository.js';
import RoleRepository from '../repositories/role.repository.js';
import QuotaRepository from '../repositories/quota.repository.js';
import InvitationRepository from '../repositories/invitation.repository.js';
import * as organizationService from '../services/organization.service.js';

// @desc    Get user's organizations
// @route   GET /api/v1/organizations
// @access  Private
export const getMyOrganizations = asyncHandler(async (req, res) => {
  const organizations = await organizationService.getUserOrganizations(req.user._id);

  return sendSuccess(res, {
    organizations: organizations.map((org) => ({
      id: org.organization.id,
      name: org.organization.name,
      logo: org.organization.logo,
      description: org.organization.description,
      slogan: org.organization.slogan,
      ownerId: org.organization.ownerId,
      type: org.organization.type || 'TEAM',
      roles: org.roles.map((r) => ({ id: r.id, name: r.name })),
      departments: org.departments,
      joinedAt: org.joinedAt,
    })),
  });
});

// @desc    Switch to a different organization
// @route   POST /api/v1/organizations/:id/switch
// @access  Private
export const switchOrganization = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const member = await OrganizationMemberRepository.findOne(req.user._id, id);

  if (!member || member.status !== 'ACTIVE') {
    throw ApiError.forbidden('You are not a member of this organization', 'NOT_A_MEMBER');
  }

  const organization = await OrganizationRepository.findById(id);
  if (!organization || organization.status !== 'ACTIVE') {
    throw ApiError.forbidden('This organization is not active or not found', 'ORG_NOT_ACTIVE');
  }

  const permissions = await organizationService.getUserPermissions(req.user._id, id);

  return sendSuccess(res, {
    organization: {
      id: organization.id,
      name: organization.name,
      logo: organization.logo,
      description: organization.description,
      slogan: organization.slogan,
      ownerId: organization.ownerId,
      type: organization.type || 'TEAM',
    },
    permissions,
  });
});

// @desc    Get organization members
// @route   GET /api/v1/organizations/:id/members
// @access  Private (requires MEMBER_MANAGE permission)
export const getOrganizationMembers = asyncHandler(async (req, res) => {
  const { id: organizationId } = req.params;

  const members = await OrganizationMemberRepository.findByOrganization(organizationId);

  const userIds = members.map((m) => m.userId);
  const [users, quotas, roles, departments] = await Promise.all([
    UserRepository.findByIds(userIds),
    QuotaRepository.findByTargetIds('USER', userIds),
    RoleRepository.findByOrganization(organizationId),
    DepartmentRepository.findByOrganization(organizationId),
  ]);

  const userMap = Object.fromEntries(users.map(u => [u.id, u]));
  const quotaMap = Object.fromEntries(quotas.map(q => [q.targetId, q]));
  const roleMap = Object.fromEntries(roles.map(r => [r.id, r]));
  const deptMap = Object.fromEntries(departments.map(d => [d.id, d]));

  return sendSuccess(res, {
    members: members.map((m) => {
      const user = userMap[m.userId];
      const quota = quotaMap[m.userId];
      return {
        id: m.id,
        user: user ? { _id: user.id, id: user.id, username: user.username, email: user.email, nickname: user.nickname } : null,
        roles: (m.roleIds || []).map(rid => roleMap[rid]).filter(Boolean),
        departments: (m.departmentIds || []).map(did => deptMap[did]).filter(Boolean),
        status: m.status,
        joinedAt: m.joinedAt,
        quota: quota
          ? {
              totalTokenUsage: quota.totalTokenUsage,
              usageLimit: quota.usageLimit,
            }
          : { totalTokenUsage: 0, usageLimit: -1 },
      };
    }),
  });
});

// @desc    Get organization roles
// @route   GET /api/v1/organizations/:id/roles
// @access  Private
export const getOrganizationRoles = asyncHandler(async (req, res) => {
  const { id: organizationId } = req.params;
  const { scope, appId } = req.query;

  const roles = await RoleRepository.findByOrganization(organizationId, { scope, appId });

  return sendSuccess(res, {
    roles: roles.map((r) => ({
      id: r.id,
      name: r.name,
      permissions: r.permissions,
      isSystem: r.isSystem,
      scope: r.scope,
      appId: r.appId,
      description: r.description,
    })),
  });
});

// @desc    Update organization settings
// @route   PATCH /api/v1/organizations/:id
// @access  Private (requires ORG_MANAGE permission)
export const updateOrganization = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, logo, description, slogan } = req.body;

  const organization = await OrganizationRepository.findById(id);
  if (!organization) throw ApiError.notFound('Organization not found', 'ORG_NOT_FOUND');

  const updates = {};
  if (name) updates.name = name;
  if (logo !== undefined) updates.logo = logo;
  if (description !== undefined) updates.description = description;
  if (slogan !== undefined) updates.slogan = slogan;

  const updatedOrg = await OrganizationRepository.update(id, updates);

  return sendSuccess(res, {
    organization: {
      id: updatedOrg.id,
      name: updatedOrg.name,
      logo: updatedOrg.logo,
      description: updatedOrg.description,
      slogan: updatedOrg.slogan,
      ownerId: updatedOrg.ownerId,
      type: updatedOrg.type || 'TEAM',
    },
  });
});

// @desc    Create a new organization
// @route   POST /api/v1/organizations
// @access  Private
export const createOrganization = asyncHandler(async (req, res) => {
  const { name, description } = req.body;

  if (!name) throw ApiError.badRequest('Organization name is required');

  const existingOrgs = await OrganizationRepository.findByOwnerId(req.user._id);
  if (existingOrgs.length >= 5) {
    throw ApiError.forbidden('You can only create up to 5 organizations', 'ORG_LIMIT_REACHED');
  }

  const organization = await organizationService.createOrganization({
    name,
    description,
    ownerId: req.user._id,
  });

  return sendSuccess(
    res,
    {
      organization: {
        id: organization.id,
        name: organization.name,
        description: organization.description,
        ownerId: organization.ownerId,
      },
      message: 'Organization created successfully',
    },
    201,
  );
});

// @desc    Get organization quota
// @route   GET /api/v1/organizations/:id/quota
// @access  Private (requires ORG_MANAGE permission)
export const getOrgQuota = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const quotaInfo = await organizationService.getOrgQuota(id);
  return sendSuccess(res, quotaInfo);
});

// @desc    Generate organizational invitation code
// @route   POST /api/v1/organizations/:id/invitations
// @access  Private (requires MEMBER_MANAGE permission)
export const generateOrgInvitation = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Guard: Personal organizations cannot invite members
  const org = await OrganizationRepository.findById(id);
  if (org && org.type === 'PERSONAL') {
    throw ApiError.forbidden(
      'Personal organizations cannot invite members',
      'PERSONAL_ORG_NO_INVITE',
    );
  }

  const invitation = await organizationService.generateOrgInvitation(id, req.user._id, req.body);
  return sendSuccess(res, invitation, 201);
});

// @desc    Get organization invitations
// @route   GET /api/v1/organizations/:id/invitations
export const getOrgInvitations = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const offset = (page - 1) * limit;

  const { records, total } = await InvitationRepository.findByOrganization(id, limit, offset);

  // Populate inviter info
  const inviterIds = [...new Set(records.map(r => r.inviter))];
  const inviters = await UserRepository.findByIds(inviterIds);
  const inviterMap = Object.fromEntries(inviters.map(u => [u.id, { _id: u.id, username: u.username, nickname: u.nickname, email: u.email }]));

  const invitations = records.map(r => ({
    ...r,
    _id: r.id, // For frontend compatibility
    inviter: inviterMap[r.inviter] || { _id: r.inviter }
  }));

  return sendSuccess(res, {
    invitations,
    pagination: { page, limit, total },
  });
});

// @desc    Revoke organizational invitation code
// @route   DELETE /api/v1/organizations/:id/invitations/:invitationId
export const revokeOrgInvitation = asyncHandler(async (req, res) => {
  const { id: orgId, invitationId } = req.params;
  const invitation = await InvitationRepository.findById(invitationId);

  if (!invitation || invitation.targetOrganizationId !== orgId) {
    throw ApiError.notFound('Invitation not found', 'INVITATION_NOT_FOUND');
  }
  
  if (invitation.status === 'REVOKED')
    throw ApiError.badRequest('Already revoked', 'ALREADY_REVOKED');

  await InvitationRepository.updateStatus(invitationId, 'REVOKED');

  return sendSuccess(res, { message: 'Invitation revoked' });
});

// @desc    Transfer organization ownership
// @route   POST /api/v1/organizations/:id/transfer-ownership
// @access  Private (Owner only)
export const transferOwnership = asyncHandler(async (req, res) => {
  const { id: organizationId } = req.params;
  const { newOwnerId } = req.body;

  if (!newOwnerId) throw ApiError.badRequest('New owner ID is required');

  const organization = await organizationService.transferOwnership(
    organizationId,
    req.user._id,
    newOwnerId,
    req.user._id,
  );

  return sendSuccess(res, {
    message: 'Ownership transferred successfully',
    organization: {
      id: organization.id,
      name: organization.name,
      ownerId: organization.ownerId,
    },
  });
});

// @desc    Join organization via invitation code
// @route   POST /api/v1/organizations/join
// @access  Private
export const joinOrganization = asyncHandler(async (req, res) => {
  const { code } = req.body;

  if (!code) {
    throw ApiError.badRequest('Invitation code is required');
  }

  const organization = await organizationService.joinOrganizationByCode(req.user._id, code);

  return sendSuccess(res, {
    message: 'Successfully joined organization',
    organization: {
      id: organization.id,
      name: organization.name,
      logo: organization.logo,
      description: organization.description,
    },
  });
});

