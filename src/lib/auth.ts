import argon2 from 'argon2';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { NextRequest } from 'next/server';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production') {
    if (!secret || secret === 'klir-super-secret-jwt-key-2026' || secret.includes('change_in_production')) {
      throw new Error('FATAL SECURITY ERROR: JWT_SECRET must be set to a high-entropy secret in production!');
    }
  }
  return secret || 'klir-dev-secure-jwt-key-edfd6f65-139a-4566-a373';
}

const JWT_SECRET = getJwtSecret();

export async function hashPassword(password: string): Promise<string> {
    return argon2.hash(password);
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
    try {
          return await argon2.verify(hash, password);
    } catch (err) {
          return false;
    }
}

export function signJwtToken(payload: object, expiresIn: SignOptions['expiresIn'] = '7d'): string {
    return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

export function verifyJwtToken(token: string): any {
    try {
          return jwt.verify(token, JWT_SECRET);
    } catch (err) {
          return null;
    }
}

export function getUserFromRequest(req: NextRequest): any {
    const authHeader = req.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        return verifyJwtToken(token);
    }
    const cookieToken = req.cookies.get('klir_token')?.value || req.cookies.get('auth_token')?.value;
    if (cookieToken) {
        return verifyJwtToken(cookieToken);
    }
    return null;
}

