import { fetchNeighborhoodPosts, searchPosts } from './postApi';
import { EMPTY_POST_SEARCH_FILTERS } from '../../browse/utils/postSearchFilters';
import { getAdminClient } from '../../../shared/testUtils/integration/supabaseAdminClient';
import {
  createFixture,
  createTestChatRoom,
  createTestPost,
  createTestUser,
} from '../../../shared/testUtils/integration/fixtures';
import type { Fixture, FixtureUser } from '../../../shared/testUtils/integration/fixtures';
import type { PostSummary } from '../types';

/**
 * 목록·검색 — **실제 Supabase에 붙어** `search_posts` RPC를 밟는다. mock이 없다.
 * 앱이 부르는 함수를 그대로 부르므로 여기서 초록이면 화면도 같은 답을 받는다.
 *
 * 확인은 **로그인하지 않은 채로** 한다. 목록 읽기는 `posts_select`가 `using (true)`라
 * 익명도 지나가야 하는 자리이고, 서비스 키로 읽으면 정책이 꺼져 그 사실을 못 본다.
 *
 * ── 자기만의 동네를 쓴다 ──────────────────────────────────────────────
 * 처음에는 "DB에 있는 글이 가장 많은 동네"를 골라 그 위에서 셌다. 두 번 깨졌다.
 *   ① 사람이 화면에서 글을 지우자 개수 단언이 무너졌다.
 *   ② jest가 파일을 병렬로 돌리는데 옆 스위트가 심는 글이 세는 도중에 끼어들었다.
 * 그래서 **매번 새 법정동 코드와 아무도 안 사는 좌표**를 만들어 거기에만 심는다.
 * 개수를 정확히 단언할 수 있고, 몇 번을 돌려도 서로 안 밟는다.
 */

/** 실제 법정동 코드와 겹치지 않는 10자리(진짜 코드는 1·2·3…으로 시작한다). */
const TEST_REGION_CODE = `99${Date.now().toString().slice(-8)}`;
const TEST_DONG_NAME = '[통합테스트] 시험동';

/** 태평양 어딘가. 실제 글이 없어 반경 검색이 이 스위트의 글만 잡는다. */
const ORIGIN = { lat: 30 + Math.random() * 5, lng: 150 + Math.random() * 5 };

/** 원점에서 북쪽으로 대략 `meters`만큼. 위도 1도가 약 111km다. */
function northOf(meters: number) {
  return { lat: ORIGIN.lat + meters / 111000, lng: ORIGIN.lng };
}

type SeedSpec = {
  title: string;
  price: number;
  viewCount: number;
  offsetM: number;
};

/** 정렬·필터를 가르려면 값이 서로 달라야 한다. 일부러 겹치지 않게 잡았다. */
const SEED: ReadonlyArray<SeedSpec> = [
  { title: '자전거', price: 90000, viewCount: 12, offsetM: 100 },
  { title: '전자레인지', price: 30000, viewCount: 71, offsetM: 400 },
  { title: '커피 그라인더 나눔', price: 0, viewCount: 33, offsetM: 900 },
  { title: '유모차', price: 120000, viewCount: 5, offsetM: 1500 },
  { title: '무선 청소기', price: 150000, viewCount: 48, offsetM: 2400 },
];

let fixture: Fixture;
let seller: FixtureUser;
let buyer: FixtureUser;
/** 거래완료로 만든 글. "거래가능만"이 걸러야 하는 하나다. */
let soldPostId: number;

function regionArea() {
  return { kind: 'region' as const, regionCode: TEST_REGION_CODE };
}

function radiusArea(radiusM: number) {
  return { kind: 'radius' as const, coords: ORIGIN, radiusM };
}

beforeAll(async function seed() {
  fixture = createFixture();

  seller = await createTestUser(fixture, {
    nickname: '판매자',
    regionCode: TEST_REGION_CODE,
    dongName: TEST_DONG_NAME,
    lat: ORIGIN.lat,
    lng: ORIGIN.lng,
  });
  buyer = await createTestUser(fixture, {
    nickname: '구매자',
    regionCode: TEST_REGION_CODE,
    dongName: TEST_DONG_NAME,
    lat: ORIGIN.lat,
    lng: ORIGIN.lng,
  });

  const postIds: number[] = [];

  for (const spec of SEED) {
    const coords = northOf(spec.offsetM);
    const postId = await createTestPost(fixture, {
      sellerId: seller.id,
      title: spec.title,
      description: `${spec.title} 팝니다. 상태 좋습니다.`,
      price: spec.price,
      regionCode: TEST_REGION_CODE,
      dongName: TEST_DONG_NAME,
      lat: coords.lat,
      lng: coords.lng,
    });

    postIds.push(postId);
    await getAdminClient().from('posts').update({ view_count: spec.viewCount }).eq('id', postId);
  }

  // 찜을 서로 다르게 붙여 "찜 많은 순"을 가를 수 있게 한다.
  await getAdminClient()
    .from('likes')
    .insert([
      { post_id: postIds[1], user_id: buyer.id },
      { post_id: postIds[3], user_id: buyer.id },
    ]);

  // 마지막 글은 거래완료로. 채팅방이 먼저 있어야 구매자를 고를 수 있다(0035).
  soldPostId = postIds[postIds.length - 1];
  await createTestChatRoom({ postId: soldPostId, buyerId: buyer.id, sellerId: seller.id });
  await getAdminClient()
    .from('posts')
    .update({ status: 'sold', buyer_id: buyer.id })
    .eq('id', soldPostId);
}, 120000);

