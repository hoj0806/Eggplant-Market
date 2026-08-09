/**
 * 세 갈래로 나뉜다.
 *
 * - `unit`      : jsdom에서 도는 기존 테스트. api 계층을 mock하고 화면·유틸을 본다.
 * - `integration`: Node에서 돌며 **실제 Supabase 프로젝트에 붙는다.** mock이 없다.
 * - `build`     : **소스가 아니라 `dist/`를 읽는다.** 빌드가 있어야 의미가 있다.
 *
 * 앞의 둘을 나눈 이유는 환경이다. 통합 테스트는 jsdom이 필요 없고(화면을 그리지 않는다),
 * 대신 앱의 `supabaseClient`를 테스트용 클라이언트로 갈아끼워야 한다 —
 * jsdom 쪽에 같은 매핑을 걸면 mock을 쓰는 기존 테스트가 진짜 서버에 붙어 버린다.
 *
 * `build`를 나눈 이유는 다르다. 앞의 둘은 *"로직이 맞는가"*를 묻고, `build`는
 * *"제대로 실려 나갔는가"*를 묻는다. **다른 질문이고 둘 다 필요하다.**
 * `import.meta.env`는 빌드 시점에 값이 박히는데, 단위는 그 모듈을 mock하고 통합은
 * `process.env` 쌍둥이로 갈아끼운다 — 그 경로를 밟는 테스트가 구조적으로 없었다.
 *
 * `npm test`는 앞의 둘만 돌린다. `build`는 **`npm run test:build`가 빌드부터 하고** 돌린다 —
 * 낡은 `dist/`를 검사한 초록은 지금 코드에 대한 말이 아니라서, 섞어 돌리면 안 된다.
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
      // 빌드 검사도 뺀다. dist/가 없거나 낡았을 때 실패해야 하는 테스트라, 빌드와 짝지어
      // 돌지 않으면 `npm test`가 이유 없이 빨개진다.
      testPathIgnorePatterns: [
        '/node_modules/',
        '\\.int\\.test\\.tsx?$',
        '\\.build\\.test\\.tsx?$',
      ],
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
    {
      displayName: 'build',
      // 화면을 그리지 않는다. 파일을 읽고 정규식을 돌릴 뿐이다.
      testEnvironment: 'node',
      transform: TS_JEST_TRANSFORM,
      testMatch: ['**/*.build.test.ts'],
    },
  ],
};
