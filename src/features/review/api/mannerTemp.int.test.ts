import { getAdminClient } from '../../../shared/testUtils/integration/supabaseAdminClient';
import {
  createFixture,
  createTestChatRoom,
  createTestComment,
  createTestPost,
  createTestUser,
} from '../../../shared/testUtils/integration/fixtures';
import type { Fixture, FixtureUser } from '../../../shared/testUtils/integration/fixtures';

/**
 * 매너온도와 알림 — **사람이 직접 쓰지 않고 사건에서 따라 나오는 값들.**
 *
 * 매너온도는 후기가 정한다. 그래서 확인할 것은 "올렸더니 올랐다"가 아니라
 * **후기를 넣었더니 저절로 맞는 값이 됐는가**이고, 후기를 지웠을 때 되돌아가는지까지다
 * (`0016` — 탈퇴가 cascade로 후기를 지우는데 재계산이 insert 전용이라 어긋났던 자리).
 */

const REGION = {
  code: '1123011000',
  dong: '서울 동대문구 이문동',
  lat: 37.6004,
  lng: 127.0664,
};

const BASE_TEMP = 36.5;

let fixture: Fixture;
let seller: FixtureUser;
let buyer: FixtureUser;

async function readTemp(userId: string): Promise<number> {
  const { data, error } = await getAdminClient()
    .from('profiles')
    .select('manner_temp')
    .eq('id', userId)
    .single();

  if (error !== null) {
    throw error;
  }

  return Number((data as { manner_temp: number | string }).manner_temp);
}

async function countNotifications(userId: string, type: string): Promise<number> {
  const { data, error } = await getAdminClient()
    .from('notifications')
    .select('id')
    .eq('user_id', userId)
    .eq('type', type);

  if (error !== null) {
    throw error;
  }

  return (data ?? []).length;
}

/** 후기를 쓸 수 있는 상태(거래완료된 글 + 채팅방)를 만든다. */
async function completedTrade(): Promise<number> {
  const postId = await createTestPost(fixture, {
    sellerId: seller.id,
    title: '거래 완료',
    regionCode: REGION.code,
    dongName: REGION.dong,
    lat: REGION.lat,
    lng: REGION.lng,
  });

  await createTestChatRoom({ postId, buyerId: buyer.id, sellerId: seller.id });
  await getAdminClient()
    .from('posts')
    .update({ status: 'sold', buyer_id: buyer.id })
    .eq('id', postId);

  return postId;
}

beforeAll(async function seed() {
  fixture = createFixture();

  seller = await createTestUser(fixture, {
    nickname: '판매자',
    regionCode: REGION.code,
    dongName: REGION.dong,
    lat: REGION.lat,
    lng: REGION.lng,
  });
  buyer = await createTestUser(fixture, {
    nickname: '구매자',
    regionCode: REGION.code,
    dongName: REGION.dong,
    lat: REGION.lat,
    lng: REGION.lng,
  });
}, 60000);

afterAll(async function clean() {
  await fixture.cleanup();
}, 60000);

