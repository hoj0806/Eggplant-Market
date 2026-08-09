import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  OG_IMAGE_HEIGHT,
  OG_IMAGE_PATH,
  OG_IMAGE_URL,
  OG_IMAGE_WIDTH,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TITLE,
  SITE_URL,
} from './siteMeta';

/**
 * `index.html`은 정적이라 `siteMeta.ts`를 import할 수 없다 — 값을 옮겨 적은 사본이다.
 * 사본은 언젠가 한쪽만 고쳐지므로, **어긋나는 순간 여기서 깨지게** 해 둔다.
 * (`brandMarkShape.test.ts`와 같은 방법이다.)
 *
 * 공유 카드가 실제로 뜨는지는 밖에서만 안다 — 카카오·슬랙이 직접 긁어 가기 때문이다.
 * 여기서 지킬 수 있는 것은 **태그가 있고 값이 어긋나지 않았다**까지다.
 */

const PROJECT_ROOT = resolve(__dirname, '../../..');
const INDEX_HTML = readFileSync(resolve(PROJECT_ROOT, 'index.html'), 'utf-8');

function metaContent(attribute: string, name: string) {
  // 여러 줄로 나뉘어 적힌 태그도 잡아야 한다(prettier가 긴 content를 내려 쓴다).
  const pattern = new RegExp(
    `<meta[^>]*${attribute}="${name}"[^>]*content="([^"]*)"|` +
      `<meta[^>]*content="([^"]*)"[^>]*${attribute}="${name}"`,
    's',
  );
  const found = INDEX_HTML.match(pattern);

  if (found === null) {
    return null;
  }
  return found[1] ?? found[2];
}

describe('공유 카드 메타 태그', function siteMetaSuite() {
  it('제목이 <title>·og:title과 모두 같다', function titleMatches() {
    expect(INDEX_HTML).toContain(`<title>${SITE_TITLE}</title>`);
    expect(metaContent('property', 'og:title')).toBe(SITE_TITLE);
  });

  it('설명이 description·og:description에 같은 문장으로 들어 있다', function descriptionMatches() {
    expect(metaContent('name', 'description')).toBe(SITE_DESCRIPTION);
    expect(metaContent('property', 'og:description')).toBe(SITE_DESCRIPTION);
  });

  it('사이트 이름이 og:site_name과 같다', function siteNameMatches() {
    expect(metaContent('property', 'og:site_name')).toBe(SITE_NAME);
  });

  it('og:url이 배포 주소와 같다', function urlMatches() {
    expect(metaContent('property', 'og:url')).toBe(SITE_URL);
  });

  it('og:image가 절대 주소다', function imageIsAbsolute() {
    // 상대 경로면 슬랙·카카오가 그림을 못 찾는다. 여기서 막는다.
    const content = metaContent('property', 'og:image');

    expect(content).toBe(OG_IMAGE_URL);
    expect(content).toMatch(/^https:\/\//);
  });

  it('og:image 크기가 실제 파일과 같다', function imageSizeMatches() {
    expect(metaContent('property', 'og:image:width')).toBe(String(OG_IMAGE_WIDTH));
    expect(metaContent('property', 'og:image:height')).toBe(String(OG_IMAGE_HEIGHT));
  });

  it('type·locale·트위터 카드 종류를 적는다', function hasRemainingTags() {
    expect(metaContent('property', 'og:type')).toBe('website');
    expect(metaContent('property', 'og:locale')).toBe('ko_KR');
    // 이것이 없으면 큰 그림 대신 작은 정사각형 썸네일이 뜬다.
    expect(metaContent('name', 'twitter:card')).toBe('summary_large_image');
  });

  it('배포 주소는 끝에 슬래시가 없다', function urlHasNoTrailingSlash() {
    // OG_IMAGE_URL이 이어 붙이기라, 슬래시가 붙으면 `//og-image.png`가 된다.
    expect(SITE_URL.endsWith('/')).toBe(false);
    expect(OG_IMAGE_URL).toBe(`${SITE_URL}${OG_IMAGE_PATH}`);
  });
});

describe('og 그림 파일', function ogImageSuite() {
  const bytes = readFileSync(resolve(PROJECT_ROOT, `public${OG_IMAGE_PATH}`));

  it('PNG다', function isPng() {
    expect(bytes.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
  });

  it('선언한 크기와 실제 크기가 같다', function sizeMatches() {
    // PNG의 IHDR은 항상 첫 청크다. 폭·높이가 16바이트째부터 4바이트씩 들어 있다.
    expect(bytes.readUInt32BE(16)).toBe(OG_IMAGE_WIDTH);
    expect(bytes.readUInt32BE(20)).toBe(OG_IMAGE_HEIGHT);
  });

  it('수집기가 마다할 만큼 크지 않다', function isSmallEnough() {
    // 카카오·페이스북 모두 5MB 근처를 상한으로 둔다. 넉넉히 1MB로 잡아 회귀만 잡는다.
    expect(bytes.length).toBeLessThan(1024 * 1024);
  });
});
