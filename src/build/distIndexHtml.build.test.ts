import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { DIST_DIR, readIndexHtml } from './distFiles';
import {
  OG_IMAGE_HEIGHT,
  OG_IMAGE_PATH,
  OG_IMAGE_URL,
  OG_IMAGE_WIDTH,
  SITE_DESCRIPTION,
  SITE_TITLE,
  SITE_URL,
} from '../shared/ui/siteMeta';

/**
 * **빌드된** `index.html`을 본다.
 *
 * `siteMeta.test.ts`는 소스의 `index.html`을 보는데, 그것과 배포되는 파일은 다른 물건이다.
 * 여기서는 소스가 아니라 **실제로 나가는 것**에 태그가 남아 있는지 확인한다.
 * 파비콘·og 그림은 링크만 있으면 소용없으므로 **파일이 `dist/`에 실렸는지**까지 본다.
 */

const HTML = readIndexHtml();

function isInDist(relativePath: string): boolean {
  return existsSync(resolve(DIST_DIR, relativePath));
}

describe('dist/index.html', function distIndexHtmlSuite() {
  describe('기본 태그', function basicsSuite() {
    it('제목이 있다', function hasTitle() {
      expect(HTML).toContain(`<title>${SITE_TITLE}</title>`);
    });

    it('viewport가 있다', function hasViewport() {
      // 없으면 모바일 브라우저가 데스크탑 폭으로 그린다. 반응형이 통째로 무너진다.
      expect(HTML).toContain('name="viewport"');
      expect(HTML).toContain('width=device-width');
    });

    it('한국어 문서로 선언한다', function hasLang() {
      expect(HTML).toContain('<html lang="ko">');
    });

    it('테마 선반영 스크립트가 살아 있다', function hasThemeScript() {
      // React가 뜬 뒤에 테마를 붙이면 다크로 쓰는 사람에게 흰 화면이 번쩍인다.
      // 인라인 스크립트라 번들에 안 들어가고, 여기서만 확인된다.
      expect(HTML).toContain('eggplant-theme');
      expect(HTML).toContain('prefers-color-scheme: dark');
    });
  });

  describe('파비콘', function faviconSuite() {
    it('svg와 ico를 모두 건다', function linksBothIcons() {
      expect(HTML).toContain('href="/favicon.svg"');
      expect(HTML).toContain('href="/favicon.ico"');
    });

    it('건 파일이 dist에 실제로 실려 있다', function iconsAreShipped() {
      // 링크만 있고 파일이 없으면 SPA 폴백이 index.html을 돌려준다 — 고치기 전 그 상태다.
      expect(isInDist('favicon.svg')).toBe(true);
      expect(isInDist('favicon.ico')).toBe(true);
    });
  });

  describe('공유 카드', function openGraphSuite() {
    it('제목·설명이 들어 있다', function hasTitleAndDescription() {
      expect(HTML).toContain(SITE_DESCRIPTION);
      expect(HTML).toContain('property="og:title"');
      expect(HTML).toContain('property="og:description"');
    });

    it('주소가 배포 주소다', function hasDeployedUrl() {
      expect(HTML).toContain(SITE_URL);
    });

    it('og:image가 절대 주소이고 파일이 실려 있다', function hasOgImage() {
      expect(HTML).toContain(OG_IMAGE_URL);
      expect(isInDist(OG_IMAGE_PATH.replace('/', ''))).toBe(true);
    });

    it('그림 크기와 카드 종류를 적는다', function hasImageMetrics() {
      expect(HTML).toContain(`content="${OG_IMAGE_WIDTH}"`);
      expect(HTML).toContain(`content="${OG_IMAGE_HEIGHT}"`);
      expect(HTML).toContain('summary_large_image');
    });
  });

  describe('진입점', function entrySuite() {
    it('해시 붙은 번들을 부른다', function loadsHashedBundle() {
      expect(HTML).toMatch(/<script[^>]+src="\/assets\/index-[A-Za-z0-9_-]{8,}\.js"/);
    });

    it('해시 붙은 스타일을 부른다', function loadsHashedStylesheet() {
      expect(HTML).toMatch(/<link[^>]+href="\/assets\/index-[A-Za-z0-9_-]{8,}\.css"/);
    });

    it('개발용 진입점이 남아 있지 않다', function hasNoDevEntry() {
      // `/src/main.tsx`가 남으면 배포에서 404다. vite가 바꿔치기하는 자리라 조용히 샌다.
      expect(HTML).not.toContain('/src/main.tsx');
    });
  });
});
