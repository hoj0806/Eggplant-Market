import { supabase } from '../../../shared/testUtils/integration/supabaseTestClient';
import { getAdminClient } from '../../../shared/testUtils/integration/supabaseAdminClient';
import {
  createFixture,
  createTestComment,
  createTestPost,
  createTestUser,
} from '../../../shared/testUtils/integration/fixtures';
import type { Fixture, FixtureUser } from '../../../shared/testUtils/integration/fixtures';

/**
 * 로그인하지 않은 사람이 무엇을 못 하는가 — **RLS를 켜 둔 채로** 확인한다.
 *
 * 읽기는 열려 있다(`posts_select`가 `using (true)`). 열려 있어야 하는 자리다 —
 * 로그인 전에도 동네 물건은 볼 수 있어야 하니까. 대신 **쓰기는 전부 막혀야** 하고,
 * 그것을 지키는 것은 앱이 아니라 정책이다. **화면에서 버튼을 감추는 것으로는 아무것도
 * 막지 못한다** — 여기서 확인하는 것이 정확히 그 차이다.
 *
 * 과녁은 직접 심는다. "DB에 아무 글이나 하나"를 쓰면 빈 DB에서 조용히 통과해 버려,
 * 아무것도 안 지키는 테스트가 초록으로 남는다.
 */

const REGION = { code: '1123011000', dong: '서울 동대문구 이문동', lat: 37.6004, lng: 127.0664 };
const INTRUDER = '00000000-0000-0000-0000-000000000001';

let fixture: Fixture;
let owner: FixtureUser;
let postId: number;
let commentId: number;

beforeAll(async function seed() {
  fixture = createFixture();

  owner = await createTestUser(fixture, {
    nickname: '주인',
    regionCode: REGION.code,
    dongName: REGION.dong,
    lat: REGION.lat,
    lng: REGION.lng,
  });

  postId = await createTestPost(fixture, {
    sellerId: owner.id,
    title: '남이 못 건드려야 하는 글',
    price: 12345,
    regionCode: REGION.code,
    dongName: REGION.dong,
    lat: REGION.lat,
    lng: REGION.lng,
  });

  commentId = await createTestComment({
    postId,
    authorId: owner.id,
    content: '남이 못 고쳐야 하는 댓글',
  });
}, 60000);

afterAll(async function clean() {
  await fixture.cleanup();
}, 60000);

describe('익명 읽기는 열려 있다', function anonymousReads() {
  it('글이 보인다', async function canReadPost() {
    const { data, error } = await supabase
      .from('posts')
      .select('id, title, price')
      .eq('id', postId)
      .single();

    expect(error).toBeNull();
    expect((data as { price: number }).price).toBe(12345);
  });

  it('프로필도 보인다 — 판매자를 알아야 카드를 그린다', async function canReadProfile() {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, nickname, manner_temp')
      .eq('id', owner.id)
      .single();

    expect(error).toBeNull();
    expect((data as { nickname: string }).nickname).toContain('주인');
  });
});

