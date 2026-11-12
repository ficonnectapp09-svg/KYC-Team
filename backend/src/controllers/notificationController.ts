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
          { targetDepartment: currentUser.department },
          { targetRole: currentUser.role }
        ]
      };

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
      await NotificationItem.updateMany(
        {
          $or: [
            { targetEmployeeId: currentUser.employeeId },
            { targetDepartment: currentUser.department },
            { targetRole: currentUser.role }
          ],
          isRead: false
        },
        { $set: { isRead: true, readAt: new Date() } }
      );

      return res.json({ success: true, message: 'All notifications marked as read.' });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}

