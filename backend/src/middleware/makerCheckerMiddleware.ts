import { Request, Response, NextFunction } from 'express';
import { FinancialApproval } from '../models/FinancialApproval';
import { buildIdFilter } from '../utils/security';

export const validateMakerCheckerGate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const approvalId = req.params.id || req.body.approvalId;
    const currentUserId = req.user?.id;
    const currentEmployeeId = req.user?.employeeId;

    if (!approvalId) {
      return res.status(400).json({
        success: false,
        message: 'Approval reference ID is required.'
      });
    }

    const approval = await FinancialApproval.findOne(buildIdFilter('approvalId', approvalId));

    if (!approval) {
      return res.status(404).json({
        success: false,
        message: 'Financial approval transaction record not found.'
      });
    }

    // Strict Maker-Checker Non-Self-Approval Rule
    if (
      approval.makerId === currentUserId ||
      approval.makerId === currentEmployeeId
    ) {
      return res.status(403).json({
        success: false,
        message: 'Security Policy Violation: The Maker who initiated this financial transaction cannot act as the Checker. Independent checker approval is mandatory.'
      });
    }

    // Attach approval object to request for downstream controller
    (req as any).approvalRecord = approval;
    next();
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: 'Maker-Checker authorization check failed: ' + error.message
    });
  }
};

