import { Router } from 'express';
import { SettingsController } from '../controllers/settingsController';
import { authenticateJwt } from '../middleware/authMiddleware';
import { requireOverallLead } from '../middleware/rbacMiddleware';

const router = Router();

router.use(authenticateJwt);

router.get('/', SettingsController.getSettings);
router.put('/', requireOverallLead, SettingsController.updateSettings);

export default router;

