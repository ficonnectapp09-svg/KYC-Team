import dotenv from 'dotenv';
import { connectDatabase } from '../config/database';
import { Employee } from '../models/Employee';
import { SystemConfig, DEFAULT_ROLE_PERMISSIONS } from '../models/SystemConfig';
import { Department, Role } from '../config/constants';
import { hashPassword } from './security';

dotenv.config();

/**
 * Idempotent system configuration bootstrap utility.
 * Does NOT generate fabricated customers, KYC requests, transactions, queries, or salaries.
 * Optional initial admin creation requires explicit BOOTSTRAP_ADMIN_EMAIL & BOOTSTRAP_ADMIN_PASSWORD env vars.
 */
export const bootstrapSystemDefaults = async () => {
  try {
    await connectDatabase();

    const existingConfig = await SystemConfig.findOne({ configKey: 'global' });
    if (!existingConfig) {
      await SystemConfig.create({
        configKey: 'global',
        rolePermissions: DEFAULT_ROLE_PERMISSIONS
      });
      console.log('[Bootstrap]: Initialized default SystemConfig permissions.');
    }

    const adminEmail = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
    const adminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD?.trim();
    if (adminEmail && adminPassword) {
      const existingAdmin = await Employee.findOne({ email: adminEmail });
      if (!existingAdmin) {
        const hashedPassword = await hashPassword(adminPassword);
        await Employee.create({
          employeeId: 'EMP-LEAD-001',
          name: process.env.BOOTSTRAP_ADMIN_NAME?.trim() || 'Overall Team Lead',
          email: adminEmail,
          phone: process.env.BOOTSTRAP_ADMIN_PHONE?.trim() || '',
          password: hashedPassword,
          department: Department.OVERALL,
          designation: 'Overall Team Lead',
          role: Role.OVERALL_LEAD,
          employmentType: 'Full-time',
          workLocation: 'Headquarters',
          salaryCycle: 'Monthly',
          status: 'active',
          permissions: ['all']
        });
        console.log(`[Bootstrap]: Created initial Overall Lead account for ${adminEmail}.`);
      }
    }

    console.log('[Bootstrap]: System defaults verified without mock/demo business data.');
    process.exit(0);
  } catch (error: any) {
    console.error('[Bootstrap]: Error initializing system defaults:', error);
    process.exit(1);
  }
};

if (require.main === module) {
  bootstrapSystemDefaults();
}
