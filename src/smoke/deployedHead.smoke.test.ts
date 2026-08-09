import { probe } from './httpProbe';
import {
  OG_IMAGE_URL,
  SITE_DESCRIPTION,
  SITE_TITLE,
  SITE_URL,
} from '../shared/ui/siteMeta';

/**
 * 배포된 `index.html`의 `<head>`를 본다.
 *
 * `build` 갈래가 같은 것을 `dist/`에서 본다. 여기서 다시 보는 이유는 하나다 —
 * **그 `dist/`가 실제로 올라갔는지는 밖에서만 안다.** 2026-08-08에 고친 번들이
 * 올라가지 않아 옛 것이 계속 서비스됐고, 로컬 검사는 내내 초록이었다.
 *
 * 즉 이 절이 빨간데 `build`가 초록이면 **코드가 아니라 배포가 밀린 것이다.**
 */

describe('배포된 index.html의 head', function deployedHeadSuite() {
  async function html(): Promise<string> {
    return (await probe('/')).body;
  }

  it('제목과 설명이 실려 있다', async function hasTitleAndDescription() {
    const head = await html();

    expect(head).toContain(`<title>${SITE_TITLE}</title>`);
    expect(head).toContain(SITE_DESCRIPTION);
  });

  it('파비콘 링크가 실려 있다', async function hasFaviconLinks() {
    const head = await html();

    expect(head).toContain('href="/favicon.svg"');
    expect(head).toContain('href="/favicon.ico"');
  });

  it('공유 카드 태그가 실려 있다', async function hasOpenGraphTags() {
    const head = await html();

    expect(head).toContain('property="og:title"');
    expect(head).toContain(OG_IMAGE_URL);
    expect(head).toContain('summary_large_image');
  });

  it('og:url이 지금 검사하는 주소와 같다', async function ogUrlMatchesTarget() {
    // 다른 주소가 박혀 있으면 공유 카드가 엉뚱한 곳을 가리킨다.
    const head = await html();

    expect(head).toContain(SITE_URL);
  });

  it('테마 선반영 스크립트가 살아 있다', async function hasThemeScript() {
    // 인라인 스크립트라 번들에 안 들어간다. 빠지면 다크로 쓰는 사람에게 흰 화면이 번쩍인다.
    const head = await html();

    expect(head).toContain('eggplant-theme');
  });

  it('개발용 진입점이 남아 있지 않다', async function hasNoDevEntry() {
    const head = await html();

    expect(head).not.toContain('/src/main.tsx');
  });
});
