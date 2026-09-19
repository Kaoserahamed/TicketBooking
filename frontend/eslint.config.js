import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'

/**
 * ESLint flat config for the web app (ESLint 9 + typescript-eslint).
 *
 * `eslint-config-prettier` is applied last so linting and formatting never
 * disagree: ESLint owns correctness, Prettier owns layout (see `.prettierrc.json`
 * and `npm run format`).
 */
export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules', '*.log'] },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      // `any` hides real API contract drift in a typed codebase.
      '@typescript-eslint/no-explicit-any': 'error',
      eqeqeq: ['error', 'smart'],
      'no-var': 'error',
      'prefer-const': 'error',
      // Diagnostics are allowed, but not as a logging strategy.
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },

  // Must stay last: turns off rules that would conflict with Prettier.
  prettier
)
