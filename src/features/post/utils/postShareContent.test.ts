import { toPostShareTemplate, toShareDescription } from './postShareContent';
import type { PostDetail } from '../types';

const ORIGIN = 'https://eggplant-market-ga6d-flame.vercel.app';

function makePost(overrides: Partial<PostDetail> = {}): PostDetail {
  return {
    id: 7,
    title: '아이패드 9세대',
    description: '작년에 산 아이패드입니다. 생활기스 조금 있어요.',
    price: 250000,
    status: 'selling',
    categoryId: 14,
    categoryName: '태블릿/PC',
    dongName: '서울특별시 성북구 석관동',
    tradePlace: null,
    images: ['https://cdn.example.com/photo.png'],
    viewCount: 3,
    likeCount: 1,
    commentCount: 0,
    isLiked: false,
    createdAt: '2026-08-10T00:00:00.000Z',
    updatedAt: '2026-08-10T00:00:00.000Z',
    bumpedAt: '2026-08-10T00:00:00.000Z',
    soldAt: null,
    seller: { id: 'seller-1', nickname: '가지팔이', avatarUrl: null, mannerTemp: 36.5 },
    buyer: null,
    ...overrides,
  };
}

describe('toShareDescription', function descriptionSuite() {
  it('가격을 먼저 말한다', function priceFirstCase() {
    // 중고거래에서 먼저 보는 값이다.
    expect(toShareDescription(makePost())).toMatch(/^250,000원 · 서울특별시 성북구 석관동/);
  });

  it('동네가 없으면 가격만 앞세운다', function noRegionCase() {
    expect(toShareDescription(makePost({ dongName: null, description: '' }))).toBe('250,000원');
  });

  it('설명의 줄바꿈을 한 줄로 편다', function flattensCase() {
    const flat = toShareDescription(makePost({ description: '첫 줄\n\n둘째 줄' }));

    expect(flat).not.toContain('\n');
    expect(flat).toContain('첫 줄 둘째 줄');
  });

  /** 카카오가 자르기 전에 우리가 자른다 — 어디서 잘리는지는 우리가 정하는 편이 낫다. */
  it('길면 잘라서 말줄임을 붙인다', function truncatesCase() {
    const long = toShareDescription(makePost({ description: '아'.repeat(200) }));

    expect(long.length).toBeLessThanOrEqual(60);
    expect(long.endsWith('…')).toBe(true);
  });

  it('설명이 비면 앞부분만 남는다', function emptyBodyCase() {
    expect(toShareDescription(makePost({ description: '   ' }))).toBe(
      '250,000원 · 서울특별시 성북구 석관동',
    );
  });
});

describe('toPostShareTemplate', function templateSuite() {
  it('그 글의 절대 주소를 카드와 버튼 **둘 다**에 건다', function linksBothCase() {
    // 한쪽만 걸면 "눌렀는데 아무 일도 없다"가 생긴다.
    const template = toPostShareTemplate(makePost(), ORIGIN);
    const url = `${ORIGIN}/posts/7`;

    expect(template.content.link).toEqual({ mobileWebUrl: url, webUrl: url });
    expect(template.buttons[0].link).toEqual({ mobileWebUrl: url, webUrl: url });
  });

  /**
   * **이 줄이 이번 기능의 요지다.** `backlog.md`는 게시물별 공유 카드를 SSR이 필요하다는
   * 이유로 안 만들기로 했는데, 그것은 **링크를 붙여 넣는 경우**의 이야기다.
   * 카카오톡 공유는 내용을 직접 실어 보내므로 글마다 다른 사진·제목이 그대로 담긴다.
   */
  it('그 글의 사진과 제목을 그대로 담는다', function perPostContentCase() {
    const template = toPostShareTemplate(makePost(), ORIGIN);

    expect(template.content.title).toBe('아이패드 9세대');
    expect(template.content.imageUrl).toBe('https://cdn.example.com/photo.png');
  });

  it('사진이 없으면 사이트 공통 그림으로 물러난다', function fallbackImageCase() {
    const template = toPostShareTemplate(makePost({ images: [] }), ORIGIN);

    expect(template.content.imageUrl).toBe(`${ORIGIN}/og-image.png`);
  });

  it('주소 끝의 슬래시가 겹치지 않는다', function trailingSlashCase() {
    const template = toPostShareTemplate(makePost(), `${ORIGIN}/`);

    expect(template.content.link.webUrl).toBe(`${ORIGIN}/posts/7`);
  });
});
