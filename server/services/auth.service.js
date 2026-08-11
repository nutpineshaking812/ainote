import UserRepository from '../repositories/user.repository.js';
import jwt from 'jsonwebtoken';
import { ApiError } from '../utils/ApiError.js';
import env from '../config/env.js';
import InvitationRepository from '../repositories/invitation.repository.js';
import RoleRepository from '../repositories/role.repository.js';
import OrganizationMemberRepository from '../repositories/organizationMember.repository.js';
import QuotaRepository from '../repositories/quota.repository.js';
import {
  getUserOrganizations,
  getUserPermissions,
  createPersonalOrganization,
} from './organization.service.js';
import { syncMemberAssignments } from './member.service.js';
import { db } from '../db/index.js';
import crypto from 'crypto';

/**
 * Register a new user
 * @param {Object} userData - User registration data
 * @returns {Promise<Object>} Registered user data and token
 */
export const registerUser = async (userData) => {
  const { username, email, password, nickname, inviteCode } = userData;

  return await db.transaction(async (tx) => {
    // Validate Invitation
    if (!inviteCode) {
      throw ApiError.badRequest('Invitation code is required', 'INVITE_CODE_REQUIRED');
    }

    const isFixedCode = inviteCode === env.FIXED_INVITATION_CODE;
    const invitation = await InvitationRepository.findByCode(inviteCode);

    if (!invitation) {
      throw ApiError.badRequest('Invalid or expired invitation code', 'INVALID_INVITE_CODE');
    }

    if (!isFixedCode && invitation.maxUses !== -1 && invitation.uses >= invitation.maxUses) {
      throw ApiError.badRequest('Invitation code has reached maximum uses', 'INVITE_CODE_FULL');
    }

    const userExists = await UserRepository.findByCredentials(email) || await UserRepository.findByCredentials(username);
    if (userExists) {
      throw ApiError.conflict('User already exists', 'USER_EXISTS');
    }

    // Create User in PostgreSQL
    const user = await UserRepository.createUser({
      username,
      email,
      password,
      nickname,
      invitedBy: invitation.inviter,
    });

    // Create Personal Organization for the new user (shadow workspace)
    const personalOrg = await createPersonalOrganization(user.id, nickname || username, {
      tx,
    });

    // Update Invitation in PostgreSQL
    await InvitationRepository.incrementUses(invitation.id, user.id);
    
    if (!isFixedCode && invitation.maxUses !== -1 && (invitation.uses + 1) >= invitation.maxUses) {
      await InvitationRepository.updateStatus(invitation.id, 'EXPIRED');
    }

    // Create User Quota in PostgreSQL
    await QuotaRepository.create({
      targetType: 'USER',
      targetId: user.id,
      usageLimit: -1,
      invitationSlots: env.DEFAULT_INVITATION_SLOTS || 5,
    });

    // Join Organization if targetOrganizationId exists
    if (invitation.targetOrganizationId) {
      const organizationId = invitation.targetOrganizationId;
      const orgQuota = await QuotaRepository.findOne('ORG', organizationId);

      if (orgQuota && orgQuota.memberLimit !== -1) {
        const members = await OrganizationMemberRepository.findByOrganization(organizationId);
        const activeMembers = members.filter(m => m.status === 'ACTIVE');
        if (activeMembers.length >= orgQuota.memberLimit) {
          throw ApiError.forbidden('The organization has reached its member limit', 'ORG_FULL');
        }
      }

      let memberRole = await RoleRepository.findOne({
        organizationId,
        key: 'SYSTEM_MEMBER',
      });

      if (!memberRole) {
        memberRole = await RoleRepository.findOne({
          organizationId,
          name: 'Member',
          isSystem: true,
        });

        if (memberRole) {
          await RoleRepository.update(memberRole.id, { key: 'SYSTEM_MEMBER' });
        }
      }

      if (!memberRole) {
        throw ApiError.internal('Default member role not found', 'ROLE_NOT_FOUND');
      }

      await OrganizationMemberRepository.create({
        userId: user.id,
        organizationId,
        roleIds: [memberRole.id],
        status: 'ACTIVE',
        joinedAt: new Date(),
      });

      await syncMemberAssignments(
        user.id,
        organizationId,
        [memberRole.id],
        invitation.inviter,
        { tx },
      );
    }

    // Generate Token and Fetch Data (inside transaction or after, but let's keep it here for simplicity if needed)
    // Actually, it's better to return and sign outside, but I'll follow the existing flow for now.

    // Generate Token and Fetch Data (after transaction)
    const token = jwt.sign({ id: user.id }, env.JWT_SECRET, { expiresIn: '15d' });
    const organizations = await getUserOrganizations(user.id);

    let permissions = [];
    if (organizations.length > 0) {
      permissions = await getUserPermissions(user.id, organizations[0].organization.id);
    }

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        nickname: user.nickname,
      },
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
      currentOrganization: organizations.length > 0 ? organizations[0].organization.id : null,
      permissions,
    };
  });
};

/**
 * Auth user & get token
 * @param {Object} credentials - Login credentials
 * @returns {Promise<Object>} User data and token
 */
export const loginUser = async ({ email, password }) => {
  const user = await UserRepository.findByCredentials(email);
  if (!user || !(await UserRepository.matchPassword(password, user.password))) {
    throw ApiError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  const token = jwt.sign({ id: user.id }, env.JWT_SECRET, { expiresIn: '15d' });

  // Lazy create quota if not exists
  let userQuota = await QuotaRepository.findOne('USER', user.id);
  if (!userQuota) {
    await QuotaRepository.create({
      targetType: 'USER',
      targetId: user.id,
      usageLimit: -1,
    });
  }

  const organizations = await getUserOrganizations(user.id);

  let permissions = [];
  if (organizations.length > 0) {
    permissions = await getUserPermissions(user.id, organizations[0].organization.id);
  }

  return {
    token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      nickname: user.nickname,
    },
    organizations: organizations.map((org) => ({
      id: org.organization.id,
      name: org.organization.name,
      logo: org.organization.logo,
      description: org.organization.description,
      slogan: org.organization.slogan,
      ownerId: org.organization.ownerId,
      roles: org.roles.map((r) => ({ id: r.id, name: r.name })),
      departments: org.departments,
      joinedAt: org.joinedAt,
      type: org.organization.type,
    })),
    currentOrganization: organizations.length > 0 ? organizations[0].organization.id : null,
    permissions,
  };
};

/**
 * Generate a new invitation code
 * @param {String} userId - Inviter ID
 * @param {Number} maxUses - Maximum uses for the code
 * @returns {Promise<Object>} Created invitation
 */
export const generatePlatformInvitation = async (userId, maxUses = 1) => {
  const userQuota = await QuotaRepository.findOne('USER', userId);
  if (!userQuota || userQuota.invitationSlots <= 0) {
    throw ApiError.forbidden('No invitation slots remaining', 'NO_SLOTS_REMAINING');
  }

  const code = crypto.randomBytes(4).toString('hex').toUpperCase();

  const invitation = await InvitationRepository.create({
    code,
    inviter: userId,
    targetOrganizationId: null,
    type: 'PLATFORM',
    maxUses,
  });

  // Atomic decrement
  await QuotaRepository.addInvitationSlots('USER', userId, -1);

  return invitation;
};
