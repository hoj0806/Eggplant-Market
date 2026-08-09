import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

/**
 * `dist/`를 읽는 도우미.
 *
 * 테스트 800여 개는 **소스가 맞는가**를 본다. ts-jest가 TypeScript를 CommonJS로 바꿔
 * 돌리는 것이라 **빌드 결과물은 한 번도 안 본다.** 그 틈으로 2026-08-08 하루에만
 * 셋이 샜다(카카오 앱키 한 글자 잘림 · 축소 캔버스 · Edge Function 키).
 *
 * 여기 있는 검사들은 다른 질문을 한다 — **제대로 실려 나갔는가.**
 */

const PROJECT_ROOT = resolve(__dirname, '../..');

export const DIST_DIR = resolve(PROJECT_ROOT, 'dist');
const ASSETS_DIR = resolve(DIST_DIR, 'assets');

const REBUILD_HINT = '`npm run test:build`으로 돌리면 빌드부터 한다.';

export type DistAsset = {
  name: string;
  text: string;
  bytes: Buffer;
};

/**
 * 테스트 파일은 세지 않는다. **빌드에 안 들어가기 때문이다.**
 *
 * 빼지 않으면 이 파일을 고칠 때마다 "dist가 낡았다"가 뜬다. 틀린 말은 아니지만 쓸데없이
 * 빌드를 시키는 잔소리가 되고, 잔소리가 잦으면 사람은 검사를 꺼 버린다.
 */
function isBuildInput(fileName: string): boolean {
  return !/\.test\.tsx?$/.test(fileName);
}

function newestMtime(directory: string): number {
  let newest = 0;

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);

    if (entry.isDirectory()) {
      newest = Math.max(newest, newestMtime(path));
      continue;
    }
    if (isBuildInput(entry.name)) {
      newest = Math.max(newest, statSync(path).mtimeMs);
    }
  }
  return newest;
}

/**
 * `dist/`가 있고, **소스보다 늦게 만들어졌는지** 본다.
 *
 * 낡은 `dist/`를 검사하면 초록이 뜨는데 그 초록은 **지금 코드에 대한 말이 아니다.**
 * 2026-08-08에 환경변수를 고치고 재배포를 안 해 옛 번들이 계속 서비스된 일이 있었다 —
 * 같은 모양의 착각을 로컬에서 먼저 막는다.
 */
function requireFreshDist(): void {
  if (!existsSync(DIST_DIR)) {
    throw new Error(`dist/가 없다. ${REBUILD_HINT}`);
  }

  const builtAt = statSync(resolve(DIST_DIR, 'index.html')).mtimeMs;
  const sourceChangedAt = Math.max(
    newestMtime(resolve(PROJECT_ROOT, 'src')),
    statSync(resolve(PROJECT_ROOT, 'index.html')).mtimeMs,
    statSync(resolve(PROJECT_ROOT, 'vite.config.ts')).mtimeMs,
  );

  if (builtAt < sourceChangedAt) {
    throw new Error(`dist/가 소스보다 낡았다 — 낡은 번들을 검사해도 초록은 거짓말이다. ${REBUILD_HINT}`);
  }
}

export function readDistFile(relativePath: string): Buffer {
  requireFreshDist();
  return readFileSync(resolve(DIST_DIR, relativePath));
}

export function readIndexHtml(): string {
  return readDistFile('index.html').toString('utf-8');
}

/** `dist/assets`에서 확장자가 맞는 것만. 없으면 빈 배열이 아니라 실패시킨다(호출한 쪽에서). */
export function readAssets(extension: string): DistAsset[] {
  requireFreshDist();

  return readdirSync(ASSETS_DIR)
    .filter(function hasExtension(name: string): boolean {
      return name.endsWith(extension);
    })
    .map(function toAsset(name: string): DistAsset {
      const bytes = readFileSync(resolve(ASSETS_DIR, name));

      return { name, text: bytes.toString('utf-8'), bytes };
    });
}

/** 자산 목록을 한 덩어리 글로 잇는다. "어느 파일엔가 있다"를 볼 때 쓴다. */
export function joinText(assets: DistAsset[]): string {
  return assets
    .map(function pickText(asset: DistAsset): string {
      return asset.text;
    })
    .join('\n');
}

/** 사용자가 실제로 내려받는 크기. 서버가 gzip으로 보내므로 원본 크기는 감시할 값이 아니다. */
export function gzipSize(assets: DistAsset[]): number {
  return assets.reduce(function addSize(total: number, asset: DistAsset): number {
    return total + gzipSync(asset.bytes).length;
  }, 0);
}