afterAll(async function clean() {
  await fixture.cleanup();
}, 60000);

describe('동네 목록', function neighborhoodList() {
  it('그 동네 글이 전부, 그 동네 글만 온다', async function onlyThatRegion() {
    const posts = await fetchNeighborhoodPosts(TEST_REGION_CODE, null);

    expect(posts.length).toBe(SEED.length);
    for (const post of posts) {
      expect(post.dongName).toBe(TEST_DONG_NAME);
    }
  });

  it('기본 정렬은 끌올 최신순이다', async function bumpedDesc() {
    const posts = await fetchNeighborhoodPosts(TEST_REGION_CODE, null);
    const bumpedAt = posts.map(function toBumped(post: PostSummary) {
      return post.bumpedAt;
    });

    expect(bumpedAt).toEqual([...bumpedAt].sort().reverse());
  });

  it('없는 동네 코드는 빈 목록이다 (오류가 아니다)', async function unknownRegion() {
    expect(await fetchNeighborhoodPosts('0000000000', null)).toEqual([]);
  });
});

describe('검색어', function keyword() {
  it('제목에 있는 말로 찾는다', async function matchesTitle() {
    const found = await searchPosts({
      area: regionArea(),
      filters: { ...EMPTY_POST_SEARCH_FILTERS, keyword: '청소기' },
      sort: 'latest',
      cursor: null,
    });

    expect(found.length).toBe(1);
    expect(found[0].title).toContain('청소기');
  });

  it('설명에 있는 말로도 찾는다', async function matchesDescription() {
    const found = await searchPosts({
      area: regionArea(),
      filters: { ...EMPTY_POST_SEARCH_FILTERS, keyword: '상태 좋습니다' },
      sort: 'latest',
      cursor: null,
    });

    // 제목에는 없고 설명에만 있는 문구다.
    expect(found.length).toBe(SEED.length);
  });

  it('없는 말은 빈 목록이다', async function noMatch() {
    const found = await searchPosts({
      area: regionArea(),
      filters: { ...EMPTY_POST_SEARCH_FILTERS, keyword: '냉장고' },
      sort: 'latest',
      cursor: null,
    });

    expect(found).toEqual([]);
  });

  it('쉼표·괄호·와일드카드가 들어와도 깨지지 않는다', async function specialCharacters() {
    // PostgREST의 .or() 문자열이었다면 여기서 문법이 깨진다. RPC라 값으로 바인딩된다(0007).
    for (const keyword of ['a,b(c)', '%', '_', "'; drop table posts; --"]) {
      const found = await searchPosts({
        area: regionArea(),
        filters: { ...EMPTY_POST_SEARCH_FILTERS, keyword },
        sort: 'latest',
        cursor: null,
      });

      // `%`와 `_`는 LIKE의 와일드카드다. 새어 나가면 전부가 걸린다.
      expect(found).toEqual([]);
    }
  });
});

describe('필터', function filters() {
  it('거래가능만 켜면 거래완료가 빠진다', async function availableOnly() {
    const found = await searchPosts({
      area: regionArea(),
      filters: { ...EMPTY_POST_SEARCH_FILTERS, availableOnly: true },
      sort: 'latest',
      cursor: null,
    });

    expect(found.length).toBe(SEED.length - 1);
    expect(found.map(function toId(post: PostSummary) {
      return post.id;
    })).not.toContain(soldPostId);
  });

  it('가격 범위로 거른다', async function priceRange() {
    const found = await searchPosts({
      area: regionArea(),
      filters: { ...EMPTY_POST_SEARCH_FILTERS, minPrice: 30000, maxPrice: 120000 },
      sort: 'latest',
      cursor: null,
    });

    // 0원(나눔)과 150000원이 빠진다.
    expect(found.length).toBe(3);
    for (const post of found) {
      expect(post.price).toBeGreaterThanOrEqual(30000);
      expect(post.price).toBeLessThanOrEqual(120000);
    }
  });

  it('0원 나눔은 하한을 안 걸었을 때 남는다', async function freeItemStays() {
    const found = await searchPosts({
      area: regionArea(),
      filters: { ...EMPTY_POST_SEARCH_FILTERS, maxPrice: 0 },
      sort: 'latest',
      cursor: null,
    });

    expect(found.length).toBe(1);
    expect(found[0].price).toBe(0);
  });
});

