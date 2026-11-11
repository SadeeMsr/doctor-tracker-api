/**
 * Runs on staged files only, so commits stay fast. Whole-project type checking runs
 * separately in the pre-commit hook, because a change in one file can break types in another.
 * @type {import('lint-staged').Configuration}
 */
export default {
  '*.{ts,tsx,js,mjs,cjs}': ['eslint --fix --max-warnings=0', 'prettier --write'],
  // Only the tests that import a staged file (directly or not); the full suite runs on push.
  '*.{ts,tsx}': 'vitest related --run --passWithNoTests',
  '*.{json,md,css,yml,yaml}': 'prettier --write',
};
