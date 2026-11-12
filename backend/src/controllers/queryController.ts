import { Request, Response } from 'express';
import { QueryTicket } from '../models/QueryTicket';
import { Employee } from '../models/Employee';
import { Department, QueryStatus, Role } from '../config/constants';
import { QUERY_CATEGORIES, resolveQueryCategory } from '../config/categoryCatalog';
import { generateId, buildIdFilter } from '../utils/security';
import { logAudit } from '../middleware/auditLogger';
import { NotificationItem } from '../models/NotificationItem';

export class QueryController {
  private static buildScopeClause(currentUser: NonNullable<Request['user']>) {
    if (currentUser.role !== Role.OVERALL_LEAD) {
      return {
        $or: [
          { currentDepartment: currentUser.department },
          { sourceDepartment: currentUser.department },
          { sharedDepartments: currentUser.department }
        ]
      };
    }
    return {};
  }

  private static computeCategoryCountsFromList(userTypes: string[]): Record<string, number> {
    const byUserType = new Map<string, number>();
    let allTotal = 0;
    for (const ut of userTypes) {
      allTotal += 1;
      byUserType.set(ut, (byUserType.get(ut) || 0) + 1);
    }
    const counts: Record<string, number> = { ALL: allTotal };
    for (const cat of QUERY_CATEGORIES) {
      if (cat.key !== 'ALL' && cat.userTypes) {
        counts[cat.key] = cat.userTypes.reduce((sum, ut) => sum + (byUserType.get(ut) || 0), 0);
      }
    }
    return counts;
  }

