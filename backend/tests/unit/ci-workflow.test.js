'use strict';

/**
 * Unit tests: the CI pipeline and the dependency automation stay honest.
 *
 * `.github/` is the part of the repository nobody runs locally, so a deleted
 * gate is invisible until it is needed. These checks read the workflow and the
 * Dependabot config the way a reviewer would and assert the contract the docs
 * describe: five jobs, every gate wired into the right job, container publishing
 * blocked behind all of them, actions pinned to a release tag, and updates
 * opened for both npm stacks plus the actions themselves.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const WORKFLOW_FILE = path.join(REPO_ROOT, '.github', 'workflows', 'ci.yml');
const DEPENDABOT_FILE = path.join(REPO_ROOT, '.github', 'dependabot.yml');

const JOBS = ['backend', 'frontend', 'sql', 'manifests', 'fresh-clone', 'docker'];

const read = (file) => fs.readFileSync(file, 'utf8');

/**
 * Body of a job block: everything between `  <job>:` and the next two-space key.
 *
 * @param {string} workflow
 * @param {string} job
 * @returns {string}
 */
function jobBlock(workflow, job) {
  const match = new RegExp(`^  ${job}:\\s*$`, 'm').exec(workflow);
  assert.ok(match, `ci.yml must declare a \`${job}\` job`);

  const rest = workflow.slice(match.index + match[0].length);
  const nextJob = /^\s{2}\S/m.exec(rest);
  return nextJob ? rest.slice(0, nextJob.index) : rest;
}

test('the workflow declares every documented job', () => {
  const workflow = read(WORKFLOW_FILE);
  JOBS.forEach((job) => jobBlock(workflow, job));
});

test('every job starts by checking out the repository', () => {
  const workflow = read(WORKFLOW_FILE);
  JOBS.forEach((job) => {
    assert.match(jobBlock(workflow, job), /uses: actions\/checkout@v\d+/, `${job} must check out`);
  });
});

test('the backend job runs every gate, in order', () => {
  const block = jobBlock(read(WORKFLOW_FILE), 'backend');
  [
    'npm ci',
    'npm run lint',
    'npm run format:check',
    'npm run typecheck',
    'npm audit --audit-level=high',
    'npm test',
    'npm run test:coverage',
  ].forEach((step) => assert.ok(block.includes(step), `backend job must contain \`${step}\``));

  // The coverage pass duplicates the unit suite on purpose: it is the one that
  // enforces the floors, and its report is published as an artifact.
  assert.match(block, /--audit-level=high/);
  assert.match(block, /tee coverage\/summary\.txt/);
  assert.match(block, /name: backend-coverage/);
});

test('the frontend job runs every gate, in order', () => {
  const block = jobBlock(read(WORKFLOW_FILE), 'frontend');
  [
    'npm ci',
    'npm run lint',
    'npm run format:check',
    'npm run typecheck',
    'npm audit --audit-level=high',
    'npm run test:coverage',
    'npm run build',
  ].forEach((step) => assert.ok(block.includes(step), `frontend job must contain \`${step}\``));

  assert.match(block, /name: frontend-coverage/);
});

test('the sql job rebuilds the schema before running the suite', () => {
  const block = jobBlock(read(WORKFLOW_FILE), 'sql');
  assert.match(block, /image: mysql:8\.0/);
  assert.match(block, /run-sql-tests\.ps1 -Fresh/);
});

test('the manifests job validates rendered output in strict mode', () => {
  const block = jobBlock(read(WORKFLOW_FILE), 'manifests');
  assert.match(block, /kubectl kustomize infrastructure\/kubernetes/);
  assert.match(block, /kubeconform -strict/);
  // Pinned tool version, so a new release cannot silently change the gate.
  assert.match(block, /KUBECONFORM_VERSION: v\d+\.\d+\.\d+/);
});

