import { SalaryStructure } from '../models/SalaryStructure';
import { SalaryRecord } from '../models/SalaryRecord';
import { SalaryStatus } from '../config/constants';
import { generateId, maskBankAccount } from '../utils/security';
import { Employee } from '../models/Employee';

export class PayrollEngineService {
  /**
   * Prepare a salary statement for an employee for a given period.
   */
  static async prepareSalaryRecord(params: {
    employeeId: string;
    periodStart: Date;
    periodEnd: Date;
    periodLabel: string;
    incentives?: number;
    bonus?: number;
    overtime?: number;
    advanceRecovery?: number;
    unpaidLeaveDeduction?: number;
    preparedByUser: { id: string; name: string; role: string };
  }) {
    const { employeeId, periodStart, periodEnd, periodLabel, preparedByUser } = params;

    // Check for duplicate salary statement
    const existing = await SalaryRecord.findOne({ employeeId, periodLabel });
    if (existing) {
      throw new Error(`Salary record for employee ${employeeId} and period "${periodLabel}" has already been generated.`);
    }

    // Fetch employee and configured salary structure
    const employee = await Employee.findOne({ employeeId });
    if (!employee) throw new Error(`Employee ${employeeId} not found.`);

    let structure = await SalaryStructure.findOne({ employeeId, isActive: true });
    if (!structure) {
      // Default baseline structure if not yet configured
      structure = await SalaryStructure.create({
        employeeId: employee.employeeId,
        employeeName: employee.name,
        department: employee.department,
        designation: employee.designation,
        salaryCycle: employee.salaryCycle,
        basicSalary: 25000,
        hra: 10000,
        otherAllowances: 5000,
        grossSalary: 40000,
        pfDeduction: 1800,
        esiDeduction: 300,
        totalDeductions: 2100,
        netPayable: 37900
      });
    }

    const earnings = {
      basic: structure.basicSalary,
      hra: structure.hra || 0,
      allowances: structure.otherAllowances || 0,
      incentives: params.incentives !== undefined ? params.incentives : (structure.incentives || 0),
      bonus: params.bonus !== undefined ? params.bonus : (structure.bonus || 0),
      overtime: params.overtime || 0,
      gross: 0
    };
    earnings.gross = earnings.basic + earnings.hra + earnings.allowances + earnings.incentives + earnings.bonus + earnings.overtime;

    const deductions = {
      pf: structure.pfDeduction || 0,
      esi: structure.esiDeduction || 0,
      tax: structure.taxDeduction || 0,
      advanceRecovery: params.advanceRecovery || 0,
      unpaidLeaveDeduction: params.unpaidLeaveDeduction || 0,
      other: structure.otherDeductions || 0,
      total: 0
    };
    deductions.total = deductions.pf + deductions.esi + deductions.tax + deductions.advanceRecovery + deductions.unpaidLeaveDeduction + deductions.other;

    const netSalary = Math.max(0, earnings.gross - deductions.total);

    const record = new SalaryRecord({
      salaryId: generateId('SAL'),
      employeeId: employee.employeeId,
      employeeName: employee.name,
      department: employee.department,
      designation: employee.designation,
      salaryCycle: employee.salaryCycle,
      periodStart,
      periodEnd,
      periodLabel,
      earnings,
      deductions,
      netSalary,
      bankDetails: {
        accountHolder: employee.bankDetails?.accountHolder || employee.name,
        accountNumberMasked: maskBankAccount(employee.bankDetails?.accountNumber),
        ifscCode: employee.bankDetails?.ifscCode || 'HDFC0001234',
        bankName: employee.bankDetails?.bankName || 'HDFC Bank'
      },
      status: SalaryStatus.SUBMITTED_FOR_OVERALL_APPROVAL,
      preparedBy: {
        userId: preparedByUser.id,
        name: preparedByUser.name,
        role: preparedByUser.role,
        at: new Date()
      }
    });

    await record.save();
    return record;
  }
}

