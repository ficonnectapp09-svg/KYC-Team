import { Request, Response } from 'express';
import { AuditTrail } from '../models/AuditTrail';

export class AuditController {
  static async listAuditLogs(req: Request, res: Response): Promise<any> {
    try {
      const { module, actorId, search, startDate, endDate } = req.query;
      const filter: any = {};

      if (module && module !== 'All') filter.module = module;
      if (actorId && actorId !== 'All') filter.actorId = actorId;

      if (startDate || endDate) {
        filter.timestamp = {};
        if (startDate) filter.timestamp.$gte = new Date(startDate as string);
        if (endDate) filter.timestamp.$lte = new Date(endDate as string);
      }

      if (search) {
        filter.$or = [
          { action: { $regex: search, $options: 'i' } },
          { actorName: { $regex: search, $options: 'i' } },
          { details: { $regex: search, $options: 'i' } },
          { targetId: { $regex: search, $options: 'i' } }
        ];
      }

      const logs = await AuditTrail.find(filter)
        .sort({ timestamp: -1 })
        .limit(100);

      return res.json({
        success: true,
        count: logs.length,
        data: logs
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}

