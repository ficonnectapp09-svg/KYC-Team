import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

export const buildIdFilter = (fieldName: string, id: string) => {
  if (mongoose.Types.ObjectId.isValid(id)) {
    return { $or: [{ [fieldName]: id }, { _id: id }] };
  }
  return { [fieldName]: id };
};

const JWT_SECRET = process.env.JWT_SECRET || 'connect_app_backoffice_jwt_secret_key_2026_enterprise';
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'connect_app_backoffice_refresh_secret_key_2026_enterprise';

export const hashPassword = async (password: string): Promise<string> => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

export const comparePassword = async (candidate: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(candidate, hash);
};

export const generateAccessToken = (payload: object): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
};

export const generateRefreshToken = (payload: object): string => {
  return jwt.sign(payload, REFRESH_TOKEN_SECRET, { expiresIn: '30d' });
};

export const verifyAccessToken = (token: string): any => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

export const verifyRefreshToken = (token: string): any => {
  try {
    return jwt.verify(token, REFRESH_TOKEN_SECRET);
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

