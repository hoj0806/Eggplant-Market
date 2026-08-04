import { supabase } from '../../../shared/lib/supabaseClient';
import { MY_POSTS_PAGE_SIZE, toMyPostSummary, type MyPostRow } from './myPostsApi';
import type { MyPostCursor, MyPostSummary, UserProfile } from '../types';

type UserProfileRow = {
  id: string;
  nickname: string;
  avatar_url: string | null;
  manner_temp: number | string;
  dong_name: string | null;
  created_at: string;
  selling_count: number;
  sold_count: number;
  review_count: number;
};

/** numeric 컬럼(manner_temp)은 정밀도 손실을 막으려고 문자열로 오기도 한다(profileApi와 같다). */
function toUserProfile(row: UserProfileRow): UserProfile {
  return {
    id: row.id,
    nickname: row.nickname,
    avatarUrl: row.avatar_url,
    mannerTemp: Number(row.manner_temp),
    dongName: row.dong_name,
    createdAt: row.created_at,
    sellingCount: row.selling_count,
    soldCount: row.sold_count,
    reviewCount: row.review_count,
  };
}

/**
 * 남의 프로필 머리말.
 *
 * `profiles`를 직접 select해도 읽히지만(RLS가 공개 조회다) RPC를 쓴다. 개수 셋 때문이다 —
 * 판매중·거래완료·받은 후기를 목록에서 세면 첫 페이지(20건)까지만 세게 되어 숫자가 거짓말을 한다.
 */
export async function fetchUserProfile(userId: string): Promise<UserProfile> {
  const { data, error } = await supabase.rpc('fetch_user_profile', { p_user_id: userId });

  if (error !== null) {
    throw error;
  }

  const rows = data as UserProfileRow[];
  if (rows.length === 0) {
    throw new Error('사용자를 찾을 수 없습니다.');
  }

  return toUserProfile(rows[0]);
}

/**
 * 그 사람이 팔고 있는 물건 한 페이지.
 *
 * 반환 모양이 마이페이지 목록과 같아서(0012) 행 변환도 커서도 그대로 쓴다.
 * 거래완료된 글은 서버가 이미 뺐다 — 여기서 거를 것이 없다.
 */
export async function fetchUserPosts(
  userId: string,
  cursor: MyPostCursor | null,
): Promise<MyPostSummary[]> {
  const { data, error } = await supabase.rpc('fetch_user_posts', {
    p_user_id: userId,
    p_cursor_at: cursor?.sortAt ?? null,
    p_cursor_id: cursor?.id ?? null,
    p_limit: MY_POSTS_PAGE_SIZE,
  });

  if (error !== null) {
    throw error;
  }

  return (data as MyPostRow[]).map(toMyPostSummary);
}
