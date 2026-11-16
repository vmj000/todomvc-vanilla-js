import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: ['node_modules/**', 'coverage/**', 'playwright-report/**', 'test-results/**', 'blob-report/**'],
  },
  {
    ...js.configs.recommended,
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    rules: {
      ...js.configs.recommended.rules,
      eqeqeq: 'error',
      'no-var': 'error',
      'prefer-const': 'error',
    },
  },
  {
    files: ['js/**/*.js', 'tests/browser-checks.js'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['scripts/**/*.js', 'tests/*.test.js', '*.config.js'],
    languageOptions: { globals: globals.node },
  },
  {
    // Playwright tests run in Node.js; page.evaluate/addInitScript callbacks run in the browser.
    files: ['tests/e2e/**/*.js'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
];
