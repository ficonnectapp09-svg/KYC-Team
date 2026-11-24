import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { authenticateJwt } from '../middleware/authMiddleware';
import { validateBody } from '../middleware/validationMiddleware';
import { loginSchema } from '../validators/schemas';

const router = Router();

router.post('/login', validateBody(loginSchema), AuthController.login);
router.post('/refresh', AuthController.refreshToken);
router.get('/me', authenticateJwt, AuthController.getMe);
router.post('/change-password', authenticateJwt, AuthController.changePassword);

export default router;

