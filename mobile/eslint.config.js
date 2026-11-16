const tseslint = require('typescript-eslint')
const hooks = require('eslint-plugin-react-hooks')

module.exports = tseslint.config(
  { ignores: ['node_modules/**', '.expo/**', 'dist/**', 'expo-env.d.ts'] },
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: { 'react-hooks': hooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  { files: ['*.js'], languageOptions: { sourceType: 'commonjs' }, rules: { '@typescript-eslint/no-require-imports': 'off' } },
)
