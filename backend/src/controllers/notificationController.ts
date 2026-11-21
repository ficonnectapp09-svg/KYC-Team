import { Request, Response } from 'express';
import { NotificationItem } from '../models/NotificationItem';
import { buildIdFilter } from '../utils/security';

export class NotificationController {
  static async listNotifications(req: Request, res: Response): Promise<any> {
    try {
      const currentUser = req.user!;
      const filter: any = {
        $or: [
          { targetEmployeeId: currentUser.employeeId },
          {
            targetRole: currentUser.role,
            $or: [
              { targetDepartment: currentUser.department },
              { targetDepartment: { $exists: false } },
              { targetDepartment: null }
            ]
          },
          {
            targetDepartment: currentUser.department,
            $or: [
              { targetRole: { $exists: false } },
              { targetRole: null }
            ]
          }
        ]
      };
      if (currentUser.role === 'overall_lead') {
        filter.$or.push({ targetRole: 'overall_lead' });
      }

      const notifications = await NotificationItem.find(filter)
        .sort({ createdAt: -1 })
        .limit(50);

      const unreadCount = await NotificationItem.countDocuments({
        ...filter,
        isRead: false
      });

      return res.json({
        success: true,
        unreadCount,
        data: notifications
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async markAsRead(req: Request, res: Response): Promise<any> {
    try {
      const { id } = req.params;
      await NotificationItem.findOneAndUpdate(
        buildIdFilter('notificationId', id),
        { $set: { isRead: true, readAt: new Date() } }
      );

      return res.json({ success: true, message: 'Notification marked as read.' });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async markAllAsRead(req: Request, res: Response): Promise<any> {
    try {
      const currentUser = req.user!;
      const markFilter: any = {
        $or: [
          { targetEmployeeId: currentUser.employeeId },
          {
            targetRole: currentUser.role,
            $or: [
              { targetDepartment: currentUser.department },
              { targetDepartment: { $exists: false } },
              { targetDepartment: null }
            ]
          },
          {
            targetDepartment: currentUser.department,
            $or: [
              { targetRole: { $exists: false } },
              { targetRole: null }
            ]
          }
        ],
        isRead: false
      };
      if (currentUser.role === 'overall_lead') {
        markFilter.$or.push({ targetRole: 'overall_lead' });
      }

      await NotificationItem.updateMany(
        markFilter,
        { $set: { isRead: true, readAt: new Date() } }
      );

      return res.json({ success: true, message: 'All notifications marked as read.' });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}

