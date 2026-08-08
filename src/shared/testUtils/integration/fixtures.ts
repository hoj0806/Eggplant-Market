import { getAdminClient } from './supabaseAdminClient';

/**
 * 테스트가 심는 데이터. **심은 것만 치운다.**
 *
 * 사람이 화면에서 만든 글과 섞이므로 "전부 지우기"는 쓸 수 없다 — 남의 데이터를 지우는
 * 테스트는 한 번 돌리는 순간 신뢰를 잃는다. 그래서 `Fixture`가 자기가 만든 id만 들고 있다가
 * 역순으로 되돌린다.
 *
 * 사용자를 지우면 `profiles`부터 글·댓글·채팅까지 cascade로 함께 사라진다(`0001`).
 * 그래서 치우는 일은 대개 사용자 삭제 한 번으로 끝난다 — 회원탈퇴가 기대는 바로 그 길이다.
 */

/** 테스트가 만든 것임을 한눈에 알리는 표. 사람이 만든 데이터와 섞였을 때 구별한다. */
export const FIXTURE_TAG = '[통합테스트]';

export type FixtureUser = {
  id: string;
  nickname: string;
};

export type Fixture = {
  users: FixtureUser[];
  postIds: number[];
  cleanup(): Promise<void>;
};

type CreateUserOptions = {
  nickname: string;
  regionCode: string;
  dongName: string;
  lat: number;
  lng: number;
  searchRadiusM?: number;
};

export function createFixture(): Fixture {
  const users: FixtureUser[] = [];
  const postIds: number[] = [];

  return {
    users,
    postIds,
    async cleanup(): Promise<void> {
      const admin = getAdminClient();

      // 글부터 지운다. 사용자 삭제가 cascade로 데려가지만, 남의 글에 달린
      // 우리 댓글·찜처럼 사용자에 안 매달린 것이 남을 수 있어 순서를 지킨다.
      if (postIds.length > 0) {
        await admin.from('posts').delete().in('id', postIds);
      }

      for (const user of users) {
        await admin.auth.admin.deleteUser(user.id);
      }

      users.length = 0;
      postIds.length = 0;
    },
  };
}

/**
 * 온보딩까지 끝난 사용자를 만든다.
 *
 * `auth.admin.createUser`는 Email 프로바이더가 꺼져 있어도 통한다 — 그 스위치가 막는 것은
 * **공개 가입 경로**이지 관리자 API가 아니다. 이 계정으로 로그인할 일은 없다.
 * 확인은 익명 클라이언트가 하고, 이 사용자는 데이터의 주인 노릇만 한다.
 */
export async function createTestUser(
  fixture: Fixture,
  options: CreateUserOptions,
): Promise<FixtureUser> {
  const admin = getAdminClient();
  const suffix = Math.random().toString(36).slice(2, 10);

  const { data, error } = await admin.auth.admin.createUser({
    email: `int-test-${suffix}@eggplant.test`,
    password: `test-${suffix}-${Date.now()}`,
    email_confirm: true,
  });

  if (error !== null) {
    throw error;
  }

  const userId = data.user.id;

  // handle_new_user 트리거가 profiles 행을 이미 만들었다. 온보딩만 채운다.
  const { error: profileError } = await admin
    .from('profiles')
    .update({
      nickname: `${options.nickname}-${suffix.slice(0, 4)}`,
      region_code: options.regionCode,
      dong_name: options.dongName,
      location: `SRID=4326;POINT(${options.lng} ${options.lat})`,
      search_radius_m: options.searchRadiusM ?? 2000,
      onboarded_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (profileError !== null) {
    throw profileError;
  }

  const user: FixtureUser = { id: userId, nickname: options.nickname };
  fixture.users.push(user);

  return user;
}

type CreatePostOptions = {
  sellerId: string;
  title: string;
  description?: string;
  price?: number;
  regionCode: string;
  dongName: string;
  lat: number;
  lng: number;
  categoryId?: number | null;
};

export async function createTestPost(
  fixture: Fixture,
  options: CreatePostOptions,
): Promise<number> {
  const admin = getAdminClient();

  const { data, error } = await admin
    .from('posts')
    .insert({
      seller_id: options.sellerId,
      title: `${FIXTURE_TAG} ${options.title}`,
      description: options.description ?? '통합 테스트가 만든 글입니다.',
      price: options.price ?? 10000,
      category_id: options.categoryId ?? null,
      region_code: options.regionCode,
      dong_name: options.dongName,
      location: `SRID=4326;POINT(${options.lng} ${options.lat})`,
    })
    .select('id')
    .single();

  if (error !== null) {
    throw error;
  }

  const postId = (data as { id: number }).id;
  fixture.postIds.push(postId);

  return postId;
}

export async function createTestComment(options: {
  postId: number;
  authorId: string;
  content: string;
  isSecret?: boolean;
  parentId?: number | null;
}): Promise<number> {
  const admin = getAdminClient();

  const { data, error } = await admin
    .from('comments')
    .insert({
      post_id: options.postId,
      author_id: options.authorId,
      content: options.content,
      is_secret: options.isSecret ?? false,
      parent_id: options.parentId ?? null,
    })
    .select('id')
    .single();

  if (error !== null) {
    throw error;
  }

  return (data as { id: number }).id;
}

/** 채팅방. 거래 상대를 고르려면 이것이 먼저 있어야 한다(`guard_post_buyer`). */
export async function createTestChatRoom(options: {
  postId: number;
  buyerId: string;
  sellerId: string;
}): Promise<number> {
  const admin = getAdminClient();

  const { data, error } = await admin
    .from('chat_rooms')
    .insert({
      post_id: options.postId,
      buyer_id: options.buyerId,
      seller_id: options.sellerId,
    })
    .select('id')
    .single();

  if (error !== null) {
    throw error;
  }

  return (data as { id: number }).id;
}
