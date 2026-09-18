#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const IMAGE_SIZE_ADVISORIES = new Set([1138808, 1138809]);
const IMAGE_SIZE_REVIEW_AFTER = '2026-10-01';
const mobileDirectory = fileURLToPath(new URL('../mobile/', import.meta.url));

const advisorySources = (vulnerability) =>
  new Set(
    (vulnerability.via ?? [])
      .filter((advisory) => typeof advisory === 'object' && advisory !== null)
      .map((advisory) => advisory.source)
      .filter(Number.isInteger)
  );

const isAllowedImageSizeRisk = (name, vulnerability, today) => {
  if (name !== 'image-size' || vulnerability.severity !== 'high' || today > IMAGE_SIZE_REVIEW_AFTER) {
    return false;
  }

  const sources = advisorySources(vulnerability);
  return (
    sources.size === IMAGE_SIZE_ADVISORIES.size &&
    [...IMAGE_SIZE_ADVISORIES].every((source) => sources.has(source))
  );
};

const evaluateHighRisk = (name, vulnerabilities, today, visiting = new Set()) => {
  const vulnerability = vulnerabilities[name];
  if (!vulnerability || vulnerability.severity !== 'high') {
    return { valid: false, reachesAllowedRoot: false };
  }
  if (isAllowedImageSizeRisk(name, vulnerability, today)) {
    return { valid: true, reachesAllowedRoot: true };
  }
  if (visiting.has(name)) {
    return { valid: true, reachesAllowedRoot: false };
  }

  const causes = vulnerability.via ?? [];
  if (causes.length === 0) return { valid: false, reachesAllowedRoot: false };

  const nextVisiting = new Set(visiting).add(name);
  const results = causes.map((cause) =>
    typeof cause === 'string'
      ? evaluateHighRisk(cause, vulnerabilities, today, nextVisiting)
      : { valid: false, reachesAllowedRoot: false }
  );

  return {
    valid: results.every((result) => result.valid),
    reachesAllowedRoot: results.some((result) => result.reachesAllowedRoot),
  };
};

const isAllowedHighRisk = (name, vulnerabilities, today) => {
  const result = evaluateHighRisk(name, vulnerabilities, today);
  return result.valid && result.reachesAllowedRoot;
};

export const validateAuditReport = (audit) => {
  if (!audit || typeof audit !== 'object' || audit.error || !audit.vulnerabilities) {
    throw new Error(`npm audit failed: ${audit?.error?.summary ?? 'missing vulnerability report'}`);
  }
  if (typeof audit.vulnerabilities !== 'object' || Array.isArray(audit.vulnerabilities)) {
    throw new Error('npm audit failed: invalid vulnerability report');
  }
};

export const classifyAudit = (vulnerabilities, today = new Date().toISOString().slice(0, 10)) => {
  const allowed = [];
  const blockers = [];

  for (const [name, vulnerability] of Object.entries(vulnerabilities ?? {})) {
    if (!['high', 'critical'].includes(vulnerability.severity)) continue;

    if (isAllowedHighRisk(name, vulnerabilities, today)) {
      if (name === 'image-size') {
        allowed.push({
          name,
          reviewAfter: IMAGE_SIZE_REVIEW_AFTER,
          reason: 'Transitively required by Expo Metro; no fixed image-size release is available.',
        });
      }
      continue;
    }

    blockers.push({
      name,
      severity: vulnerability.severity,
      via: (vulnerability.via ?? []).map((advisory) =>
        typeof advisory === 'string' ? advisory : advisory.title
      ),
    });
  }

  return { allowed, blockers };
};

const run = () => {
  const result = spawnSync('npm', ['audit', '--json'], {
    cwd: mobileDirectory,
    encoding: 'utf8',
  });

  if (result.error) throw result.error;

  let audit;
  try {
    audit = JSON.parse(result.stdout);
  } catch {
    throw new Error(`npm audit did not return JSON:\n${result.stderr || result.stdout}`);
  }

  validateAuditReport(audit);
  const { allowed, blockers } = classifyAudit(audit.vulnerabilities);

  for (const exception of allowed) {
    console.warn(
      `Accepted high vulnerability: ${exception.name}. ${exception.reason} Review by ${exception.reviewAfter}.`
    );
  }

  if (blockers.length > 0) {
    console.error('Blocking dependency vulnerabilities:');
    for (const blocker of blockers) {
      console.error(`- ${blocker.name} (${blocker.severity}): ${blocker.via.join('; ')}`);
    }
    process.exitCode = 1;
  }
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run();
}
