import { gzipSize, joinText, readAssets } from './distFiles';

/**
 * Tailwind가 실제로 클래스를 담았는지 본다.
 *
 * **단위 테스트는 CSS를 `cssStub.ts`로 통째 대체한다** — Tailwind를 한 번도 보지 않는다.
 * 그래서 purge가 클래스를 삼켜도 800여 개가 전부 초록이고, 화면만 무너진다.
 * 여기가 그것을 잡는 유일한 그물이다.
 */

const CSS_ASSETS = readAssets('.css');
const CSS = joinText(CSS_ASSETS);

/**
 * 직접 만든 유틸리티. `index.css`가 한 곳에서 정의하고 스물세 화면이 쓴다 —
 * 하나가 빠지면 그 성격의 화면이 통째로 폭을 잃는다.
 */
const CUSTOM_UTILITIES = ['page-narrow', 'page-wide', 'page-detail'];

/** 반응형이 살아 있는지. `md:`가 통째로 빠지는 것이 purge 사고의 전형이다. */
const RESPONSIVE_SAMPLES = ['md:grid-cols-2', 'md:max-w-2xl', 'lg:max-w-6xl'];

const GZIP_LIMIT_BYTES = 40 * 1024;

/**
 * 클래스 이름이 **거기서 끝나는지**까지 본다.
 *
 * `toContain('.page-narrow')`로는 `.page-narrowX`도 통과한다 — 이름이 바뀌어 규칙이
 * 사라진 경우를 못 잡는다. 선택자는 뒤에 `{`·`,`·`:`·공백 중 하나가 오므로 그것을 요구한다.
 * `:`는 CSS에서 `\:`로 이스케이프되고, `.`은 정규식 문자라 둘 다 escape가 필요하다.
 */
function selectorPattern(className: string): RegExp {
  const escaped = className.replace(/:/g, '\\\\:').replace(/\./g, '\\.');

  return new RegExp(`\\.${escaped}[\\s,{:]`);
}

describe('dist/assets 스타일', function distStylesSuite() {
  it('스타일 파일이 있다', function stylesheetExists() {
    expect(CSS_ASSETS.length).toBeGreaterThan(0);
  });

  it.each(CUSTOM_UTILITIES)('%s 유틸리티가 담겼다', function hasCustomUtility(name: string) {
    expect(CSS).toMatch(selectorPattern(name));
  });

  it.each(RESPONSIVE_SAMPLES)('%s가 담겼다', function hasResponsiveClass(name: string) {
    expect(CSS).toMatch(selectorPattern(name));
  });

  it('다크모드 변형이 담겼다', function hasDarkVariant() {
    // 클래스 기반 다크모드다(`@custom-variant dark`). 이것이 빠지면 다크가 통째로 안 먹는다.
    expect(CSS).toContain('.dark');
  });

  it('바탕색 규칙이 담겼다', function hasBodyBackground() {
    // index.css가 body 배경을 한 곳에서 정한다. 빠지면 다크에서 흰 판이 나온다.
    expect(CSS).toMatch(/body\s*\{[^}]*background-color/);
  });

  it('파일 이름에 내용 해시가 있다', function fileNamesAreHashed() {
    for (const asset of CSS_ASSETS) {
      expect(asset.name).toMatch(/-[A-Za-z0-9_-]{8,}\.css$/);
    }
  });

  it(`gzip 합계가 ${GZIP_LIMIT_BYTES / 1024} kB를 안 넘는다`, function stylesAreNotBloated() {
    // 지금 7 kB. 넉넉히 잡아 두고 purge가 통째로 꺼지는 사고만 잡는다
    // (그때는 Tailwind 전체가 실려 수백 kB가 된다).
    const sizeKb = Math.round(gzipSize(CSS_ASSETS) / 1024);

    expect(sizeKb).toBeLessThan(GZIP_LIMIT_BYTES / 1024);
  });
});
