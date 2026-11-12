import { Router } from 'express';
import { QueryController } from '../controllers/queryController';
import { authenticateJwt } from '../middleware/authMiddleware';
import { requireRoles } from '../middleware/rbacMiddleware';
import { validateBody } from '../middleware/validationMiddleware';
import { createQuerySchema } from '../validators/schemas';
import { Role } from '../config/constants';

const router = Router();

router.use(authenticateJwt);

router.get('/categories/counts', QueryController.getCategoryCounts);
router.get('/kpis', QueryController.getQueryKpis);
router.get('/', QueryController.listQueries);
router.get('/:id', QueryController.getQueryById);
router.post('/', validateBody(createQuerySchema), QueryController.createQuery);

// Assign or reassign query
router.post(
  '/:id/assign',
  requireRoles([
    Role.OVERALL_LEAD,
    Role.QUERIES_LEAD,
    Role.KYC_LEAD,
    Role.PAYMENT_LEAD
  ]),
  QueryController.assignQuery
);

// Escalate query to Urgent
router.post('/:id/escalate', QueryController.escalateQuery);

// Reopen resolved query
router.post('/:id/reopen', QueryController.reopenQuery);

// Cross-Department Case Transfer with Shared Case History
router.post(
  '/:id/transfer',
  requireRoles([
    Role.OVERALL_LEAD,
    Role.QUERIES_LEAD,
    Role.QUERIES_EMPLOYEE,
    Role.KYC_LEAD,
    Role.PAYMENT_LEAD
  ]),
  QueryController.transferQuery
);

// Add conversation message
router.post('/:id/messages', QueryController.addMessage);

// Add internal department note
router.post('/:id/internal-notes', QueryController.addInternalNote);

// Resolve query
router.post(
  '/:id/resolve',
  requireRoles([
    Role.OVERALL_LEAD,
    Role.QUERIES_LEAD,
    Role.QUERIES_EMPLOYEE,
    Role.KYC_LEAD,
    Role.PAYMENT_LEAD
  ]),
  QueryController.resolveQuery
);

export default router;

