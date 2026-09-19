// Root ESLint flat config (ESLint 9).
//
// The two stacks own their own configs (`backend/eslint.config.js`,
// `frontend/eslint.config.js`); this file owns the repository-level tooling
// under `scripts/` only. Every other directory is ignored here so the stacks
// keep a single authority each.
import js from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

export default [
  {
    ignores: [
      'backend/**',
      'frontend/**',
      'node_modules/**',
      'coverage/**',
      'dist/**',
      'build/**',
      'docs/**',
    ],
  },
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    ...js.configs.recommended,
  },
  prettier,
];
