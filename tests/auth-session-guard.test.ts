import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { signJwtToken, getUserFromRequest } from '../src/lib/auth';
import { extractTokenFromRequest, hasMinRole } from '../src/lib/tenant-guard';

describe('Auth, Session & Tenant Guard Integrity Suite', () => {
  const dummyPayload = { userId: 'user-12345', email: 'test@klir.id', workspaceId: 'ws-abc-123' };
  const token = signJwtToken(dummyPayload);

  it('extractTokenFromRequest mengambil token dari header Authorization Bearer', () => {
    const req = new NextRequest('http://localhost:3000/api/v1/brain/chat', {
      headers: { authorization: `Bearer ${token}` },
    });
    const extracted = extractTokenFromRequest(req);
    assert.strictEqual(extracted, token);
  });

  it('extractTokenFromRequest mengambil token dari cookie klir_token jika header tidak ada', () => {
    const req = new NextRequest('http://localhost:3000/api/v1/brain/chat', {
      headers: { cookie: `klir_token=${token}` },
    });
    const extracted = extractTokenFromRequest(req);
    assert.strictEqual(extracted, token);
  });

  it('getUserFromRequest membaca payload dari session cookie klir_token', () => {
    const req = new NextRequest('http://localhost:3000/api/v1/credits/topup', {
      headers: { cookie: `klir_token=${token}` },
    });
    const user = getUserFromRequest(req);
    assert.ok(user);
    assert.strictEqual(user.userId, 'user-12345');
    assert.strictEqual(user.email, 'test@klir.id');
  });

  it('hasMinRole memvalidasi hierarki peran secara benar', () => {
    assert.strictEqual(hasMinRole('OWNER', 'MANAGER'), true);
    assert.strictEqual(hasMinRole('MANAGER', 'OWNER'), false);
    assert.strictEqual(hasMinRole('MEMBER', 'VIEWER'), true);
    assert.strictEqual(hasMinRole('VIEWER', 'MEMBER'), false);
  });
});
