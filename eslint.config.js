import prettier from 'eslint-config-prettier';
import path from 'node:path';
import { includeIgnoreFile } from '@eslint/compat';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import ts from 'typescript-eslint';
import svelteConfig from './svelte.config.js';

const gitignorePath = path.resolve(import.meta.dirname, '.gitignore');

export default defineConfig(
  includeIgnoreFile(gitignorePath),
  js.configs.recommended,
  ...ts.configs.recommended,
  ...svelte.configs.recommended,
  prettier,
  ...svelte.configs.prettier,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      // typescript-eslint strongly recommend that you do not use the no-undef lint rule on TypeScript projects.
      // see: https://typescript-eslint.io/troubleshooting/faqs/eslint/#i-get-errors-from-the-no-undef-rule-about-global-variables-not-being-defined-even-though-there-are-no-typescript-errors
      'no-undef': 'off',

      // Downgrade to warnings — noisy on a codebase with intentional any usage (API responses, LLM payloads).
      // Should be addressed incrementally, not as a release blocker.
      '@typescript-eslint/no-explicit-any': 'warn',

      // Downgrade to warnings — missing keys in each blocks are a perf concern, not a correctness error.
      // Should be added incrementally.
      'svelte/require-each-key': 'warn',

      // False-positive on plain anchor tags in Svelte files (rule expects SvelteKit goto() for <a> links).
      'svelte/no-navigation-without-resolve': 'warn',

      // {@html} usage in this project is intentional (marked markdown rendering from LLM output).
      // The content is sanitized server-side before storage.
      'svelte/no-at-html-tags': 'warn',

      // SvelteMap/SvelteSet are preferred for reactive state but using native Map/Set is not a bug.
      'svelte/prefer-svelte-reactivity': 'warn',

      // prefer-writable-derived is a new Svelte 5 lint rule; warn for now.
      'svelte/prefer-writable-derived': 'warn',

      // Allow _-prefixed variables to be unused (convention for intentionally unused params).
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }
      ]
    }
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
    languageOptions: {
      parserOptions: {
        projectService: true,
        extraFileExtensions: ['.svelte'],
        parser: ts.parser,
        svelteConfig
      }
    }
  }
);
