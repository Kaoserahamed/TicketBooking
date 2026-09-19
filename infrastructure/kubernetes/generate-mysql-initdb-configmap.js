#!/usr/bin/env node
'use strict';

/**
 * Generates mysql-initdb-configmap.yaml from infrastructure/database/schema.sql.
 *
 * The official mysql:8 image executes every file in /docker-entrypoint-initdb.d
 * (alphabetically) on the FIRST boot of a fresh volume, so the full schema ships
 * inside a ConfigMap mounted at that path (see infrastructure/kubernetes/mysql.yaml).
 *
 * Regenerate after any schema change:
 *   node infrastructure/kubernetes/generate-mysql-initdb-configmap.js
 */

const fs = require('fs');
const path = require('path');

const here = __dirname;
const schemaPath = path.join(here, '..', 'database', 'schema.sql');
const outPath = path.join(here, 'mysql-initdb-configmap.yaml');

const sql = fs
  .readFileSync(schemaPath, 'utf8')
  .replace(/\r\n/g, '\n')
  .replace(/\t/g, '  ')
  .replace(/[ ]+$/gm, '')
  .replace(/\n{3,}/g, '\n\n')
  .trim();

// The official MySQL image executes /docker-entrypoint-initdb.d scripts WITHOUT
// a default database selected (MYSQL_DATABASE alone is not enough for init
// scripts), so create + select the app database explicitly. Kept here — NOT in
// schema.sql — because the backend migration runner and CI already connect with
// the database preselected and schema.sql must stay environment-agnostic.
const DB_NAME = 'ticket_booking';
const preamble = [
  '-- K8s first-boot init (added by generate-mysql-initdb-configmap.js):',
  '-- init scripts run without a default database, so select the app DB first.',
  'CREATE DATABASE IF NOT EXISTS `' + DB_NAME + '`',
  '  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;',
  'USE `' + DB_NAME + '`;',
  '',
].join('\n');

// Block scalar: indent every line by 4 spaces, keep empty lines empty (no
// trailing whitespace — YAML block scalars preserve them literally otherwise).
const body = (preamble + sql)
  .split('\n')
  .map((l) => (l ? '    ' + l : ''))
  .join('\n');

const header = `# Generated from infrastructure/database/schema.sql — do not edit by hand.
# Mounted at /docker-entrypoint-initdb.d (see mysql.yaml) and executed by the
# official MySQL image entrypoint on the first boot of a fresh PVC.
# Regenerate after schema changes:
#   node infrastructure/kubernetes/generate-mysql-initdb-configmap.js
apiVersion: v1
kind: ConfigMap
metadata:
  name: tbs-mysql-initdb
  namespace: ticket-booking
  labels:
    app.kubernetes.io/name: mysql
    app.kubernetes.io/component: database
    app.kubernetes.io/part-of: ticket-booking
data:
  01-schema.sql: |`;

fs.writeFileSync(outPath, header + '\n' + body + '\n', 'utf8');
console.log(`Wrote ${outPath} (${sql.split('\n').length} SQL lines, ${sql.length} chars)`);