describe('매너온도', function mannerTemp() {
  it('새 계정은 36.5에서 시작한다', async function startsAtBase() {
    expect(await readTemp(seller.id)).toBe(BASE_TEMP);
  });

  it('좋은 후기를 받으면 오른다', async function risesOnGoodReview() {
    const admin = getAdminClient();
    const postId = await completedTrade();

    const { error } = await admin.from('reviews').insert({
      post_id: postId,
      reviewer_id: buyer.id,
      reviewee_id: seller.id,
      score: 0.5,
      manner_tags: ['시간 약속을 잘 지켜요'],
    });

    expect(error).toBeNull();
    expect(await readTemp(seller.id)).toBeCloseTo(BASE_TEMP + 0.5, 5);
  });

  it('후기가 사라지면 되돌아간다', async function fallsBackOnDelete() {
    const admin = getAdminClient();
    const postId = await completedTrade();

    await admin.from('reviews').insert({
      post_id: postId,
      reviewer_id: buyer.id,
      reviewee_id: seller.id,
      score: 0.5,
      manner_tags: [],
    });
    const raised = await readTemp(seller.id);

    await admin.from('reviews').delete().eq('post_id', postId).eq('reviewer_id', buyer.id);

    // 0016이 닫은 자리다. 재계산이 insert에만 걸려 있으면 여기서 값이 그대로 남는다.
    expect(await readTemp(seller.id)).toBeCloseTo(raised - 0.5, 5);
  });

  it('점수는 정해진 셋 말고는 못 넣는다', async function boundedScore() {
    const postId = await completedTrade();

    const { error } = await getAdminClient().from('reviews').insert({
      post_id: postId,
      reviewer_id: buyer.id,
      reviewee_id: seller.id,
      score: -99,
      manner_tags: [],
    });

    // -99가 들어가면 남의 매너온도를 한 번에 0으로 만들 수 있다(0035의 머리말).
    expect(error).not.toBeNull();
  });

  it('한 거래에 후기는 한 번뿐이다', async function onePerTrade() {
    const admin = getAdminClient();
    const postId = await completedTrade();

    await admin.from('reviews').insert({
      post_id: postId,
      reviewer_id: buyer.id,
      reviewee_id: seller.id,
      score: 0.1,
      manner_tags: [],
    });

    const { error } = await admin.from('reviews').insert({
      post_id: postId,
      reviewer_id: buyer.id,
      reviewee_id: seller.id,
      score: 0.5,
      manner_tags: [],
    });

    expect(error).not.toBeNull();
  });

  it('오르내린 기록이 남는다', async function keepsHistory() {
    const admin = getAdminClient();
    const before = await admin
      .from('manner_temp_events')
      .select('id')
      .eq('user_id', seller.id);
    const beforeCount = (before.data ?? []).length;

    const postId = await completedTrade();
    await admin.from('reviews').insert({
      post_id: postId,
      reviewer_id: buyer.id,
      reviewee_id: seller.id,
      score: 0.1,
      manner_tags: [],
    });

    const after = await admin.from('manner_temp_events').select('id').eq('user_id', seller.id);
    expect((after.data ?? []).length).toBeGreaterThan(beforeCount);
  });
});

describe('알림', function notifications() {
  it('댓글이 달리면 판매자에게 간다', async function notifiesOnComment() {
    const before = await countNotifications(seller.id, 'comment');

    const postId = await createTestPost(fixture, {
      sellerId: seller.id,
      title: '알림 확인',
      regionCode: REGION.code,
      dongName: REGION.dong,
      lat: REGION.lat,
      lng: REGION.lng,
    });
    await createTestComment({ postId, authorId: buyer.id, content: '아직 있나요?' });

    expect(await countNotifications(seller.id, 'comment')).toBe(before + 1);
  });

  it('자기 글에 자기가 달면 알리지 않는다', async function noSelfNotification() {
    const postId = await createTestPost(fixture, {
      sellerId: seller.id,
      title: '자기 댓글',
      regionCode: REGION.code,
      dongName: REGION.dong,
      lat: REGION.lat,
      lng: REGION.lng,
    });

    const before = await countNotifications(seller.id, 'comment');
    await createTestComment({ postId, authorId: seller.id, content: '제가 씁니다' });

    expect(await countNotifications(seller.id, 'comment')).toBe(before);
  });

  it('후기를 받으면 알림이 온다', async function notifiesOnReview() {
    const before = await countNotifications(seller.id, 'review');
    const postId = await completedTrade();

    await getAdminClient().from('reviews').insert({
      post_id: postId,
      reviewer_id: buyer.id,
      reviewee_id: seller.id,
      score: 0.5,
      manner_tags: [],
    });

    expect(await countNotifications(seller.id, 'review')).toBe(before + 1);
  });

  it('알림을 끄면 오지 않는다', async function respectsPreference() {
    const admin = getAdminClient();
    await admin.from('profiles').update({ notify_comment: false }).eq('id', seller.id);

    const before = await countNotifications(seller.id, 'comment');
    const postId = await createTestPost(fixture, {
      sellerId: seller.id,
      title: '알림 끔',
      regionCode: REGION.code,
      dongName: REGION.dong,
      lat: REGION.lat,
      lng: REGION.lng,
    });
    await createTestComment({ postId, authorId: buyer.id, content: '알림이 오면 안 됩니다' });

    expect(await countNotifications(seller.id, 'comment')).toBe(before);

    await admin.from('profiles').update({ notify_comment: true }).eq('id', seller.id);
  });
});
