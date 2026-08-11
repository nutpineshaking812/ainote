import UserRepository from '../repositories/user.repository.js';
import QuotaRepository from '../repositories/quota.repository.js';
import OrganizationMemberRepository from '../repositories/organizationMember.repository.js';
import asyncHandler from 'express-async-handler';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';

/**
 * Update user profile
 * @desc    Update user's nickname or avatar
 * @route   PUT /api/v1/user/profile
 * @access  Private
 */
export const updateUserProfile = asyncHandler(async (req, res) => {
  const { nickname, avatar } = req.body;
  
  const updatedUser = await UserRepository.update(req.user.id, {
    nickname,
    avatar
  });

  if (!updatedUser) {
    throw ApiError.notFound('User not found', 'USER_NOT_FOUND');
  }

  return sendSuccess(res, {
    id: updatedUser.id,
    username: updatedUser.username,
    nickname: updatedUser.nickname,
    email: updatedUser.email,
    avatar: updatedUser.avatar,
  });
});

// @desc    Get user quota and usage
// @route   GET /api/v1/user/quota
// @access  Private
export const getUserQuota = asyncHandler(async (req, res) => {
  let quota = await QuotaRepository.findOne('USER', req.user.id);

  if (!quota) {
    // Lazy create if not found
    quota = await QuotaRepository.create({ 
      targetType: 'USER', 
      targetId: req.user.id,
      usageLimit: -1, // Default unlimited
      invitationSlots: 5, // Default Slots
    });
  }

  let orgQuota = null;
  const orgId = req.headers['x-organization-id'];
  if (orgId) {
    const member = await OrganizationMemberRepository.findOne(req.user.id, orgId);
    if (member) {
      orgQuota = await QuotaRepository.findOne('ORG', member.organizationId);
    }
  }

  return sendSuccess(res, {
    totalTokenUsage: quota.totalTokenUsage,
    usageLimit: quota.usageLimit,
    invitationSlots: quota.invitationSlots,
    orgTokenBalance: orgQuota ? orgQuota.tokenBalance : 0,
    orgTotalUsage: orgQuota ? orgQuota.totalTokenUsage : 0,
  });
});

// @desc    Change user password
// @route   PUT /api/v1/user/password
// @access  Private
export const changePassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  const user = await UserRepository.findById(req.user.id);

  if (user) {
    // Check old password
    if (!(await UserRepository.matchPassword(oldPassword, user.password))) {
      throw ApiError.unauthorized('Invalid old password', 'INVALID_OLD_PASSWORD');
    }

    // Validate new password length
    if (!newPassword || newPassword.length < 6) {
      throw ApiError.badRequest(
        'New password must be at least 6 characters long',
        'PASSWORD_TOO_SHORT',
      );
    }

    // Update password (hash it manually for Postgres update)
    const hashedPassword = await UserRepository.hashPassword(newPassword);
    await UserRepository.update(user.id, { password: hashedPassword });

    return sendSuccess(res, { message: 'Password updated successfully' });
  } else {
    throw ApiError.notFound('User not found', 'USER_NOT_FOUND');
  }
});
