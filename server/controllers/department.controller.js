import asyncHandler from 'express-async-handler';
import { ApiError } from '../utils/ApiError.js';
import { sendSuccess } from '../utils/response.js';
import DepartmentRepository from '../repositories/department.repository.js';
import OrganizationMemberRepository from '../repositories/organizationMember.repository.js';
import UserRepository from '../repositories/user.repository.js';

/**
 * Get all departments for an organization (tree structure)
 * @route   GET /api/v1/organizations/:id/departments
 * @access  Private
 */
export const getDepartments = asyncHandler(async (req, res) => {
  const { id: organizationId } = req.params;

  const departments = await DepartmentRepository.findByOrganization(organizationId);

  // Manual enrich manager info
  const managerIds = [...new Set(departments.map(d => d.managerId).filter(Boolean))];
  const managers = managerIds.length > 0 ? await UserRepository.findByIds(managerIds) : [];
  const managerMap = Object.fromEntries(managers.map(u => [u.id, u]));

  // Build tree structure
  const buildTree = (parentId = null) => {
    return departments
      .filter((dept) => {
        const deptParentId = dept.parentId;
        return parentId === null ? !deptParentId : deptParentId === parentId;
      })
      .map((dept) => ({
        id: dept.id,
        name: dept.name,
        parentId: dept.parentId || null,
        managerId: dept.managerId,
        manager: managerMap[dept.managerId] ? {
          _id: managerMap[dept.managerId].id,
          id: managerMap[dept.managerId].id,
          username: managerMap[dept.managerId].username,
          email: managerMap[dept.managerId].email,
        } : null,
        order: dept.order,
        description: dept.description,
        children: buildTree(dept.id),
      }));
  };

  const tree = buildTree();

  return sendSuccess(res, { departments: tree });
});

/**
 * Create a new department
 * @route   POST /api/v1/organizations/:id/departments
 * @access  Private (requires DEPT_MANAGE permission)
 */
export const createDepartment = asyncHandler(async (req, res) => {
  const { id: organizationId } = req.params;
  const { name, parentId, managerId, description } = req.body;

  if (!name || !name.trim()) {
    throw ApiError.badRequest('Department name is required', 'NAME_REQUIRED');
  }

  // Get max order for this parent
  const allDepts = await DepartmentRepository.findByOrganization(organizationId);
  const siblings = allDepts.filter(d => d.parentId === (parentId || null));
  const maxOrder = siblings.length > 0 ? Math.max(...siblings.map((d) => d.order)) : 0;

  const department = await DepartmentRepository.create({
    organizationId,
    name: name.trim(),
    parentId: parentId || null,
    managerId: managerId || null,
    order: maxOrder + 1,
    description,
  });

  // Manual population of manager
  if (department.managerId) {
    const manager = await UserRepository.findById(department.managerId);
    if (manager) {
      department.manager = {
        _id: manager.id,
        id: manager.id,
        username: manager.username,
        email: manager.email
      };
    }
  }

  return sendSuccess(res, { department }, 201);
});

/**
 * Update a department
 * @route   POST /api/v1/departments/:id
 * @access  Private (requires DEPT_MANAGE permission)
 */
export const updateDepartment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, managerId, description } = req.body;

  const department = await DepartmentRepository.findById(id);
  if (!department) {
    throw ApiError.notFound('Department not found', 'DEPT_NOT_FOUND');
  }

  const updates = {};
  if (name !== undefined) {
    if (!name.trim()) {
      throw ApiError.badRequest('Department name cannot be empty', 'NAME_EMPTY');
    }
    updates.name = name.trim();
  }

  if (managerId !== undefined) {
    updates.managerId = managerId || null;
  }

  if (description !== undefined) {
    updates.description = description;
  }

  const updatedDept = await DepartmentRepository.update(id, updates);

  // Manual population of manager for response consistency
  if (updatedDept.managerId) {
    const manager = await UserRepository.findById(updatedDept.managerId);
    if (manager) {
      updatedDept.manager = {
        _id: manager.id,
        id: manager.id,
        username: manager.username,
        email: manager.email
      };
    }
  }

  return sendSuccess(res, { department: updatedDept });
});

/**
 * Delete a department
 * @route   POST /api/v1/departments/:id/delete
 * @access  Private (requires DEPT_MANAGE permission)
 */
export const deleteDepartment = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const department = await DepartmentRepository.findById(id);
  if (!department) {
    throw ApiError.notFound('Department not found', 'DEPT_NOT_FOUND');
  }

  // Check if department has children
  const allDepts = await DepartmentRepository.findByOrganization(department.organizationId);
  const children = allDepts.filter(d => d.parentId === id);
  if (children.length > 0) {
    throw ApiError.badRequest('Cannot delete department with sub-departments', 'HAS_CHILDREN');
  }

  // Check if department has members
  const members = await OrganizationMemberRepository.findByDepartmentId(id);
  if (members.length > 0) {
    throw ApiError.badRequest(
      'Cannot delete department with members. Please reassign members first.',
      'HAS_MEMBERS',
    );
  }

  await DepartmentRepository.delete(id);

  return sendSuccess(res, { message: 'Department deleted successfully' });
});

/**
 * Move a department (change parent or order)
 * @route   POST /api/v1/departments/:id/move
 * @access  Private (requires DEPT_MANAGE permission)
 */
export const moveDepartment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { parentId, order } = req.body;

  const department = await DepartmentRepository.findById(id);
  if (!department) {
    throw ApiError.notFound('Department not found', 'DEPT_NOT_FOUND');
  }

  // Prevent circular reference
  if (parentId) {
    let checkParent = await DepartmentRepository.findById(parentId);
    while (checkParent) {
      if (checkParent.id === id) {
        throw ApiError.badRequest(
          'Cannot move department to its own descendant',
          'CIRCULAR_REFERENCE',
        );
      }
      if (!checkParent.parentId) break;
      checkParent = await DepartmentRepository.findById(checkParent.parentId);
    }
  }

  const updates = {
    parentId: parentId || null
  };
  if (order !== undefined) {
    updates.order = order;
  }

  const updatedDept = await DepartmentRepository.update(id, updates);

  // Manual population
  if (updatedDept.managerId) {
    const manager = await UserRepository.findById(updatedDept.managerId);
    if (manager) {
      updatedDept.manager = {
        _id: manager.id,
        id: manager.id,
        username: manager.username,
        email: manager.email
      };
    }
  }

  return sendSuccess(res, { department: updatedDept });
});
