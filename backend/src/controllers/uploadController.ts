import { Request, Response } from 'express';
import {
  deleteFromCloudinary,
  uploadBufferToCloudinary,
  uploadDataUriToCloudinary,
  verifyCloudinaryConnection
} from '../config/cloudinary';
import { logAudit } from '../middleware/auditLogger';

const ALLOWED_CATEGORIES = new Set(['kyc', 'queries', 'staff', 'payments', 'reports', 'general']);

const resolveCategory = (raw?: unknown): string => {
  const normalized = typeof raw === 'string' ? raw.trim().toLowerCase() : 'general';
  return ALLOWED_CATEGORIES.has(normalized) ? normalized : 'general';
};

const mapAuditModule = (
  category: string
): 'KYC' | 'PAYMENT' | 'QUERIES' | 'STAFF' | 'SETTINGS' => {
  switch (category) {
    case 'kyc':
      return 'KYC';
    case 'payments':
      return 'PAYMENT';
    case 'queries':
      return 'QUERIES';
    case 'staff':
      return 'STAFF';
    default:
      return 'SETTINGS';
  }
};

export class UploadController {
  /**
   * Check Cloudinary configuration and connectivity status
   */
  static async getStorageStatus(_req: Request, res: Response): Promise<any> {
    try {
      const status = await verifyCloudinaryConnection();
      return res.json({
        success: status.configured && status.reachable,
        data: status
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  /**
   * Upload a single image, video, or document to Cloudinary.
   * Supports multipart/form-data (`file`) as well as JSON `{ fileData, fileName, category }`.
   */
  static async uploadSingle(req: Request, res: Response): Promise<any> {
    try {
      const category = resolveCategory(req.body?.category || req.query?.category || req.body?.folder);
      let uploaded;

      if (req.file) {
        uploaded = await uploadBufferToCloudinary(req.file.buffer, {
          originalFilename: req.file.originalname,
          category
        });
      } else if (typeof req.body?.fileData === 'string' && req.body.fileData.trim().length > 0) {
        uploaded = await uploadDataUriToCloudinary(req.body.fileData.trim(), {
          originalFilename: typeof req.body.fileName === 'string' ? req.body.fileName : undefined,
          category
        });
      } else {
        return res.status(400).json({
          success: false,
          message: 'No file or fileData provided. Attach an image, video, or document to upload.'
        });
      }

      await logAudit(
        req,
        'MEDIA_UPLOADED',
        mapAuditModule(category),
        uploaded.publicId,
        `Uploaded ${uploaded.resourceType} "${uploaded.originalFilename}" (${uploaded.bytes} bytes) to Cloudinary folder "${uploaded.folder}".`
      );

      return res.status(201).json({
        success: true,
        message: 'File uploaded to Cloudinary successfully.',
        data: uploaded
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to upload file to Cloudinary.'
      });
    }
  }

  /**
   * Upload up to 5 images, videos, or documents in a single multipart request (`files`).
   */
  static async uploadMultiple(req: Request, res: Response): Promise<any> {
    try {
      const files = (req.files as Express.Multer.File[]) || [];
      if (files.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No files provided for upload.'
        });
      }

      const category = resolveCategory(req.body?.category || req.query?.category || req.body?.folder);
      const uploadedItems = await Promise.all(
        files.map((file) =>
          uploadBufferToCloudinary(file.buffer, {
            originalFilename: file.originalname,
            category
          })
        )
      );

      await logAudit(
        req,
        'MEDIA_BATCH_UPLOADED',
        mapAuditModule(category),
        category,
        `Uploaded ${uploadedItems.length} file(s) to Cloudinary folder "${category}".`
      );

      return res.status(201).json({
        success: true,
        message: `${uploadedItems.length} file(s) uploaded to Cloudinary successfully.`,
        data: uploadedItems
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        message: error.message || 'Failed to upload files to Cloudinary.'
      });
    }
  }

  /**
   * Remove an uploaded asset by publicId
   */
  static async deleteAsset(req: Request, res: Response): Promise<any> {
    try {
      const publicId = decodeURIComponent(req.params.publicId || '').trim();
      const rawType = String(req.query.resourceType || 'image');
      const resourceType: 'image' | 'video' | 'raw' =
        rawType === 'video' || rawType === 'raw' ? rawType : 'image';

      if (!publicId) {
        return res.status(400).json({ success: false, message: 'publicId is required.' });
      }

      const result = await deleteFromCloudinary(publicId, resourceType);

      await logAudit(
        req,
        'MEDIA_DELETED',
        'SETTINGS',
        publicId,
        `Removed Cloudinary asset "${publicId}" (${resourceType}): ${result.result}.`
      );

      return res.json({
        success: true,
        message: 'Cloudinary asset deletion processed.',
        data: result
      });
    } catch (error: any) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}
