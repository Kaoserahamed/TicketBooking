#!/usr/bin/env node
/**
 * verify-repo.mjs — hermetic repository-level drift guard.
 *
 * Runs with plain Node (no dependencies, no network, no database): it proves
 * the monorepo layout that the README and CI rely on is intact — every
 * `package.json` version agrees, every lockfile matches its manifest, and the
 * root entry points a fresh clone needs are present.
 *
 * Covered by CI (the `fresh-clone` job runs it via `npm run verify:repo`).
 */

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const failures = [];

function fail(message) {
  failures.push(message);
}

function readJson(relativePath) {
  const absolute = path.join(repoRoot, relativePath);
  return JSON.parse(readFileSync(absolute, 'utf8'));
}

// 1. Every manifest declares the same version as the root.
const root = readJson('package.json');
for (const stack of ['backend', 'frontend']) {
  const manifest = readJson(`${stack}/package.json`);
  if (manifest.version !== root.version) {
    fail(`${stack}/package.json version ${manifest.version} != root ${root.version}`);
  }
}

// 2. Every manifest has a matching, committed lockfile.
for (const line of ['', 'backend', 'frontend']) {
  const lockfile = line === '' ? 'package-lock.json' : `${line}/package-lock.json`;
  const manifest = readJson(line === '' ? 'package.json' : `${line}/package.json`);
  if (!existsSync(path.join(repoRoot, lockfile))) {
    fail(`missing ${lockfile}`);
    continue;
  }
  const lock = readJson(lockfile);
  if (lock.name !== manifest.name || lock.version !== manifest.version) {
    fail(`${lockfile} describes ${lock.name}@${lock.version}, expected ${manifest.name}@${manifest.version}`);
  }
}

// 3. The entry points a fresh clone needs are actually declared.
const requiredScripts = ['setup', 'test', 'test:unit', 'lint', 'typecheck', 'verify:repo'];
for (const script of requiredScripts) {
  if (!root.scripts || !root.scripts[script]) {
    fail(`root package.json is missing the "${script}" script`);
  }
}

// 4. The root pins the runtime the containers and CI run on.
const engines = root.engines && root.engines.node;
if (!engines || !/>=?20/.test(engines)) {
  fail(`root engines.node (${engines ?? 'unset'}) must require Node 20+`);
}

if (failures.length > 0) {
  for (const failure of failures) {
    process.stderr.write(`verify-repo: ${failure}\n`);
  }
  process.exit(1);
}

process.stdout.write(`verify-repo: ok (ticket-booking-system@${root.version})\n`);
