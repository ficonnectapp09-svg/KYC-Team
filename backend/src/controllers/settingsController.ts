import { Request, Response } from 'express';
import { SystemConfig, DEFAULT_ROLE_PERMISSIONS } from '../models/SystemConfig';
import { Role } from '../config/constants';
import { logAudit } from '../middleware/auditLogger';

export class SettingsController {
  static async getSettings(req: Request, res: Response): Promise<any> {
    try {
      let config = await SystemConfig.findOne({ configKey: 'GLOBAL_BACKOFFICE_CONFIG' });
      if (!config) {
        config = await SystemConfig.create({
          configKey: 'GLOBAL_BACKOFFICE_CONFIG',
          rolePermissions: DEFAULT_ROLE_PERMISSIONS
        });
      }

      return res.json({
        success: true,
        data: config
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async updateSettings(req: Request, res: Response): Promise<any> {
    try {
      const currentUser = req.user!;
      if (currentUser.role !== Role.OVERALL_LEAD) {
        return res.status(403).json({
          success: false,
          message: 'Only the Overall Team Lead can modify system settings and role permission matrices.'
        });
      }

      const { kycSettings, paymentSettings, queriesSettings, rolePermissions } = req.body;

      let config = await SystemConfig.findOne({ configKey: 'GLOBAL_BACKOFFICE_CONFIG' });
      if (!config) {
        config = new SystemConfig({
          configKey: 'GLOBAL_BACKOFFICE_CONFIG',
          rolePermissions: DEFAULT_ROLE_PERMISSIONS
        });
      }

      if (kycSettings) {
        config.kycSettings = { ...config.kycSettings, ...kycSettings };
      }
      if (paymentSettings) {
        config.paymentSettings = { ...config.paymentSettings, ...paymentSettings };
      }
      if (queriesSettings) {
        config.queriesSettings = { ...config.queriesSettings, ...queriesSettings };
      }
      if (rolePermissions) {
        config.rolePermissions = rolePermissions;
      }

      config.updatedBy = {
        userId: currentUser.employeeId,
        name: currentUser.name,
        at: new Date()
      };

      await config.save();

      await logAudit(
        req,
        'SYSTEM_SETTINGS_UPDATED',
        'SETTINGS',
        'GLOBAL_BACKOFFICE_CONFIG',
        `${currentUser.name} updated system workflow settings and/or permission matrix.`
      );

      return res.json({
        success: true,
        message: 'System configuration updated successfully.',
        data: config
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}

