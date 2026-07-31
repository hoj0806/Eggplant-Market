import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

// convention.md 규칙을 lint로 강제한다.
export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'coverage'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // 화살표 함수 금지 → 함수 선언/함수 표현식 사용
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ArrowFunctionExpression',
          message: '화살표 함수 사용 금지 — 함수 선언/함수 표현식을 사용하세요 (convention.md).',
        },
      ],
      // any 금지
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
);
