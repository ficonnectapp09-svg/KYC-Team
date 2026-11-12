import { Request, Response, NextFunction } from 'express';

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error('[Error Handler]:', err);

  const isMulterError = err?.name === 'MulterError';
  const statusCode = isMulterError ? 400 : err.statusCode || 500;
  const message =
    err?.code === 'LIMIT_FILE_SIZE'
      ? 'Uploaded file exceeds the 50 MB size limit.'
      : err.message || 'Internal Server Error';

  res.status(statusCode).json({
    success: false,
    message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
};

