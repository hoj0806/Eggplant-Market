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
 * DB가 스스로 지키는 규칙들 — 트리거와 제약.
 *
 * **화면을 거치지 않고 확인한다.** 여기 걸린 규칙은 앱이 안 물어봐도 지켜져야 하는 것들이라,
 * 오히려 앱을 빼고 확인하는 편이 맞다. 서비스 키로 넣어도 트리거는 그대로 돈다 —
 * RLS만 지나갈 뿐이다.
 *
 * 집계 컬럼(`like_count`·`comment_count`)과 매너온도는 **직접 쓰지 않고 트리거가 유지한다.**
 * 그 약속이 깨지면 화면은 조용히 틀린 숫자를 보여 준다 — 오류가 안 나므로 눈으로는 못 잡는다.
 */

const REGION = {
  code: '1123011000',
  dong: '서울 동대문구 이문동',
  lat: 37.6004,
  lng: 127.0664,
};

let fixture: Fixture;
let seller: FixtureUser;
let buyer: FixtureUser;

async function newPost(title: string): Promise<number> {
  return createTestPost(fixture, {
    sellerId: seller.id,
    title,
    regionCode: REGION.code,
    dongName: REGION.dong,
    lat: REGION.lat,
    lng: REGION.lng,
  });
}

async function readPost(postId: number) {
  const { data, error } = await getAdminClient()
    .from('posts')
    .select('status, buyer_id, sold_at, like_count, comment_count')
    .eq('id', postId)
    .single();

  if (error !== null) {
    throw error;
  }

  return data as {
    status: string;
    buyer_id: string | null;
    sold_at: string | null;
    like_count: number;
    comment_count: number;
  };
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

describe('찜 집계', function likeCount() {
  it('찜하면 오르고 취소하면 내린다', async function keepsCount() {
    const admin = getAdminClient();
    const postId = await newPost('찜 집계');

    expect((await readPost(postId)).like_count).toBe(0);

    await admin.from('likes').insert({ post_id: postId, user_id: buyer.id });
    expect((await readPost(postId)).like_count).toBe(1);

    await admin.from('likes').delete().eq('post_id', postId).eq('user_id', buyer.id);
    expect((await readPost(postId)).like_count).toBe(0);
  });

  // 여기 "자기 글은 찜할 수 없다"를 넣으려다 뺐다.
  //
  // 그 규칙(0006)은 **제약이 아니라 RLS 정책**이다 — 판매자가 누구인지는 posts에 있고
  // check 제약은 다른 테이블을 볼 수 없어서 그렇게 만들 수밖에 없었다(0006의 머리말).
  // 그래서 서비스 키로 넣으면 **정책을 지나가 버려 언제나 통과한다.** 처음에 제약인 줄 알고
  // `expect(error).not.toBeNull()`을 적었다가 빨개져서 알았다 — 앱이 아니라 테스트가 틀렸다.
  //
  // 제대로 보려면 **그 사용자로 로그인한 세션**이 있어야 하는데, 로그인을 소셜만으로 좁히면서
  // Email 프로바이더를 껐다(2026-08-08). `admin.createUser`로 계정은 만들어져도
  // `signInWithPassword`가 `Email logins are disabled`로 막힌다.
  //
  // 익명이 못 찜한다는 것은 `anonymousWriteGuards.int.test.ts`가 이미 지킨다.
  // 남은 구멍은 "로그인한 사람이 **자기** 글을 찜하는 경우" 하나다.
});

describe('댓글 집계', function commentCount() {
  it('공개 댓글만 센다', async function publicOnly() {
    const postId = await newPost('댓글 집계');

    await createTestComment({ postId, authorId: buyer.id, content: '공개 댓글' });
    expect((await readPost(postId)).comment_count).toBe(1);

    await createTestComment({
      postId,
      authorId: buyer.id,
      content: '비밀 댓글',
      isSecret: true,
    });
    // 비밀 댓글은 세지 않는다 — 세면 그 차이가 "여기 비밀 댓글이 있다"는 신호가 된다.
    expect((await readPost(postId)).comment_count).toBe(1);
  });

  it('지우면 다시 내려간다', async function decrementsOnDelete() {
    const admin = getAdminClient();
    const postId = await newPost('댓글 삭제 집계');

    const commentId = await createTestComment({
      postId,
      authorId: buyer.id,
      content: '지울 댓글',
    });
    expect((await readPost(postId)).comment_count).toBe(1);

    await admin.from('comments').delete().eq('id', commentId);
    expect((await readPost(postId)).comment_count).toBe(0);
  });

  it('부모를 지우면 답글도 함께 사라진다', async function cascadeReplies() {
    const admin = getAdminClient();
    const postId = await newPost('대댓글 cascade');

    const parentId = await createTestComment({
      postId,
      authorId: buyer.id,
      content: '부모 댓글',
    });
    await createTestComment({
      postId,
      authorId: seller.id,
      parentId,
      content: '답글',
    });
    expect((await readPost(postId)).comment_count).toBe(2);

    await admin.from('comments').delete().eq('id', parentId);

    const { data } = await admin.from('comments').select('id').eq('post_id', postId);
    expect((data ?? []).length).toBe(0);
    expect((await readPost(postId)).comment_count).toBe(0);
  });
});

describe('거래 상대', function tradePartner() {
  it('채팅을 나눈 적 없는 사람은 구매자로 고를 수 없다', async function needsChatRoom() {
    const postId = await newPost('거래 상대 가드');

    const { error } = await getAdminClient()
      .from('posts')
      .update({ status: 'reserved', buyer_id: buyer.id })
      .eq('id', postId);

    // 0035가 정책이 아니라 **트리거로** 막는 자리다. 서비스 키로도 넘지 못한다.
    expect(error).not.toBeNull();
  });

  it('만들 때 박아 넣는 것도 막힌다', async function guardsInsertToo() {
    const { error } = await getAdminClient().from('posts').insert({
      seller_id: seller.id,
      title: '[통합테스트] 구매자를 박아 넣은 글',
      description: '0035 이전에는 이 길이 열려 있었다.',
      price: 1000,
      status: 'sold',
      buyer_id: buyer.id,
      region_code: REGION.code,
      dong_name: REGION.dong,
    });

    // update만 막고 insert를 안 막던 것이 0035가 찾은 구멍이다.
    expect(error).not.toBeNull();
  });

  it('채팅방이 있으면 고를 수 있다', async function allowsChatPartner() {
    const postId = await newPost('정상 거래');
    await createTestChatRoom({ postId, buyerId: buyer.id, sellerId: seller.id });

    const { error } = await getAdminClient()
      .from('posts')
      .update({ status: 'reserved', buyer_id: buyer.id })
      .eq('id', postId);

    expect(error).toBeNull();
    expect((await readPost(postId)).buyer_id).toBe(buyer.id);
  });
});

describe('거래 상태 전이', function statusTransition() {
  it('거래완료로 가면 완료 시각이 저절로 찍힌다', async function stampsSoldAt() {
    const postId = await newPost('완료 시각');
    await createTestChatRoom({ postId, buyerId: buyer.id, sellerId: seller.id });

    await getAdminClient()
      .from('posts')
      .update({ status: 'sold', buyer_id: buyer.id })
      .eq('id', postId);

    const post = await readPost(postId);
    expect(post.status).toBe('sold');
    expect(post.sold_at).not.toBeNull();
  });

  it('거래완료는 되돌릴 수 없다', async function soldIsFinal() {
    const postId = await newPost('되돌리기 금지');
    await createTestChatRoom({ postId, buyerId: buyer.id, sellerId: seller.id });
    await getAdminClient()
      .from('posts')
      .update({ status: 'sold', buyer_id: buyer.id })
      .eq('id', postId);

    const { error } = await getAdminClient()
      .from('posts')
      .update({ status: 'selling' })
      .eq('id', postId);

    expect(error).not.toBeNull();
  });

  it('판매중으로 돌아오면 예약자가 지워진다', async function clearsBuyer() {
    const postId = await newPost('예약 취소');
    await createTestChatRoom({ postId, buyerId: buyer.id, sellerId: seller.id });
    await getAdminClient()
      .from('posts')
      .update({ status: 'reserved', buyer_id: buyer.id })
      .eq('id', postId);

    await getAdminClient().from('posts').update({ status: 'selling' }).eq('id', postId);

    // "판매중인데 예약자가 있는" 상태를 남기지 않는다.
    expect((await readPost(postId)).buyer_id).toBeNull();
  });
});
