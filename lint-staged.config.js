/**
 * Runs on staged files only, so commits stay fast. Whole-project type checking runs
 * separately in the pre-commit hook, because a change in one file can break types in another.
 * @type {import('lint-staged').Configuration}
 */
export default {
  '*.{ts,tsx,js,mjs,cjs}': ['eslint --fix --max-warnings=0', 'prettier --write'],
  '*.{json,md,css,yml,yaml}': 'prettier --write',
};
