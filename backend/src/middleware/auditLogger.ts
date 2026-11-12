import { Request, Response, NextFunction } from 'express';
import { AuditTrail } from '../models/AuditTrail';

export const logAudit = async (
  req: Request,
  action: string,
  module: 'AUTH' | 'STAFF' | 'KYC' | 'PAYMENT' | 'QUERIES' | 'SALARY' | 'TASK' | 'SECURITY' | 'SETTINGS',
  targetId: string,
  details: string,
  metadata?: Record<string, any>
): Promise<void> => {
  try {
    const actorId = req?.user?.employeeId || req?.user?.id || 'SYSTEM';
    const actorName = req?.user?.name || 'System Service';
    const actorRole = req?.user?.role || 'SYSTEM';
    const department = req?.user?.department || 'System';
    const ipAddress = (req?.headers?.['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req?.socket?.remoteAddress || '127.0.0.1';
    const userAgent = req?.headers?.['user-agent'] || 'Backoffice Platform';

    await AuditTrail.create({
      actorId,
      actorName,
      actorRole,
      department,
      action,
      module,
      targetId,
      details,
      ipAddress,
      userAgent,
      metadata: metadata || {},
      timestamp: new Date()
    });
  } catch (err: any) {
    console.error('[Audit Trail]: Failed to write audit log:', err.message);
  }
};