describe('정렬', function sorting() {
  it('가격 낮은 순', async function priceAsc() {
    const posts = await searchPosts({
      area: regionArea(),
      filters: EMPTY_POST_SEARCH_FILTERS,
      sort: 'price_asc',
      cursor: null,
    });

    expect(posts.map(function toPrice(post: PostSummary) {
      return post.price;
    })).toEqual([0, 30000, 90000, 120000, 150000]);
  });

  it('가격 높은 순', async function priceDesc() {
    const posts = await searchPosts({
      area: regionArea(),
      filters: EMPTY_POST_SEARCH_FILTERS,
      sort: 'price_desc',
      cursor: null,
    });

    expect(posts.map(function toPrice(post: PostSummary) {
      return post.price;
    })).toEqual([150000, 120000, 90000, 30000, 0]);
  });

  it('인기순은 조회수 내림차순', async function popularDesc() {
    const posts = await searchPosts({
      area: regionArea(),
      filters: EMPTY_POST_SEARCH_FILTERS,
      sort: 'popular',
      cursor: null,
    });

    expect(posts.map(function toViewCount(post: PostSummary) {
      return post.viewCount;
    })).toEqual([71, 48, 33, 12, 5]);
  });

  it('찜 많은 순', async function likesDesc() {
    const posts = await searchPosts({
      area: regionArea(),
      filters: EMPTY_POST_SEARCH_FILTERS,
      sort: 'likes',
      cursor: null,
    });

    const likes = posts.map(function toLikeCount(post: PostSummary) {
      return post.likeCount;
    });
    expect(likes).toEqual([1, 1, 0, 0, 0]);
  });
});

describe('반경 기준', function radius() {
  it('반경 안에 드는 글만 온다', async function withinRadius() {
    const near = await searchPosts({
      area: radiusArea(1000),
      filters: EMPTY_POST_SEARCH_FILTERS,
      sort: 'latest',
      cursor: null,
    });

    // 100m · 400m · 900m 셋만 든다.
    expect(near.length).toBe(3);
  });

  it('반경을 넓히면 나머지도 들어온다', async function widerIncludesMore() {
    const far = await searchPosts({
      area: radiusArea(5000),
      filters: EMPTY_POST_SEARCH_FILTERS,
      sort: 'latest',
      cursor: null,
    });

    expect(far.length).toBe(SEED.length);
  });

  it('거리순은 가까운 것부터이고 거리가 함께 온다', async function distanceSort() {
    const posts = await searchPosts({
      area: radiusArea(5000),
      filters: EMPTY_POST_SEARCH_FILTERS,
      sort: 'distance',
      cursor: null,
    });

    const distances = posts.map(function toDistance(post: PostSummary) {
      return post.distanceM ?? -1;
    });

    expect(distances).toEqual([...distances].sort(function ascending(a, b) {
      return a - b;
    }));
    // 심어 둔 간격(100m·400m·900m·1500m·2400m)과 대체로 맞아야 한다.
    expect(distances[0]).toBeLessThan(200);
    expect(distances[distances.length - 1]).toBeGreaterThan(2000);
  });

  it('거리순은 동네 기준으로 고를 수 없다 — 잴 중심이 없다', async function distanceNeedsCenter() {
    await expect(
      searchPosts({
        area: regionArea(),
        filters: EMPTY_POST_SEARCH_FILTERS,
        sort: 'distance',
        cursor: null,
      }),
    ).rejects.toBeDefined();
  });
});

describe('페이징', function paging() {
  it('커서로 이어 받으면 겹치지 않고 이어진다', async function cursorContinues() {
    const all = await searchPosts({
      area: regionArea(),
      filters: EMPTY_POST_SEARCH_FILTERS,
      sort: 'price_asc',
      cursor: null,
    });

    const third = all[2];
    const next = await searchPosts({
      area: regionArea(),
      filters: EMPTY_POST_SEARCH_FILTERS,
      sort: 'price_asc',
      cursor: { value: String(third.price), id: third.id },
    });

    const nextIds = next.map(function toId(post: PostSummary) {
      return post.id;
    });

    // 커서로 준 글까지는 이미 받은 것이므로 다시 오면 안 된다.
    expect(nextIds).not.toContain(third.id);
    expect(nextIds).toEqual(all.slice(3).map(function toId(post: PostSummary) {
      return post.id;
    }));
  });
});
