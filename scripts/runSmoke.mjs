/**
 * `npm run test:smoke -- https://…` 를 받아 스모크 갈래를 돌린다.
 *
 * 왜 감싸는가
 * ----------
 * jest는 이름 없는 인자를 **테스트 파일 이름 패턴**으로 읽는다. 주소를 그대로 넘기면
 * 테스트를 하나도 못 찾고 **초록으로 끝난다** — 가장 나쁜 실패다.
 *
 * 그래서 주소를 환경변수로 옮겨 담고 jest를 부른다. 윈도우 PowerShell에는
 * `VAR=값 명령` 문법이 없어서, 환경변수로만 받게 두면 쓰기 불편해지는 것도 이유다.
 */

import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';

const target = process.argv[2] ?? process.env.SMOKE_URL;

if (target === undefined || target.trim() === '') {
  console.error('검사할 주소가 필요하다.\n');
  console.error('  npm run test:smoke -- https://eggplant-market-ga6d-flame.vercel.app\n');
  console.error('주소가 없으면 건너뛰지 않고 실패시킨다 — 초록인 채로 아무것도 안 지키는');
  console.error('테스트가 그물이 없는 것보다 나쁘기 때문이다.');
  process.exit(1);
}

if (!/^https?:\/\//.test(target)) {
  console.error(`주소는 http(s)로 시작해야 한다: ${target}`);
  process.exit(1);
}

// `npx jest`가 아니라 jest의 진입 파일을 지금 node로 직접 돌린다.
// 윈도우의 node 22는 `.cmd`(=`npx.cmd`) 실행을 막는다(EINVAL). shell을 열어 우회할 수도
// 있지만, 주소가 셸을 거치면 따옴표 처리를 신경 써야 해서 파일을 직접 부르는 편이 낫다.
//
// `resolve('jest/bin/jest.js')`는 안 된다 — jest의 package.json `exports`가 bin을
// 안 내보낸다. 그래서 패키지 위치를 먼저 잡고 경로를 붙인다.
const require = createRequire(import.meta.url);
const jestBin = resolve(dirname(require.resolve('jest/package.json')), 'bin/jest.js');

const jest = spawn(process.execPath, [jestBin, '--selectProjects', 'smoke'], {
  stdio: 'inherit',
  env: { ...process.env, SMOKE_URL: target },
});

jest.on('close', function relayExitCode(code) {
  process.exit(code ?? 1);
});
