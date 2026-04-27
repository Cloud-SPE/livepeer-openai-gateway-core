// ESLint 9 flat config for @cloudspe/livepeer-gateway-core.
//
// The custom-rule plugin lives at `lint/eslint-plugin-livepeer-bridge/`.
// It enforces the layer stack (types → config → repo → service →
// runtime, providers cross-cutting), the zod-at-boundary rule, the
// no-secrets-in-logs scan, the file-size soft cap, and the cross-
// cutting-import guard. The plugin code stays in this repo for now;
// follow-up may publish it as `@cloudspe/eslint-plugin-livepeer-gateway-core`
// for shell consumers.

import tseslint from 'typescript-eslint';
import livepeerBridge from './lint/eslint-plugin-livepeer-bridge/index.js';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**', '**/*.d.ts', 'src/**/gen/**'],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      // Conventional `_`-prefix opt-out for required-but-unused
      // parameters (e.g. interface impls that take args they ignore).
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['src/**/*.ts'],
    plugins: {
      'livepeer-bridge': livepeerBridge,
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        projectService: false,
      },
    },
    rules: {
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'livepeer-bridge/layer-check': 'error',
      'livepeer-bridge/no-cross-cutting-import': 'error',
      'livepeer-bridge/zod-at-boundary': 'error',
      'livepeer-bridge/no-secrets-in-logs': 'error',
      'livepeer-bridge/file-size': 'warn',
      'livepeer-bridge/types-shape': 'error',
    },
  },
);
