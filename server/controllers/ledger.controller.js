import TokenUsageRepository from '../repositories/tokenUsage.repository.js';
import UserRepository from '../repositories/user.repository.js';
import ApplicationRepository from '../repositories/application.repository.js';
import asyncHandler from 'express-async-handler';
import { sendSuccess } from '../utils/response.js';

/**
 * Helper to populate records with User and App info
 */
async function populateRecords(records) {
  if (!records || records.length === 0) return [];

  const userIds = [...new Set(records.map(r => r.userId).filter(Boolean))];
  const appIds = [...new Set(records.map(r => r.appId).filter(Boolean))];

  const [users, apps] = await Promise.all([
    UserRepository.findByIds(userIds),
    appIds.length > 0 ? ApplicationRepository.find().then(list => list.filter(a => appIds.includes(a.id))) : Promise.resolve([])
  ]);

  const userMap = Object.fromEntries(users.map(u => [u.id, { id: u.id, username: u.username, email: u.email, nickname: u.nickname }]));
  const appMap = Object.fromEntries(apps.map(a => [a.id, { id: a.id, name: a.name }]));

  return records.map(r => ({
    ...r,
    userId: userMap[r.userId] || { id: r.userId },
    appId: appMap[r.appId] || (r.appId ? { id: r.appId } : null)
  }));
}

/**
 * Get AI consumption ledger for an organization
 */
export const getOrgLedger = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { page = 1, limit = 20, userId, appId, model, startTime, endTime } = req.query;

  const filters = {
    organizationId: id,
    userId,
    appId,
    model,
    startTime,
    endTime
  };

  const { records, total } = await TokenUsageRepository.findWithFilters(filters, {
    page: parseInt(page),
    limit: parseInt(limit)
  });

  const populated = await populateRecords(records);

  return sendSuccess(res, {
    records: populated,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / parseInt(limit))
    }
  });
});

/**
 * Get AI consumption ledger for a specific user
 */
export const getMyLedger = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;

  const { records, total } = await TokenUsageRepository.findWithFilters({ userId: req.user.id }, {
    page: parseInt(page),
    limit: parseInt(limit)
  });

  const populated = await populateRecords(records);

  return sendSuccess(res, {
    records: populated,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / parseInt(limit))
    }
  });
});