describe('익명 쓰기는 전부 막힌다', function anonymousWrites() {
  it('게시물을 만들 수 없다', async function cannotInsertPost() {
    const { error } = await supabase.from('posts').insert({
      seller_id: INTRUDER,
      title: '익명이 넣으면 안 되는 글',
      description: '이 행이 남으면 posts_insert 정책이 열린 것이다.',
      price: 1000,
    });

    expect(error).not.toBeNull();
  });

  it('남의 게시물을 고칠 수 없다', async function cannotUpdatePost() {
    await supabase.from('posts').update({ title: '가로챈 제목', price: 1 }).eq('id', postId);

    // 정책은 오류 대신 "고칠 행이 없다"로 답할 수도 있다. 결과로 확인한다.
    const { data } = await supabase.from('posts').select('price').eq('id', postId).single();
    expect((data as { price: number }).price).toBe(12345);
  });

  it('게시물을 지울 수 없다', async function cannotDeletePost() {
    await supabase.from('posts').delete().eq('id', postId);

    const { data } = await supabase.from('posts').select('id').eq('id', postId);
    expect((data ?? []).length).toBe(1);
  });

  it('댓글을 달 수 없다', async function cannotComment() {
    const { error } = await supabase
      .from('comments')
      .insert({ post_id: postId, author_id: INTRUDER, content: '익명 댓글' });

    expect(error).not.toBeNull();
  });

  it('남의 댓글을 고칠 수 없다', async function cannotEditComment() {
    await supabase.from('comments').update({ content: '가로챈 내용' }).eq('id', commentId);

    const { data } = await supabase
      .from('comments')
      .select('content')
      .eq('id', commentId)
      .single();
    expect((data as { content: string }).content).toBe('남이 못 고쳐야 하는 댓글');
  });

  it('찜할 수 없다', async function cannotLike() {
    const { error } = await supabase
      .from('likes')
      .insert({ post_id: postId, user_id: INTRUDER });

    expect(error).not.toBeNull();
  });

  it('찜 개수를 직접 올릴 수 없다', async function cannotForgeLikeCount() {
    await supabase.from('posts').update({ like_count: 999 }).eq('id', postId);

    const { data } = await supabase.from('posts').select('like_count').eq('id', postId).single();
    expect((data as { like_count: number }).like_count).toBe(0);
  });

  it('남의 프로필을 고칠 수 없다', async function cannotUpdateProfile() {
    await supabase.from('profiles').update({ nickname: '가로챈닉네임' }).eq('id', owner.id);

    const { data } = await supabase
      .from('profiles')
      .select('nickname')
      .eq('id', owner.id)
      .single();
    expect((data as { nickname: string }).nickname).toContain('주인');
  });

  it('매너온도를 직접 올릴 수 없다', async function cannotRaiseMannerTemp() {
    await supabase.from('profiles').update({ manner_temp: 99 }).eq('id', owner.id);

    const { data } = await supabase
      .from('profiles')
      .select('manner_temp')
      .eq('id', owner.id)
      .single();
    expect(Number((data as { manner_temp: number | string }).manner_temp)).toBe(36.5);
  });

  /**
   * `deleteAllNotifications`("모두 삭제")는 **조건이 사실상 없는 delete**를 보낸다
   * (`id is not null`은 언제나 참이다). 그 범위를 좁히는 것은 `notifications_delete`(0019)
   * 하나뿐이라, 정책이 흔들리면 **남의 알림까지 지워지는** 종류의 사고다.
   *
   * 그래서 여기서 두 가지를 함께 본다.
   * 1. 조건 없는 delete를 PostgREST가 **오류 없이 받는다**(받지 않으면 화면이 조용히 실패한다)
   * 2. 그럼에도 **한 줄도 안 지워진다**(세션이 없으면 `auth.uid()`가 null이다)
   */
  it('조건 없는 delete를 보내도 남의 알림이 안 지워진다', async function cannotWipeNotifications() {
    const admin = getAdminClient();
    const seeded = await admin
      .from('notifications')
      .insert({ user_id: owner.id, type: 'like', payload: { post_id: postId } })
      .select('id')
      .single();

    expect(seeded.error).toBeNull();

    const { error } = await supabase.from('notifications').delete().not('id', 'is', null);

    // RLS의 delete는 지울 수 없는 행을 조용히 건너뛴다 — 0건 삭제도 성공이다.
    expect(error).toBeNull();

    const remaining = await admin
      .from('notifications')
      .select('id')
      .eq('user_id', owner.id);
    expect((remaining.data ?? []).length).toBe(1);
  });

  it('후기를 지어낼 수 없다', async function cannotForgeReview() {
    const { error } = await supabase.from('reviews').insert({
      post_id: postId,
      reviewer_id: INTRUDER,
      reviewee_id: owner.id,
      score: -0.5,
      manner_tags: [],
    });

    expect(error).not.toBeNull();
  });
});

describe('익명에게 안 보이는 것', function hiddenFromAnonymous() {
  it('남의 채팅방', async function noChatRooms() {
    const { data, error } = await supabase.from('chat_rooms').select('id');

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('남의 메시지', async function noMessages() {
    const { data, error } = await supabase.from('messages').select('id');

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('남의 알림', async function noNotifications() {
    const { data, error } = await supabase.from('notifications').select('id');

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('신고 내역 — select 정책 자체가 없다', async function noReports() {
    const { data, error } = await supabase.from('reports').select('id');

    expect(error !== null || (data ?? []).length === 0).toBe(true);
  });

  it('남의 최근 본 글', async function noRecentlyViewed() {
    const { data, error } = await supabase.from('recently_viewed').select('post_id');

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});
