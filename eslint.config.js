// @ts-check
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Clean Architecture dependency rule, enforced by the linter:
 *   domain ← application ← presentation / infrastructure ← composition root (container, server)
 * Inner layers may never import outer layers or frameworks.
 */
const layer = (forbiddenDirs, forbiddenPackages, message) => ({
  'no-restricted-imports': [
    'error',
    {
      patterns: forbiddenDirs.map((dir) => ({ group: [`**/${dir}/**`], message })),
      paths: forbiddenPackages.map((name) => ({ name, message })),
    },
  ],
});

const FRAMEWORKS = ['express', 'mongoose', 'mongodb', 'pino', 'jsonwebtoken', 'argon2'];

export default defineConfig([
  globalIgnores(['dist/', 'coverage/']),
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      globals: globals.node,
      parserOptions: {
        projectService: { allowDefaultProject: ['eslint.config.js'] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-extraneous-class': 'off',
      // `value || undefined` is the intended idiom for turning '' into "not provided".
      '@typescript-eslint/prefer-nullish-coalescing': [
        'error',
        { ignorePrimitives: { string: true } },
      ],
      eqeqeq: ['error', 'always'],
      'no-console': ['warn', { allow: ['error'] }],
    },
  },
  {
    files: ['src/domain/**/*.ts'],
    rules: layer(
      ['application', 'infrastructure', 'presentation', 'config'],
      [...FRAMEWORKS, 'zod'],
      'The domain layer must stay pure: no outer layers, frameworks or config.',
    ),
  },
  {
    files: ['src/application/**/*.ts'],
    rules: layer(
      ['infrastructure', 'presentation', 'config'],
      FRAMEWORKS,
      'The application layer depends on domain ports only, never on adapters or frameworks.',
    ),
  },
  {
    files: ['src/presentation/**/*.ts'],
    rules: layer(
      ['infrastructure', 'config'],
      ['mongoose', 'mongodb'],
      'The HTTP layer talks to use cases; dependencies are injected by the composition root.',
    ),
  },
  {
    files: ['src/infrastructure/**/*.ts'],
    rules: layer(['presentation'], ['express'], 'Infrastructure adapters must not depend on HTTP.'),
  },
  {
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  prettier,
]);
