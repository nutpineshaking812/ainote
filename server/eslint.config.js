import js from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-plugin-prettier';

export default [
  js.configs.recommended,
  {
    files: ['**/*.js', '**/*.mjs'],
    ignores: ['node_modules/', 'uploads/', 'logs/', 'coverage/', 'scripts/templates/'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
    plugins: {
      prettier,
    },
    rules: {
      'no-console': 'off',
      'prettier/prettier': 'warn',
    },
  },
];
