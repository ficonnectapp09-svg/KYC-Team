import { Router } from 'express';
import { AttendanceController } from '../controllers/attendanceController';
import { authenticateJwt } from '../middleware/authMiddleware';
import { requireRoles } from '../middleware/rbacMiddleware';
import { Role } from '../config/constants';

const router = Router();

router.use(authenticateJwt);

router.get('/summary', AttendanceController.getAttendanceSummary);
router.get('/today-status', AttendanceController.getTodayStatus);
router.post('/check-in', AttendanceController.checkIn);
router.post('/check-out', AttendanceController.checkOut);
router.get('/', AttendanceController.listAttendance);
router.post('/mark', AttendanceController.markAttendance);

router.post(
  '/:id/review-leave',
  requireRoles([Role.OVERALL_LEAD, Role.KYC_LEAD, Role.PAYMENT_LEAD, Role.QUERIES_LEAD]),
  AttendanceController.reviewLeave
);

export default router;

