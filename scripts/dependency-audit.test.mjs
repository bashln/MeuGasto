import assert from 'node:assert/strict';
import test from 'node:test';
import { classifyAudit, validateAuditReport } from './dependency-audit.mjs';

const imageSize = {
  severity: 'high',
  via: [{ source: 1138808 }, { source: 1138809 }],
};

test('rejects npm audit error payloads', () => {
  assert.throws(
    () => validateAuditReport({ error: { summary: 'registry unavailable' } }),
    /registry unavailable/
  );
  assert.throws(() => validateAuditReport({}), /missing vulnerability report/);
});

test('allows only the documented image-size advisories before review date', () => {
  const result = classifyAudit({ 'image-size': imageSize }, '2026-08-10');

  assert.deepEqual(result.blockers, []);
  assert.equal(result.allowed[0].name, 'image-size');
});

test('allows high packages affected only through the documented image-size chain', () => {
  const result = classifyAudit(
    {
      'image-size': imageSize,
      metro: { severity: 'high', via: ['image-size'] },
      expo: { severity: 'high', via: ['metro'] },
    },
    '2026-08-10'
  );

  assert.deepEqual(result.blockers, []);
  assert.equal(result.allowed.length, 1);
});

test('blocks a high dependency cycle without an allowed advisory root', () => {
  const result = classifyAudit(
    {
      first: { severity: 'high', via: ['second'] },
      second: { severity: 'high', via: ['first'] },
    },
    '2026-08-10'
  );

  assert.equal(result.allowed.length, 0);
  assert.equal(result.blockers.length, 2);
});

test('blocks an unknown high vulnerability', () => {
  const result = classifyAudit(
    { 'unknown-package': { severity: 'high', via: [{ source: 999, title: 'Unknown advisory' }] } },
    '2026-08-10'
  );

  assert.equal(result.allowed.length, 0);
  assert.equal(result.blockers[0].name, 'unknown-package');
});

test('blocks image-size when the advisory set changes', () => {
  const result = classifyAudit(
    { 'image-size': { severity: 'high', via: [{ source: 1138808 }, { source: 999 }] } },
    '2026-08-10'
  );

  assert.equal(result.allowed.length, 0);
  assert.equal(result.blockers[0].name, 'image-size');
});

test('blocks the exception after its review date', () => {
  const result = classifyAudit({ 'image-size': imageSize }, '2026-10-02');

  assert.equal(result.allowed.length, 0);
  assert.equal(result.blockers[0].name, 'image-size');
});

test('always blocks critical vulnerabilities', () => {
  const result = classifyAudit(
    { 'image-size': { ...imageSize, severity: 'critical' } },
    '2026-08-10'
  );

  assert.equal(result.allowed.length, 0);
  assert.equal(result.blockers[0].severity, 'critical');
});
