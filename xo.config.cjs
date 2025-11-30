module.exports = [
  {
    ignores: ['rollup.config.ts', 'vitest.config.ts', '__tests__/**'],
  },
  {
    space: 2,
    prettier: true,
    rules: {
      '@typescript-eslint/naming-convention': 'off',
      'unicorn/no-array-callback-reference': 'off',
      'unicorn/no-array-method-this-argument': 'off',
    },
  },
];
