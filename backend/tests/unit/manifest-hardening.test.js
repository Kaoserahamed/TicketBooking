'use strict';

/**
 * Unit tests: the Kubernetes manifests stay hardened.
 *
 * `kubectl kustomize` plus kubeconform in CI proves the manifests are *valid*,
 * not that they are *safe*. These checks cover the properties a reviewer would
 * otherwise have to eyeball on every change: resource requests and limits on
 * each container, both probes, no privileged or host-namespace access, a forced
 * pull for the mutable `:latest` tag the pipeline publishes, placeholder-only
 * secrets, a persistent volume for MySQL, and the API pinned to the same
 * unprivileged user its image already switches to.
 *
 * There is no YAML dependency in the backend, so the manifest text is read
 * directly - the same approach `env-example.test.js`, `test-stack.test.js` and
 * `ci-workflow.test.js` take for the files they guard.
 */

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const K8S_DIR = path.join(REPO_ROOT, 'infrastructure', 'kubernetes');

/** Files that define a pod template and therefore need the pod-level rules. */
const WORKLOAD_FILES = ['backend.yaml', 'frontend.yaml', 'mysql.yaml'];

/** Files that intentionally carry no `namespace:` of their own. */
const NAMESPACE_EXEMPT = ['namespace.yaml'];

const read = (name) => fs.readFileSync(path.join(K8S_DIR, name), 'utf8');

/** Every manifest in the overlay. */
function manifestFiles() {
  return fs.readdirSync(K8S_DIR).filter((name) => name.endsWith('.yaml'));
}

/**
 * Bodies of every `key:` block in a manifest, found by indentation so a nested
 * block (`resources:` inside a container) is captured on its own.
 *
 * @param {string} text
 * @param {string} key
 * @returns {string[]}
 */
function blocks(text, key) {
  const lines = text.split(/\r?\n/);
  const found = [];

  lines.forEach((line, index) => {
    const match = new RegExp(`^(\\s*)${key}:\\s*$`).exec(line);
    if (!match) {
      return;
    }

    const indent = match[1].length;
    const body = [];
    for (let i = index + 1; i < lines.length; i += 1) {
      const next = lines[i];
      if (next.trim() === '') {
        continue;
      }
      const nextIndent = next.length - next.trimStart().length;
      if (nextIndent <= indent) {
        break;
      }
      body.push(next);
    }
    found.push(body.join('\n'));
  });

  return found;
}

test('the overlay still contains the expected manifests', () => {
  const files = manifestFiles();
  assert.ok(files.length >= 10, `expected at least 10 manifests, found ${files.length}`);
  assert.ok(files.includes('kustomization.yaml'), 'the overlay needs its kustomization');
  WORKLOAD_FILES.forEach((name) => assert.ok(files.includes(name), `${name} is missing`));
});

test('every object except the namespace pins the ticket-booking namespace', () => {
  manifestFiles()
    .filter((name) => !NAMESPACE_EXEMPT.includes(name))
    .forEach((name) => {
      assert.match(read(name), /namespace: ticket-booking/, `${name} must pin the namespace`);
    });
});

test('every container resource block asks for requests and caps limits', () => {
  WORKLOAD_FILES.forEach((name) => {
    // A volume claim's `resources:` block is requests-only by design (`storage:`),
    // so it is checked by the MySQL persistence test instead.
    const resourceBlocks = blocks(read(name), 'resources').filter((body) => !/storage:/.test(body));
    assert.ok(resourceBlocks.length > 0, `${name} must declare container resources`);

    resourceBlocks.forEach((body) => {
      assert.match(body, /requests:/, `${name}: a resources block is missing requests`);
      assert.match(body, /limits:/, `${name}: a resources block is missing limits`);
      assert.match(body, /cpu:/, `${name}: a resources block is missing a cpu value`);
      assert.match(body, /memory:/, `${name}: a resources block is missing a memory value`);
    });
  });
});

test('every workload can prove it is ready and still alive', () => {
  WORKLOAD_FILES.forEach((name) => {
    const manifest = read(name);
    assert.match(manifest, /readinessProbe:/, `${name} must declare a readinessProbe`);
    assert.match(manifest, /livenessProbe:/, `${name} must declare a livenessProbe`);
  });
});

test('no workload asks for privilege or a host namespace', () => {
  const forbidden = ['privileged: true', 'hostNetwork: true', 'hostPID: true', 'hostIPC: true'];

  manifestFiles().forEach((name) => {
    const manifest = read(name);
    forbidden.forEach((pattern) => {
      assert.ok(!manifest.includes(pattern), `${name} must not use ${pattern}`);
    });
    assert.ok(!manifest.includes('hostPath:'), `${name} must not mount a hostPath volume`);
  });
});

test('the mutable latest tag always forces a fresh pull', () => {
  manifestFiles().forEach((name) => {
    const manifest = read(name);
    const mutable = manifest.match(/image:\s*\S+:latest/g) || [];
    if (mutable.length === 0) {
      return;
    }

    const forced = manifest.match(/imagePullPolicy:\s*Always/g) || [];
    assert.equal(
      forced.length,
      mutable.length,
      `${name}: every :latest image needs imagePullPolicy: Always`
    );
  });
});

test('committed secret values are obvious placeholders', () => {
  const secretBodies = blocks(read('backend-secrets.yaml'), 'stringData');
  assert.equal(secretBodies.length, 1, 'backend-secrets.yaml must declare one stringData block');

  const entries = secretBodies[0]
    .split(/\r?\n/)
    .map((line) => /^\s*([A-Z0-9_]+):\s*"?([^"]*)"?\s*$/.exec(line))
    .filter(Boolean)
    .map(([, key, value]) => [key, value]);

  assert.ok(entries.length >= 4, 'the API needs DB and JWT secrets');

  entries.forEach(([key, value]) => {
    assert.match(value, /^CHANGE-ME/, `${key} must stay a placeholder, not a real credential`);
    // A 32+ character alphanumeric blob is what a rotated secret looks like.
    assert.doesNotMatch(value, /[A-Za-z0-9+/]{32,}/, `${key} looks like a real credential`);
  });
});

test('the API pod is pinned to the unprivileged node user', () => {
  const manifest = read('backend.yaml');

  assert.match(manifest, /runAsNonRoot: true/, 'the pod must refuse to run as root');
  // runAsNonRoot cannot be verified against the image's named `node` user, so
  // the numeric id has to be pinned as well.
  assert.match(manifest, /runAsUser: 1000/);
  assert.match(manifest, /runAsGroup: 1000/);
  assert.match(manifest, /allowPrivilegeEscalation: false/);
  assert.match(manifest, /drop:\s*\["ALL"\]/, 'the container must drop every capability');
});

test('MySQL keeps its data on a persistent volume', () => {
  const manifest = read('mysql.yaml');
  assert.match(manifest, /volumeClaimTemplates:/, 'MySQL data must not live in the container');
  assert.match(manifest, /storage: \d+Gi/, 'the claim must request a concrete size');
});
