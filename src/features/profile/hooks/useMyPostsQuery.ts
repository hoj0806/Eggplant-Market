import {
  useInfiniteQuery,
  type InfiniteData,
  type UseInfiniteQueryResult,
} from '@tanstack/react-query';
import { fetchMyPosts } from '../api/myPostsApi';
import { toNextMyPostCursor } from '../utils/myPostCursor';
import type { MyListKind, MyPostCursor, MyPostSummary, SellingStatusFilter } from '../types';

const MY_POSTS_STALE_TIME_MS = 30_000;

export type MyPostsQueryResult = UseInfiniteQueryResult<InfiniteData<MyPostSummary[]>, Error>;

/**
 * 사용자까지 키에 넣는다. 넣지 않으면 로그아웃하고 다른 계정으로 들어왔을 때
 * 앞사람의 찜 목록이 잠깐 그대로 보인다(postDetailQueryKey와 같은 이유).
 */
export function myPostsQueryKey(
  kind: MyListKind,
  statusFilter: SellingStatusFilter,
  userId: string | null,
): ReadonlyArray<string> {
  return ['my', kind, statusFilter ?? 'all', userId ?? 'anonymous'];
}

/**
 * 마이페이지 목록 넷을 한 훅으로 덮는다.
 *
 * 네 RPC가 같은 모양을 돌려주므로(0009) 달라지는 것은 `kind`와 판매관리의 상태 필터뿐이다.
 * 로그인하지 않았으면 요청하지 않는다 — 서버가 auth.uid()로 판단하므로 빈 목록만 돌아온다.
 */
export function useMyPostsQuery(
  kind: MyListKind,
  userId: string | null,
  statusFilter: SellingStatusFilter = null,
): MyPostsQueryResult {
  return useInfiniteQuery<MyPostSummary[], Error, InfiniteData<MyPostSummary[]>>({
    queryKey: myPostsQueryKey(kind, statusFilter, userId),
    queryFn: function loadPage({ pageParam }): Promise<MyPostSummary[]> {
      return fetchMyPosts({
        kind,
        statusFilter,
        cursor: (pageParam as MyPostCursor | null) ?? null,
      });
    },
    initialPageParam: null,
    getNextPageParam: toNextMyPostCursor,
    enabled: userId !== null,
    staleTime: MY_POSTS_STALE_TIME_MS,
  });
}
