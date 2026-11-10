import js from '@eslint/js';
import typescriptEslint from '@typescript-eslint/eslint-plugin';
import jest from 'eslint-plugin-jest';
import jestDom from 'eslint-plugin-jest-dom';
import prettierRecommended from 'eslint-plugin-prettier/recommended';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import testingLibrary from 'eslint-plugin-testing-library';
import globals from 'globals';

export default [
  {
    ignores: ['**/dist'],
  },
  js.configs.recommended,
  ...typescriptEslint.configs['flat/recommended'],
  react.configs.flat.recommended,
  react.configs.flat['jsx-runtime'],
  reactHooks.configs['recommended-latest'],
  testingLibrary.configs['flat/react'],
  jest.configs['flat/recommended'],
  jestDom.configs['flat/recommended'],
  prettierRecommended,
  {
    plugins: {
      'react-refresh': reactRefresh,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.jest,
      },
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      '@typescript-eslint/explicit-member-accessibility': [
        'error',
        {
          accessibility: 'no-public',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'off',
      curly: ['error', 'multi-line'],
      'jest/expect-expect': 'off',
      'jest/no-standalone-expect': 'off',
      'object-shorthand': ['error', 'always'],
      'no-useless-rename': 'error',
      'react/no-unescaped-entities': [
        'error',
        {
          forbid: ['>', '"', '}'],
        },
      ],
      'react-refresh/only-export-components': [
        'error',
        {
          allowConstantExport: true,
        },
      ],
      'testing-library/no-node-access': 'off',
    },
  },
];
