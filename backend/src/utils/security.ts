import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

export const buildIdFilter = (fieldName: string, id: string) => {
  if (mongoose.Types.ObjectId.isValid(id)) {
    return { $or: [{ [fieldName]: id }, { _id: id }] };
  }
  return { [fieldName]: id };
};

const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required.');
  }
  return secret;
};

const getRefreshTokenSecret = (): string => {
  const secret = process.env.REFRESH_TOKEN_SECRET?.trim();
  if (!secret) {
    throw new Error('REFRESH_TOKEN_SECRET environment variable is required.');
  }
  return secret;
};

export const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

export const comparePassword = async (candidate: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(candidate, hash);
};

export const generateAccessToken = (payload: object): string => {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '7d' });
};

export const generateRefreshToken = (payload: object): string => {
  return jwt.sign(payload, getRefreshTokenSecret(), { expiresIn: '30d' });
};

export const verifyAccessToken = (token: string): any => {
  try {
    return jwt.verify(token, getJwtSecret());
  } catch (error) {
    return null;
  }
};

export const verifyRefreshToken = (token: string): any => {
  try {
    return jwt.verify(token, getRefreshTokenSecret());
  } catch (error) {
    return null;
  }
};

export const maskBankAccount = (accountNumber?: string): string => {
  if (!accountNumber) return '••••••••0000';
  const clean = String(accountNumber).replace(/\s+/g, '');
  if (clean.length <= 4) return '••••' + clean;
  const last4 = clean.slice(-4);
  return '•'.repeat(Math.max(4, clean.length - 4)) + last4;
};

export const maskAadhaar = (aadhaar?: string): string => {
  if (!aadhaar) return '•••• •••• 0000';
  const clean = String(aadhaar).replace(/[\s-]/g, '');
  if (clean.length <= 4) return '•••• •••• ' + clean;
  return '•••• •••• ' + clean.slice(-4);
};

export const maskPan = (pan?: string): string => {
  if (!pan) return '•••••0000•';
  const clean = String(pan).trim();
  if (clean.length < 5) return '•••••';
  return clean.slice(0, 2) + '•••' + clean.slice(-2);
};

export const generateId = (prefix: string): string => {
  const randomNum = Math.floor(100000 + Math.random() * 900000);
  return `${prefix}-${new Date().getFullYear()}-${randomNum}`;
};

