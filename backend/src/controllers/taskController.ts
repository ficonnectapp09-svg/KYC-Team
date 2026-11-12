import { Request, Response } from 'express';
import { TaskItem } from '../models/TaskItem';
import { Department, Role, TaskStatus } from '../config/constants';
import { generateId, buildIdFilter } from '../utils/security';
import { logAudit } from '../middleware/auditLogger';

export class TaskController {
  static async listTasks(req: Request, res: Response): Promise<any> {
    try {
      const { department, status, priority, search } = req.query;
      const currentUser = req.user!;

      const filter: any = {};

      if (currentUser.role !== Role.OVERALL_LEAD) {
        if ([Role.KYC_EMPLOYEE, Role.PAYMENT_EMPLOYEE, Role.QUERIES_EMPLOYEE].includes(currentUser.role as Role)) {
          filter['assignedTo.employeeId'] = currentUser.employeeId;
        } else {
          // Team Lead sees their department tasks
          filter.department = currentUser.department;
        }
      } else if (department && department !== 'All') {
        filter.department = department;
      }

      if (status && status !== 'All') filter.status = status;
      if (priority && priority !== 'All') filter.priority = priority;
      if (search) {
        filter.$or = [
          { taskId: { $regex: search, $options: 'i' } },
          { title: { $regex: search, $options: 'i' } },
          { 'assignedTo.name': { $regex: search, $options: 'i' } }
        ];
      }

      const tasks = await TaskItem.find(filter).sort({ dueDate: 1 });

      return res.json({
        success: true,
        count: tasks.length,
        data: tasks
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async createTask(req: Request, res: Response): Promise<any> {
    try {
      const currentUser = req.user!;
      const {
        title,
        description,
        department,
        assignedToEmployeeId,
        assignedToName,
        assignedToRole,
        priority,
        dueDate
      } = req.body;

      if (!title || !department || !assignedToEmployeeId) {
        return res.status(400).json({
          success: false,
          message: 'title, department, and assignedToEmployeeId are required.'
        });
      }

      // Department Lead cannot assign cross-department unless Overall Lead
      if (currentUser.role !== Role.OVERALL_LEAD && department !== currentUser.department) {
        return res.status(403).json({
          success: false,
          message: 'Access Denied: Only the Overall Team Lead can assign cross-department tasks.'
        });
      }

      const taskId = generateId('TSK');

      const task = new TaskItem({
        taskId,
        title,
        description: description || '',
        department: department as Department,
        assignedTo: {
          employeeId: assignedToEmployeeId,
          name: assignedToName || 'Assigned Staff',
          role: assignedToRole || 'Staff'
        },
        assignedBy: {
          employeeId: currentUser.employeeId,
          name: currentUser.name,
          role: currentUser.role
        },
        priority: priority || 'Medium',
        status: TaskStatus.ASSIGNED,
        dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        comments: []
      });

      await task.save();

      await logAudit(
        req,
        'TASK_CREATED',
        'TASK',
        taskId,
        `Task "${title}" created by ${currentUser.name} for ${assignedToName}.`
      );

      return res.status(201).json({
        success: true,
        message: 'Task assigned successfully.',
        data: task
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async updateTaskStatus(req: Request, res: Response): Promise<any> {
    try {
      const currentUser = req.user!;
      const { id } = req.params;
      const { status, comment, submittedEvidence } = req.body;

      const task = await TaskItem.findOne(buildIdFilter('taskId', id));

      if (!task) {
        return res.status(404).json({ success: false, message: 'Task not found.' });
      }

      if (status) task.status = status as TaskStatus;
      if (submittedEvidence) task.submittedEvidence = submittedEvidence;

      if (comment) {
        task.comments.push({
          authorId: currentUser.employeeId,
          authorName: currentUser.name,
          comment,
          timestamp: new Date()
        });
      }

      await task.save();

      return res.json({
        success: true,
        message: 'Task updated successfully.',
        data: task
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}