  static async getCategoryCounts(req: Request, res: Response): Promise<any> {
    try {
      const scope = QueryController.buildScopeClause(req.user!);
      const tickets = await QueryTicket.find(scope).select('userType').lean();
      return res.json({
        success: true,
        data: QueryController.computeCategoryCountsFromList(tickets.map((t) => t.userType))
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async listQueries(req: Request, res: Response): Promise<any> {
    try {
      const {
        sourceCategory,
        userType,
        department,
        status,
        priority,
        category,
        assignedEmployeeId,
        startDate,
        endDate,
        search,
        page = '1',
        limit = '50'
      } = req.query;
      const currentUser = req.user!;

      const rawCategory = (sourceCategory as string) || (userType as string) || 'ALL';
      const resolvedCategory = resolveQueryCategory(rawCategory);
      if (!resolvedCategory) {
        return res.status(400).json({
          success: false,
          message: `Unsupported Query user category filter: "${rawCategory}".`
        });
      }

      const scopeClause = QueryController.buildScopeClause(currentUser);
      const andClauses: any[] = [];
      if (Object.keys(scopeClause).length > 0) {
        andClauses.push(scopeClause);
      } else if (department && department !== 'All') {
        andClauses.push({ currentDepartment: department });
      }

      if (resolvedCategory.userTypes && resolvedCategory.userTypes.length > 0) {
        andClauses.push({ userType: { $in: resolvedCategory.userTypes } });
      }
      if (status && status !== 'All') andClauses.push({ status });
      if (priority && priority !== 'All') andClauses.push({ priority });
      if (category && category !== 'All') andClauses.push({ category });
      if (assignedEmployeeId && assignedEmployeeId !== 'All') {
        andClauses.push({
          assignedEmployeeId: assignedEmployeeId === 'UNASSIGNED' ? null : assignedEmployeeId
        });
      }

      if (startDate || endDate) {
        const dtRange: any = {};
        if (startDate) dtRange.$gte = new Date(startDate as string);
        if (endDate) {
          const endDt = new Date(endDate as string);
          endDt.setHours(23, 59, 59, 999);
          dtRange.$lte = endDt;
        }
        andClauses.push({ createdAt: dtRange });
      }

      if (search) {
        andClauses.push({
          $or: [
            { queryId: { $regex: search, $options: 'i' } },
            { userName: { $regex: search, $options: 'i' } },
            { userId: { $regex: search, $options: 'i' } },
            { subject: { $regex: search, $options: 'i' } },
            { category: { $regex: search, $options: 'i' } }
          ]
        });
      }

      const filter = andClauses.length > 0 ? { $and: andClauses } : {};
      const pageNum = Math.max(1, Number(page) || 1);
      const limitNum = Math.min(100, Math.max(1, Number(limit) || 50));
      const skip = (pageNum - 1) * limitNum;

      const categoryScopeAnd: any[] = [];
      if (Object.keys(scopeClause).length > 0) categoryScopeAnd.push(scopeClause);
      if (resolvedCategory.userTypes && resolvedCategory.userTypes.length > 0) {
        categoryScopeAnd.push({ userType: { $in: resolvedCategory.userTypes } });
      }
      const categoryBaseFilter = categoryScopeAnd.length > 0 ? { $and: categoryScopeAnd } : {};

      const [queries, total, categoryItems, allScopedTickets] = await Promise.all([
        QueryTicket.find(filter).sort({ lastUpdated: -1 }).skip(skip).limit(limitNum),
        QueryTicket.countDocuments(filter),
        QueryTicket.find(categoryBaseFilter).select('status').lean(),
        QueryTicket.find(scopeClause).select('userType').lean()
      ]);

      const summary = {
        totalCount: categoryItems.length,
        pendingCount: categoryItems.filter((q) =>
          [QueryStatus.NEW, QueryStatus.WAITING_FOR_RESPONSE, QueryStatus.OVERDUE].includes(q.status as QueryStatus)
        ).length,
        inProgressCount: categoryItems.filter((q) =>
          [
            QueryStatus.ASSIGNED,
            QueryStatus.IN_PROGRESS,
            QueryStatus.REOPENED,
            QueryStatus.TRANSFERRED_TO_KYC,
            QueryStatus.TRANSFERRED_TO_PAYMENT
          ].includes(q.status as QueryStatus)
        ).length,
        completedCount: categoryItems.filter((q) => q.status === QueryStatus.RESOLVED).length
      };

      return res.json({
        success: true,
        category: resolvedCategory,
        count: queries.length,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.max(1, Math.ceil(total / limitNum)),
        summary,
        categoryCounts: QueryController.computeCategoryCountsFromList(allScopedTickets.map((t) => t.userType)),
        data: queries
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getQueryById(req: Request, res: Response): Promise<any> {
    try {
      const { id } = req.params;
      const currentUser = req.user!;

      const query = await QueryTicket.findOne(buildIdFilter('queryId', id));

      if (!query) {
        return res.status(404).json({ success: false, message: 'Support Query not found.' });
      }

      if (currentUser.role !== Role.OVERALL_LEAD) {
        const dept = currentUser.department as Department;
        const authorized =
          query.currentDepartment === dept ||
          query.sourceDepartment === dept ||
          query.sharedDepartments.includes(dept);
        if (!authorized) {
          return res.status(403).json({
            success: false,
            message: 'Access denied: Query does not belong to or share visibility with your department.'
          });
        }
      }

      // Filter department-private notes if user is not Overall Lead and not in the author's department
      const sanitizedInternalNotes = query.internalNotes.filter(note => {
        if (!note.isDepartmentPrivate) return true;
        if (currentUser.role === Role.OVERALL_LEAD) return true;
        return note.department === currentUser.department;
      });

      const responseData = query.toObject();
      responseData.internalNotes = sanitizedInternalNotes;

      return res.json({
        success: true,
        data: responseData
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Create a new query
   */
  static async createQuery(req: Request, res: Response): Promise<any> {
    try {
      const currentUser = req.user!;
      const {
        userType,
        userId,
        userName,
        userEmail,
        userPhone,
        category,
        subject,
        description,
        priority
      } = req.body;

      const queryId = generateId('QRY');

      const query = new QueryTicket({
        queryId,
        userType: userType || 'Customer',
        userId: userId || 'CUST-001',
        userName: userName || 'Customer',
        userEmail: userEmail || '',
        userPhone: userPhone || '',
        category: category || 'General Support',
        subject,
        description,
        priority: priority || 'Medium',
        status: QueryStatus.NEW,
        currentDepartment: Department.QUERIES,
        sourceDepartment: Department.QUERIES,
        sharedDepartments: [Department.QUERIES],
        conversation: [
          {
            messageId: generateId('MSG'),
            senderId: userId || 'CUST-001',
            senderName: userName || 'Customer',
            senderRole: userType || 'Customer',
            message: description,
            timestamp: new Date()
          }
        ],
        internalNotes: [],
        transferHistory: [],
        lastUpdated: new Date()
      });

      await query.save();

      await logAudit(
        req,
        'QUERY_CREATED',
        'QUERIES',
        queryId,
        `Support query ${queryId} created for ${userName}.`
      );

      return res.status(201).json({
        success: true,
        message: 'Query created successfully.',
        data: query
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Cross-Department Query Transfer with Confirmed Shared Visibility
   */
  static async transferQuery(req: Request, res: Response): Promise<any> {
    try {
      const currentUser = req.user!;
      const { id } = req.params;
      const { destinationDepartment, reason } = req.body;

      if (!destinationDepartment || !reason) {
        return res.status(400).json({
          success: false,
          message: 'destinationDepartment and reason are required.'
        });
      }

      const query = await QueryTicket.findOne(buildIdFilter('queryId', id));

      if (!query) {
        return res.status(404).json({ success: false, message: 'Query not found.' });
      }

      const fromDept = query.currentDepartment;
      query.currentDepartment = destinationDepartment as Department;

      // Ensure both source and destination departments are recorded in sharedDepartments
      if (!query.sharedDepartments.includes(fromDept)) {
        query.sharedDepartments.push(fromDept);
      }
      if (!query.sharedDepartments.includes(destinationDepartment as Department)) {
        query.sharedDepartments.push(destinationDepartment as Department);
      }

      // Update status
      if (destinationDepartment === Department.KYC) {
        query.status = QueryStatus.TRANSFERRED_TO_KYC;
      } else if (destinationDepartment === Department.PAYMENT) {
        query.status = QueryStatus.TRANSFERRED_TO_PAYMENT;
      } else {
        query.status = QueryStatus.IN_PROGRESS;
      }

      // Log transfer in case history
      query.transferHistory.push({
        fromDepartment: fromDept,
        toDepartment: destinationDepartment as Department,
        transferredByUserId: currentUser.employeeId,
        transferredByName: currentUser.name,
        reason,
        transferredAt: new Date()
      });

      query.lastUpdated = new Date();
      await query.save();

      // Notify destination department
      await NotificationItem.create({
        notificationId: generateId('NOTIF'),
        targetDepartment: destinationDepartment as Department,
        title: `Query Transferred: ${query.queryId}`,
        message: `Case transferred from ${fromDept} to ${destinationDepartment}. Reason: ${reason}`,
        type: 'QUERIES',
        actionUrl: `/queries/${query.queryId}`
      });

      await logAudit(
        req,
        'QUERY_TRANSFERRED_SHARED',
        'QUERIES',
        query.queryId,
        `Transferred case ${query.queryId} from ${fromDept} to ${destinationDepartment} with shared visibility.`
      );

      return res.json({
        success: true,
        message: `Query successfully transferred to ${destinationDepartment}. Shared visibility preserved.`,
        data: query
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Add message to ticket conversation
   */
  static async addMessage(req: Request, res: Response): Promise<any> {
    try {
      const currentUser = req.user!;
      const { id } = req.params;
      const { message, attachments } = req.body;

      if (!message || message.trim().length === 0) {
        return res.status(400).json({ success: false, message: 'Message content is required.' });
      }

      const query = await QueryTicket.findOne(buildIdFilter('queryId', id));

      if (!query) {
        return res.status(404).json({ success: false, message: 'Query not found.' });
      }

      query.conversation.push({
        messageId: generateId('MSG'),
        senderId: currentUser.employeeId,
        senderName: currentUser.name,
        senderRole: currentUser.role,
        message,
        attachments: attachments || [],
        timestamp: new Date()
      });

      query.lastUpdated = new Date();
      await query.save();

      return res.json({
        success: true,
        message: 'Message sent successfully.',
        data: query
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Add internal note with optional department privacy
   */
  static async addInternalNote(req: Request, res: Response): Promise<any> {
    try {
      const currentUser = req.user!;
      const { id } = req.params;
      const { note, isDepartmentPrivate } = req.body;

      if (!note || note.trim().length === 0) {
        return res.status(400).json({ success: false, message: 'Note text is required.' });
      }

      const query = await QueryTicket.findOne(buildIdFilter('queryId', id));

      if (!query) {
        return res.status(404).json({ success: false, message: 'Query not found.' });
      }

      query.internalNotes.push({
        noteId: generateId('NOTE'),
        authorId: currentUser.employeeId,
        authorName: currentUser.name,
        department: currentUser.department as Department,
        note,
        isDepartmentPrivate: Boolean(isDepartmentPrivate),
        timestamp: new Date()
      });

      query.lastUpdated = new Date();
      await query.save();

      return res.json({
        success: true,
        message: 'Internal note saved.',
        data: query
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Resolve query
   */
  static async resolveQuery(req: Request, res: Response): Promise<any> {
    try {
      const currentUser = req.user!;
      const { id } = req.params;
      const { resolutionNotes } = req.body;

      const query = await QueryTicket.findOne(buildIdFilter('queryId', id));

      if (!query) {
        return res.status(404).json({ success: false, message: 'Query not found.' });
      }

      query.status = QueryStatus.RESOLVED;
      query.resolution = {
        resolvedByUserId: currentUser.employeeId,
        resolvedByName: currentUser.name,
        resolvedAt: new Date(),
        resolutionNotes: resolutionNotes || 'Case marked as resolved.'
      };
      query.lastUpdated = new Date();

      await query.save();

      await logAudit(
        req,
        'QUERY_RESOLVED',
        'QUERIES',
        query.queryId,
        `Query ${query.queryId} resolved by ${currentUser.name}.`
      );

      return res.json({
        success: true,
        message: 'Query marked as Resolved.',
        data: query
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Assign or reassign a query to an employee
   */
  static async assignQuery(req: Request, res: Response): Promise<any> {
    try {
      const currentUser = req.user!;
      const { id } = req.params;
      const { employeeId } = req.body;

      if (!employeeId) {
        return res.status(400).json({ success: false, message: 'employeeId is required.' });
      }

      const [query, assignee] = await Promise.all([
        QueryTicket.findOne(buildIdFilter('queryId', id)),
        Employee.findOne(buildIdFilter('employeeId', employeeId)).select('-password')
      ]);

      if (!query) {
        return res.status(404).json({ success: false, message: 'Query not found.' });
      }
      if (!assignee) {
        return res.status(404).json({ success: false, message: 'Assignee employee not found.' });
      }

      query.assignedEmployeeId = assignee.employeeId;
      query.assignedEmployeeName = assignee.name;
      if (query.status === QueryStatus.NEW) {
        query.status = QueryStatus.ASSIGNED;
      }
      query.lastUpdated = new Date();
      await query.save();

      await NotificationItem.create({
        notificationId: generateId('NOTIF'),
        targetEmployeeId: assignee.employeeId,
        targetDepartment: assignee.department,
        title: `Query Assigned: ${query.queryId}`,
        message: `${currentUser.name} assigned "${query.subject}" to you.`,
        type: 'QUERIES',
        actionUrl: '/queries'
      });

      await logAudit(
        req,
        'QUERY_ASSIGNED',
        'QUERIES',
        query.queryId,
        `Query ${query.queryId} assigned to ${assignee.name} by ${currentUser.name}.`
      );

      return res.json({
        success: true,
        message: `Query assigned to ${assignee.name}.`,
        data: query
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Escalate query priority to Urgent & notify Overall Lead + Department Lead
   */
  static async escalateQuery(req: Request, res: Response): Promise<any> {
    try {
      const currentUser = req.user!;
      const { id } = req.params;
      const { reason } = req.body;

      const query = await QueryTicket.findOne(buildIdFilter('queryId', id));
      if (!query) {
        return res.status(404).json({ success: false, message: 'Query not found.' });
      }

      query.priority = 'Urgent';
      query.status = QueryStatus.OVERDUE;
      query.internalNotes.push({
        noteId: generateId('NOTE'),
        authorId: currentUser.employeeId,
        authorName: currentUser.name,
        department: currentUser.department as Department,
        note: `ESCALATED TO TEAM LEAD / OVERALL LEAD: ${reason || 'Requires urgent intervention'}`,
        isDepartmentPrivate: false,
        timestamp: new Date()
      });
      query.lastUpdated = new Date();
      await query.save();

      await NotificationItem.create({
        notificationId: generateId('NOTIF'),
        targetRole: Role.OVERALL_LEAD,
        targetDepartment: query.currentDepartment,
        title: `Escalated Query: ${query.queryId}`,
        message: `${currentUser.name} escalated "${query.subject}". Reason: ${reason || 'Urgent priority'}`,
        type: 'QUERIES',
        actionUrl: '/queries'
      });

      await logAudit(
        req,
        'QUERY_ESCALATED',
        'QUERIES',
        query.queryId,
        `Query ${query.queryId} escalated by ${currentUser.name}. Reason: ${reason || 'N/A'}`
      );

      return res.json({
        success: true,
        message: 'Query escalated to Urgent and Team Lead notified.',
        data: query
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Reopen a resolved query
   */
  static async reopenQuery(req: Request, res: Response): Promise<any> {
    try {
      const currentUser = req.user!;
      const { id } = req.params;
      const { reason } = req.body;

      const query = await QueryTicket.findOne(buildIdFilter('queryId', id));
      if (!query) {
        return res.status(404).json({ success: false, message: 'Query not found.' });
      }

      query.status = QueryStatus.REOPENED;
      query.internalNotes.push({
        noteId: generateId('NOTE'),
        authorId: currentUser.employeeId,
        authorName: currentUser.name,
        department: currentUser.department as Department,
        note: `CASE REOPENED: ${reason || 'Follow-up required'}`,
        isDepartmentPrivate: false,
        timestamp: new Date()
      });
      query.lastUpdated = new Date();
      await query.save();

      await logAudit(
        req,
        'QUERY_REOPENED',
        'QUERIES',
        query.queryId,
        `Query ${query.queryId} reopened by ${currentUser.name}.`
      );

      return res.json({
        success: true,
        message: 'Query reopened successfully.',
        data: query
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Compute all 10 Queries Team Dashboard KPIs from persisted QueryTicket documents
   */
  static async getQueryKpis(req: Request, res: Response): Promise<any> {
    try {
      const { sourceCategory, userType } = req.query;
      const scopeClause = QueryController.buildScopeClause(req.user!);
      const rawCat = (sourceCategory as string) || (userType as string);
      const andClauses: any[] = [];
      if (Object.keys(scopeClause).length > 0) andClauses.push(scopeClause);
      if (rawCat && rawCat !== 'ALL' && rawCat !== 'All') {
        const resolved = resolveQueryCategory(rawCat);
        if (!resolved) {
          return res.status(400).json({ success: false, message: `Unsupported Query user category filter: "${rawCat}".` });
        }
        if (resolved.userTypes && resolved.userTypes.length > 0) {
          andClauses.push({ userType: { $in: resolved.userTypes } });
        }
      }
      const scope = andClauses.length > 0 ? { $and: andClauses } : {};

      const tickets = await QueryTicket.find(scope).lean();
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const slaCutoff = Date.now() - 12 * 60 * 60 * 1000;

      const resolvedTickets = tickets.filter((t) => t.status === QueryStatus.RESOLVED);
      const resolvedWithTimes = resolvedTickets.filter((t) => t.resolution?.resolvedAt && t.createdAt);
      const avgResolutionHours =
        resolvedWithTimes.length > 0
          ? Math.round(
              (resolvedWithTimes.reduce(
                (sum, t) => sum + Math.max(0, new Date(t.resolution!.resolvedAt).getTime() - new Date(t.createdAt).getTime()),
                0
              ) /
                resolvedWithTimes.length /
                (1000 * 60 * 60)) *
                10
            ) / 10
          : 0;

      const overdueQueries = tickets.filter(
        (t) =>
          t.status === QueryStatus.OVERDUE ||
          (t.status !== QueryStatus.RESOLVED && new Date(t.createdAt).getTime() < slaCutoff)
      ).length;

      return res.json({
        success: true,
        data: {
          totalQueries: tickets.length,
          newQueries: tickets.filter((t) => t.status === QueryStatus.NEW).length,
          inProgressQueries: tickets.filter((t) => [QueryStatus.ASSIGNED, QueryStatus.IN_PROGRESS, QueryStatus.WAITING_FOR_RESPONSE, QueryStatus.REOPENED].includes(t.status as QueryStatus)).length,
          transferredToKyc: tickets.filter((t) => t.status === QueryStatus.TRANSFERRED_TO_KYC).length,
          transferredToPayment: tickets.filter((t) => t.status === QueryStatus.TRANSFERRED_TO_PAYMENT).length,
          resolvedToday: resolvedTickets.filter((t) => t.resolution?.resolvedAt && new Date(t.resolution.resolvedAt) >= startOfToday).length,
          totalResolved: resolvedTickets.length,
          overdueQueries,
          avgResolutionHours,
          escalatedQueries: tickets.filter((t) => t.priority === 'Urgent').length
        }
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}

