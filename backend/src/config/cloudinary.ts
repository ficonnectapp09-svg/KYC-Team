import path from 'path';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

export interface CloudinaryUploadResult {
  url: string;
  secureUrl: string;
  publicId: string;
  resourceType: string;
  format: string;
  bytes: number;
  width?: number;
  height?: number;
  duration?: number;
  originalFilename: string;
  folder: string;
}

const DEFAULT_BASE_FOLDER = 'connect-backoffice';

let isConfigured = false;

const parseCloudinaryUrl = (rawUrl?: string) => {
  if (!rawUrl || !rawUrl.startsWith('cloudinary://')) return null;
  try {
    const parsed = new URL(rawUrl);
    return {
      cloudName: parsed.hostname,
      apiKey: decodeURIComponent(parsed.username),
      apiSecret: decodeURIComponent(parsed.password)
    };
  } catch {
    return null;
  }
};

export const getCloudinaryCredentials = () => {
  const fromUrl = parseCloudinaryUrl(process.env.CLOUDINARY_URL);
  const cloudName = (process.env.CLOUDINARY_CLOUD_NAME || fromUrl?.cloudName || '').trim();
  const apiKey = (process.env.CLOUDINARY_API_KEY || fromUrl?.apiKey || '').trim();
  const apiSecret = (process.env.CLOUDINARY_API_SECRET || fromUrl?.apiSecret || '').trim();
  const baseFolder = (process.env.CLOUDINARY_UPLOAD_FOLDER || DEFAULT_BASE_FOLDER).trim();

  return { cloudName, apiKey, apiSecret, baseFolder };
};

export const configureCloudinary = (): boolean => {
  const { cloudName, apiKey, apiSecret } = getCloudinaryCredentials();

  if (!cloudName || !apiKey || !apiSecret) {
    isConfigured = false;
    console.warn('[Storage]: Cloudinary credentials are incomplete. Media uploads will be unavailable.');
    return false;
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true
  });

  isConfigured = true;
  console.log(`[Storage]: Cloudinary configured successfully (cloud: ${cloudName})`);
  return true;
};

export const isCloudinaryConfigured = (): boolean => {
  if (!isConfigured) {
    return configureCloudinary();
  }
  return isConfigured;
};

const sanitizeSegment = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9/_-]+/g, '-')
    .replace(/^\/+|\/+$/g, '');

const buildTargetFolder = (category?: string): string => {
  const { baseFolder } = getCloudinaryCredentials();
  const safeBase = sanitizeSegment(baseFolder) || DEFAULT_BASE_FOLDER;
  const safeCategory = category ? sanitizeSegment(category) : 'general';
  return safeCategory ? `${safeBase}/${safeCategory}` : safeBase;
};

const buildPublicIdPrefix = (originalName?: string): string => {
  const ext = originalName ? path.extname(originalName) : '';
  const base = originalName
    ? path.basename(originalName, ext).replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 48)
    : 'file';
  return `${base || 'file'}_${Date.now()}`;
};

const mapUploadResponse = (
  result: UploadApiResponse,
  originalFilename: string,
  folder: string
): CloudinaryUploadResult => ({
  url: result.secure_url || result.url,
  secureUrl: result.secure_url || result.url,
  publicId: result.public_id,
  resourceType: result.resource_type,
  format: result.format || path.extname(originalFilename).replace('.', ''),
  bytes: result.bytes,
  width: result.width,
  height: result.height,
  duration: typeof result.duration === 'number' ? result.duration : undefined,
  originalFilename: originalFilename || result.original_filename || result.public_id,
  folder
});

/**
 * Upload an in-memory file buffer (image, video, PDF, or office document) to Cloudinary.
 */
export const uploadBufferToCloudinary = async (
  buffer: Buffer,
  options: {
    originalFilename?: string;
    category?: string;
    resourceType?: 'auto' | 'image' | 'video' | 'raw';
  } = {}
): Promise<CloudinaryUploadResult> => {
  if (!isCloudinaryConfigured()) {
    throw new Error('Cloudinary storage is not configured on the server.');
  }

  const folder = buildTargetFolder(options.category);
  const originalFilename = options.originalFilename || `upload_${Date.now()}`;

  return new Promise<CloudinaryUploadResult>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: buildPublicIdPrefix(originalFilename),
        resource_type: options.resourceType || 'auto',
        use_filename: true,
        unique_filename: true
      },
      (error, result) => {
        if (error || !result) {
          reject(new Error(error?.message || 'Cloudinary upload failed.'));
          return;
        }
        resolve(mapUploadResponse(result, originalFilename, folder));
      }
    );

    stream.end(buffer);
  });
};

/**
 * Upload a base64 data URI or remote media URL to Cloudinary.
 */
export const uploadDataUriToCloudinary = async (
  fileData: string,
  options: {
    originalFilename?: string;
    category?: string;
    resourceType?: 'auto' | 'image' | 'video' | 'raw';
  } = {}
): Promise<CloudinaryUploadResult> => {
  if (!isCloudinaryConfigured()) {
    throw new Error('Cloudinary storage is not configured on the server.');
  }

  const folder = buildTargetFolder(options.category);
  const originalFilename = options.originalFilename || `upload_${Date.now()}`;

  const result = await cloudinary.uploader.upload(fileData, {
    folder,
    public_id: buildPublicIdPrefix(originalFilename),
    resource_type: options.resourceType || 'auto',
    use_filename: true,
    unique_filename: true
  });

  return mapUploadResponse(result, originalFilename, folder);
};

export const deleteFromCloudinary = async (
  publicId: string,
  resourceType: 'image' | 'video' | 'raw' = 'image'
): Promise<{ result: string }> => {
  if (!isCloudinaryConfigured()) {
    throw new Error('Cloudinary storage is not configured on the server.');
  }
  const response = await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
  return { result: response?.result || 'unknown' };
};

export const verifyCloudinaryConnection = async (): Promise<{
  configured: boolean;
  reachable: boolean;
  cloudName: string;
  baseFolder: string;
  error?: string;
}> => {
  const { cloudName, baseFolder } = getCloudinaryCredentials();
  if (!isCloudinaryConfigured()) {
    return {
      configured: false,
      reachable: false,
      cloudName,
      baseFolder,
      error: 'Cloudinary credentials missing.'
    };
  }

  try {
    const ping = await cloudinary.api.ping();
    return {
      configured: true,
      reachable: ping?.status === 'ok',
      cloudName,
      baseFolder
    };
  } catch (err: any) {
    return {
      configured: true,
      reachable: false,
      cloudName,
      baseFolder,
      error: err?.message || 'Cloudinary ping failed.'
    };
  }
};

export { cloudinary };

