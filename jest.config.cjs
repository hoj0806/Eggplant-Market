/**
 * 두 갈래로 나뉜다.
 *
 * - `unit`      : jsdom에서 도는 기존 테스트. api 계층을 mock하고 화면·유틸을 본다.
 * - `integration`: Node에서 돌며 **실제 Supabase 프로젝트에 붙는다.** mock이 없다.
 *
 * 나눈 이유는 환경이다. 통합 테스트는 jsdom이 필요 없고(화면을 그리지 않는다),
 * 대신 앱의 `supabaseClient`를 테스트용 클라이언트로 갈아끼워야 한다 —
 * jsdom 쪽에 같은 매핑을 걸면 mock을 쓰는 기존 테스트가 진짜 서버에 붙어 버린다.
 *
 * `npm test`는 둘 다, `npm run test:unit` / `npm run test:integration`은 한쪽만 돌린다.
 */

const TS_JEST_TRANSFORM = {
  '^.+\\.tsx?$': [
    'ts-jest',
    {
      tsconfig: {
        jsx: 'react-jsx',
        module: 'CommonJS',
        esModuleInterop: true,
        isolatedModules: true,
      },
    },
  ],
};

/** @type {import('jest').Config} */
module.exports = {
  // 통합 테스트는 실제 네트워크를 타므로 기본 5초로는 모자란다.
  // projects 안에는 못 두는 옵션이라(무시된다) 여기 둔다.
  testTimeout: 30000,
  projects: [
    {
      displayName: 'unit',
      testEnvironment: 'jsdom',
      setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
      transform: TS_JEST_TRANSFORM,
      // 통합 테스트는 이 갈래에서 뺀다. jsdom에서 돌면 매핑이 없어 import.meta로 죽는다.
      testPathIgnorePatterns: ['/node_modules/', '\\.int\\.test\\.tsx?$'],
      moduleNameMapper: {
        '\\.(css|scss|sass)$': '<rootDir>/src/shared/testUtils/cssStub.ts',
      },
    },
    {
      displayName: 'integration',
      testEnvironment: 'node',
      transform: TS_JEST_TRANSFORM,
      testMatch: ['**/*.int.test.ts'],
      // 앱 코드가 부르는 supabaseClient를 테스트용으로 바꿔치기한다.
      // 경로가 파일마다 다르므로(`../../../shared/lib/...`) 꼬리로 맞춘다.
      moduleNameMapper: {
        '^.*shared/lib/supabaseClient$':
          '<rootDir>/src/shared/testUtils/integration/supabaseTestClient.ts',
        '\\.(css|scss|sass)$': '<rootDir>/src/shared/testUtils/cssStub.ts',
      },
    },
  ],
};
