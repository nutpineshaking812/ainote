import express from 'express';
import { protect } from '../middleware/auth.middleware.js';
import {
  getDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  moveDepartment,
} from '../controllers/department.controller.js';

const router = express.Router();

// Get all departments for an organization
router.get('/:id/departments', protect, getDepartments);

// Create a new department
router.post('/:id/departments', protect, createDepartment);

// Update a department
router.post('/:id', protect, updateDepartment);

// Delete a department
router.post('/:id/delete', protect, deleteDepartment);

// Move a department
router.post('/:id/move', protect, moveDepartment);

export default router;
