import { supabase } from '../../../shared/lib/supabaseClient';
import type { PostStatus } from '../../post/types';
import type { MyListKind, MyPostCursor, MyPostSummary, SellingStatusFilter } from '../types';

/** 한 페이지 크기. 서버(0009)가 50으로 한 번 더 막는다. */
export const MY_POSTS_PAGE_SIZE = 20;

/**
 * 목록 종류 → RPC 이름.
 *
 * 네 RPC가 같은 컬럼을 돌려주도록 0009에서 맞춰 두었다. 그래서 부르는 함수 이름만 갈리고
 * 행 변환·커서·화면은 한 벌로 끝난다.
 */
const RPC_BY_KIND: Record<MyListKind, string> = {
  likes: 'fetch_liked_posts',
  recent: 'fetch_recently_viewed_posts',
  purchases: 'fetch_purchased_posts',
  sales: 'fetch_selling_posts',
};

/**
 * 목록 RPC가 돌려주는 한 행.
 *
 * 0009의 네 RPC가 이 모양을 공유하기로 한 약속이고, 0012의 `fetch_user_posts`(남의 프로필에서
 * 보는 판매 목록)도 같은 모양으로 맞췄다. 그래서 행 변환은 저장소 전체에 이것 하나뿐이다.
 */
export type MyPostRow = {
  id: number;
  title: string;
  price: number;
  status: PostStatus;
  thumbnail_url: string | null;
  dong_name: string | null;
  like_count: number;
  view_count: number;
  bumped_at: string;
  sort_at: string;
};

export type FetchMyPostsParams = {
  kind: MyListKind;
  /** 판매관리 전용. 그 밖의 목록에서는 언제나 null이다. */
  statusFilter: SellingStatusFilter;
  /** 첫 페이지는 null. */
  cursor: MyPostCursor | null;
};

export function toMyPostSummary(row: MyPostRow): MyPostSummary {
  return {
    id: row.id,
    title: row.title,
    price: row.price,
    status: row.status,
    thumbnailUrl: row.thumbnail_url,
    dongName: row.dong_name,
    likeCount: row.like_count,
    viewCount: row.view_count,
    bumpedAt: row.bumped_at,
    // 이 목록들은 거리를 재지 않는다. 기준이 "내가 남긴 흔적"이지 위치가 아니다(0024).
    distanceM: null,
    sortAt: row.sort_at,
  };
}

/**
 * 상태 필터는 판매관리에만 있다.
 *
 * 다른 세 RPC에는 p_status 파라미터 자체가 없어서, 넘기면 PostgREST가
 * "함수를 찾을 수 없다"(PGRST202)로 거절한다. 그래서 종류를 보고 붙일지 정한다.
 */
function toStatusParam(params: FetchMyPostsParams): { p_status: PostStatus | null } | undefined {
  if (params.kind !== 'sales') {
    return undefined;
  }

  return { p_status: params.statusFilter };
}

/**
 * 마이페이지 목록 한 페이지.
 *
 * 누구의 목록인지는 보내지 않는다 — RPC가 auth.uid()로 직접 판단한다.
 * 클라이언트가 남의 id를 실어 보낼 여지를 아예 두지 않기 위해서다.
 */
export async function fetchMyPosts(params: FetchMyPostsParams): Promise<MyPostSummary[]> {
  const { data, error } = await supabase.rpc(RPC_BY_KIND[params.kind], {
    ...toStatusParam(params),
    p_cursor_at: params.cursor?.sortAt ?? null,
    p_cursor_id: params.cursor?.id ?? null,
    p_limit: MY_POSTS_PAGE_SIZE,
  });

  if (error !== null) {
    throw error;
  }

  return (data as MyPostRow[]).map(toMyPostSummary);
}
