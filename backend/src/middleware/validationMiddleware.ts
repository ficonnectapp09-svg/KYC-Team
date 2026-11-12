import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

/**
 * Validates req.body against a Zod schema and attaches normalized data back to req.body.
 */
export const validateBody = <T>(schema: ZodSchema<T>) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formatted = error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message
        }));
        res.status(400).json({
          success: false,
          message: `Validation error: ${formatted.map((f) => `${f.field}: ${f.message}`).join('; ')}`,
          errors: formatted
        });
        return;
      }
      next(error);
    }
  };
};
