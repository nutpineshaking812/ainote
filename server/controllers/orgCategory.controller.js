import orgCategoryService from '../services/orgCategory.service.js';
import asyncHandler from 'express-async-handler';
import { sendSuccess } from '../utils/response.js';

/**
 * @desc    Get all categories for an organization
 * @route   GET /api/v1/org-categories
 * @access  Private
 */
const getCategories = asyncHandler(async (req, res) => {
  const categories = await orgCategoryService.getCategories(req.organization, req.user.id);
  sendSuccess(res, categories);
});

/**
 * @desc    Create a new category for an organization
 * @route   POST /api/v1/org-categories/create
 * @access  Private
 */
const createCategory = asyncHandler(async (req, res) => {
  const organizationId = req.organization.id;
  const category = await orgCategoryService.createCategory(req.body, organizationId, req.user.id);
  sendSuccess(res, category, 201);
});

/**
 * @desc    Update a category for an organization
 * @route   POST /api/v1/org-categories/update
 * @access  Private
 */
const updateCategory = asyncHandler(async (req, res) => {
  const organizationId = req.organization.id;
  const { id, ...updateData } = req.body;
  const category = await orgCategoryService.updateCategory(id, updateData, organizationId);
  sendSuccess(res, category);
});

/**
 * @desc    Delete a category for an organization
 * @route   POST /api/v1/org-categories/delete
 * @access  Private
 */
const deleteCategory = asyncHandler(async (req, res) => {
  const organizationId = req.organization.id;
  const { id } = req.body;
  await orgCategoryService.deleteCategory(id, organizationId);
  sendSuccess(res, null, 204);
});

export default {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
};
