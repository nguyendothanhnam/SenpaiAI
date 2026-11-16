module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh', '@typescript-eslint'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true, allowExportNames: ['useAuth', 'useTheme', 'useLanguage'] },
    ],
  },
  overrides: [
    {
      files: ['**/*.ts', '**/*.tsx'],
      rules: {
        'no-undef': 'off',
        'no-unused-vars': 'off',
        'no-redeclare': 'off',
        '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
        '@typescript-eslint/no-redeclare': ['error', { builtinGlobals: false }],
      },
    },
    { files: ['vite.config.ts'], env: { node: true } },
    {
      files: ['**/*.jsx', '**/*.js'],
      rules: { 'no-undef': 'error' },
    },
  ],
}
