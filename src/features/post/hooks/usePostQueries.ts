import {
  useInfiniteQuery,
  useQuery,
  type UseInfiniteQueryResult,
  type InfiniteData,
  type UseQueryResult,
} from '@tanstack/react-query';
import {
  fetchNeighborhoodPosts,
  fetchPostDetail,
  searchPosts,
  type PostSearchCursor,
} from '../api/postApi';
import { toNextPostSearchCursor } from '../utils/postSearchCursor';
import type { PostSearchFilters } from '../../browse/types';
import type { PostDetail, PostSummary } from '../types';

const POST_DETAIL_STALE_TIME_MS = 30_000;
const POST_LIST_STALE_TIME_MS = 30_000;

export type PostSearchQueryResult = UseInfiniteQueryResult<InfiniteData<PostSummary[]>, Error>;

/**
 * 찜 여부가 보는 사람마다 다르므로 키에 사용자도 넣는다.
 * 넣지 않으면 로그아웃 후에도 남의 찜 상태가 그대로 보인다.
 */
export function postDetailQueryKey(
  postId: number,
  viewerId: string | null,
): ReadonlyArray<string | number> {
  return ['post', postId, viewerId ?? 'anonymous'];
}

export function neighborhoodPostsQueryKey(regionCode: string): ReadonlyArray<string> {
  return ['posts', 'neighborhood', regionCode];
}

/**
 * 필터가 하나라도 바뀌면 다른 목록이므로 키가 달라져야 한다.
 * 객체를 그대로 넣는다 — TanStack Query는 키를 구조적으로 비교하므로 직렬화할 필요가 없다.
 */
export function postSearchQueryKey(
  regionCode: string,
  filters: PostSearchFilters,
): ReadonlyArray<string | PostSearchFilters> {
  return ['posts', 'search', regionCode, filters];
}

/**
 * 검색·필터 결과. 무한 스크롤이라 페이지 단위로 쌓인다.
 *
 * 동네를 아직 정하지 않았으면(regionCode가 null) 요청하지 않는다 —
 * 검색은 언제나 내 동네 안에서만 돌기 때문이다.
 */
export function useSearchPostsQuery(
  regionCode: string | null,
  filters: PostSearchFilters,
): PostSearchQueryResult {
  return useInfiniteQuery<PostSummary[], Error, InfiniteData<PostSummary[]>>({
    queryKey: postSearchQueryKey(regionCode ?? 'nowhere', filters),
    queryFn: function loadPage({ pageParam }): Promise<PostSummary[]> {
      if (regionCode === null) {
        return Promise.reject(new Error('동네를 먼저 설정해 주세요.'));
      }
      return searchPosts({
        regionCode,
        filters,
        cursor: (pageParam as PostSearchCursor | null) ?? null,
      });
    },
    initialPageParam: null,
    getNextPageParam: toNextPostSearchCursor,
    enabled: regionCode !== null,
    staleTime: POST_LIST_STALE_TIME_MS,
  });
}

export function usePostDetailQuery(
  postId: number | null,
  viewerId: string | null,
): UseQueryResult<PostDetail, Error> {
  return useQuery<PostDetail, Error>({
    queryKey: postDetailQueryKey(postId ?? 0, viewerId),
    queryFn: function loadPost(): Promise<PostDetail> {
      if (postId === null) {
        return Promise.reject(new Error('게시물 번호가 올바르지 않습니다.'));
      }
      return fetchPostDetail(postId, viewerId);
    },
    enabled: postId !== null,
    staleTime: POST_DETAIL_STALE_TIME_MS,
  });
}

/** 동네를 아직 정하지 않았으면(regionCode가 null) 요청하지 않는다. */
export function useNeighborhoodPostsQuery(
  regionCode: string | null,
): UseQueryResult<PostSummary[], Error> {
  return useQuery<PostSummary[], Error>({
    queryKey: neighborhoodPostsQueryKey(regionCode ?? 'nowhere'),
    queryFn: function loadPosts(): Promise<PostSummary[]> {
      if (regionCode === null) {
        return Promise.reject(new Error('동네를 먼저 설정해 주세요.'));
      }
      return fetchNeighborhoodPosts(regionCode);
    },
    enabled: regionCode !== null,
    staleTime: POST_LIST_STALE_TIME_MS,
  });
}
