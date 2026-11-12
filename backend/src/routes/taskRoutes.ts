import { Router } from 'express';
import { TaskController } from '../controllers/taskController';
import { authenticateJwt } from '../middleware/authMiddleware';
import { requireRoles } from '../middleware/rbacMiddleware';
import { Role } from '../config/constants';

const router = Router();

router.use(authenticateJwt);

router.get('/', TaskController.listTasks);
router.post(
  '/',
  requireRoles([Role.OVERALL_LEAD, Role.KYC_LEAD, Role.PAYMENT_LEAD, Role.QUERIES_LEAD]),
  TaskController.createTask
);
router.patch('/:id/status', TaskController.updateTaskStatus);

export default router;