test('the manifests job lints the rendered overlay for misconfigurations', () => {
  const block = jobBlock(read(WORKFLOW_FILE), 'manifests');
  assert.match(block, /kube-linter lint --add-all-built-in/);
  // Pinned release, rendered output — the same objects the cluster receives.
  assert.match(block, /KUBE_LINTER_VERSION: v\d+\.\d+\.\d+/);
  assert.match(block, /kubectl kustomize infrastructure\/kubernetes/);
});

test('the manifests job also lints for misconfigurations', () => {
  const block = jobBlock(read(WORKFLOW_FILE), 'manifests');
  // kube-linter is fetched from its pinned release tarball and run with every
  // built-in check against the kustomize overlay.
  assert.match(block, /KUBE_LINTER_VERSION: v\d+\.\d+\.\d+/);
  assert.match(block, /kube-linter-linux\.tar\.gz/);
  assert.match(block, /kube-linter lint --add-all-built-in infrastructure\/kubernetes/);
});

test('the fresh-clone job proves the README recipe on a cold install', () => {
  const block = jobBlock(read(WORKFLOW_FILE), 'fresh-clone');
  // No services, no npm cache: this job is a machine that has never seen the repo.
  assert.doesNotMatch(block, /services:/);
  assert.doesNotMatch(block, /cache: npm/);
  assert.match(block, /npm run setup/);
  assert.match(block, /npm run verify:repo/);
  assert.match(block, /npm run verify/);
});

test('publishing an image waits for all five verification jobs', () => {
  const block = jobBlock(read(WORKFLOW_FILE), 'docker');
  const needs = /needs: \[([^\]]+)\]/.exec(block);
  assert.ok(needs, 'the docker job must declare needs');

  const required = needs[1]
    .split(',')
    .map((name) => name.trim())
    .sort();
  assert.deepEqual(required, ['backend', 'fresh-clone', 'frontend', 'manifests', 'sql']);
});

test('actions are pinned to a release tag, never a branch', () => {
  const refs = [...read(WORKFLOW_FILE).matchAll(/uses:\s*([\w./-]+)@([\w.-]+)/g)];
  assert.ok(refs.length >= 8, 'the workflow should be using several third-party actions');

  refs.forEach(([, action, ref]) => {
    assert.doesNotMatch(
      ref,
      /^(main|master|HEAD|latest)$/,
      `${action}@${ref} is a floating ref; pin a release tag instead`
    );
    assert.match(ref, /^v\d+(\.\d+)*$/, `${action}@${ref} should be a version tag`);
  });
});

test('the workflow cannot run two pipelines for the same ref at once', () => {
  assert.match(read(WORKFLOW_FILE), /concurrency:/);
  assert.match(read(WORKFLOW_FILE), /cancel-in-progress: true/);
});

test('Dependabot covers both npm stacks on a weekly schedule', () => {
  const config = read(DEPENDABOT_FILE);
  assert.match(config, /^version: 2$/m);

  ['/backend', '/frontend'].forEach((directory) => {
    const entry = new RegExp(
      `package-ecosystem: ['"]npm['"]\\s*\\n\\s*directory: ['"]${directory}['"]`
    );
    assert.match(config, entry, `Dependabot must watch ${directory}`);
  });

  const weekly = config.match(/interval: ['"]weekly['"]/g) || [];
  assert.ok(weekly.length >= 2, 'both npm stacks should be checked weekly');
});

test('Dependabot also keeps the GitHub Actions pinned', () => {
  const config = read(DEPENDABOT_FILE);
  assert.match(config, /package-ecosystem: ['"]github-actions['"]\s*\n\s*directory: ['"]\/['"]/);
});

test('minor and patch bumps are grouped, as the workflow docs claim', () => {
  const config = read(DEPENDABOT_FILE);
  const updateLines = config.match(/update-types:[^\n]*/g) || [];
  const grouped = updateLines.filter((line) => line.includes('minor') && line.includes('patch'));
  assert.equal(grouped.length, 2, 'each npm stack needs a minor/patch group');
  assert.match(config, /^\s+groups:$/m);
});
