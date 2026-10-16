import assert from 'node:assert/strict';
import test from 'node:test';
import { isLocalDemoRequest, isLoopbackHost } from '../src/lib/local-demo-guard';

test('loopback host dikenali termasuk port dan IPv6', () => {
  assert.equal(isLoopbackHost('localhost:3000'), true);
  assert.equal(isLoopbackHost('127.0.0.1:3000'), true);
  assert.equal(isLoopbackHost('[::1]:3000'), true);
  assert.equal(isLoopbackHost('app.example.com:3000'), false);
  assert.equal(isLoopbackHost('evil-localhost.example.com'), false);
});

test('demo hanya aktif di loopback non-production', () => {
  assert.equal(isLocalDemoRequest('localhost:3000', 'development'), true);
  assert.equal(isLocalDemoRequest('localhost:3000', 'test'), true);
  assert.equal(isLocalDemoRequest('localhost:3000', 'production'), false);
  assert.equal(isLocalDemoRequest('app.example.com', 'development'), false);
});
