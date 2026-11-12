import { Router } from 'express';
import multer from 'multer';
import { UploadController } from '../controllers/uploadController';
import { authenticateJwt } from '../middleware/authMiddleware';
import { requireRoles } from '../middleware/rbacMiddleware';
import { Role } from '../config/constants';

const ALLOWED_MIME_TYPES = new Set([
  // Images
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  // Videos
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
  'text/plain'
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50 MB max for video / KYC document uploads
  },
  fileFilter: (_req, file, callback) => {
    if (
      ALLOWED_MIME_TYPES.has(file.mimetype) ||
      file.mimetype.startsWith('image/') ||
      file.mimetype.startsWith('video/')
    ) {
      callback(null, true);
      return;
    }
    const err: any = new Error(
      `Unsupported file type "${file.mimetype}". Allowed types: images, videos, PDF, Word, Excel, CSV, TXT.`
    );
    err.statusCode = 400;
    callback(err);
  }
});

const router = Router();

router.use(authenticateJwt);

router.get('/status', UploadController.getStorageStatus);
router.post('/', upload.single('file'), UploadController.uploadSingle);
router.post('/multiple', upload.array('files', 5), UploadController.uploadMultiple);
router.delete(
  '/:publicId',
  requireRoles([Role.OVERALL_LEAD, Role.KYC_LEAD, Role.PAYMENT_LEAD, Role.QUERIES_LEAD]),
  UploadController.deleteAsset
);

export default router;

