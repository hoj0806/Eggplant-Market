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
import { DEFAULT_POST_SORT } from '../../browse/utils/postSort';
import type { PostSearchFilters, PostSortOption } from '../../browse/types';
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
 * 필터나 정렬이 하나라도 바뀌면 다른 목록이므로 키가 달라져야 한다.
 * 객체를 그대로 넣는다 — TanStack Query는 키를 구조적으로 비교하므로 직렬화할 필요가 없다.
 */
export function postSearchQueryKey(
  regionCode: string,
  filters: PostSearchFilters,
  sort: PostSortOption,
): ReadonlyArray<string | PostSearchFilters> {
  return ['posts', 'search', regionCode, filters, sort];
}

/**
 * 검색·필터·정렬 결과. 무한 스크롤이라 페이지 단위로 쌓인다.
 *
 * 동네를 아직 정하지 않았으면(regionCode가 null) 요청하지 않는다 —
 * 검색은 언제나 내 동네 안에서만 돌기 때문이다.
 */
export function useSearchPostsQuery(
  regionCode: string | null,
  filters: PostSearchFilters,
  sort: PostSortOption,
): PostSearchQueryResult {
  return useInfiniteQuery<PostSummary[], Error, InfiniteData<PostSummary[]>>({
    queryKey: postSearchQueryKey(regionCode ?? 'nowhere', filters, sort),
    queryFn: function loadPage({ pageParam }): Promise<PostSummary[]> {
      if (regionCode === null) {
        return Promise.reject(new Error('동네를 먼저 설정해 주세요.'));
      }
      return searchPosts({
        regionCode,
        filters,
        sort,
        cursor: (pageParam as PostSearchCursor | null) ?? null,
      });
    },
    initialPageParam: null,
    // 커서에 담을 값이 정렬 기준마다 다르다. 페이지만 보고는 정할 수 없어 여기서 함께 넘긴다.
    getNextPageParam: function toNextCursor(lastPage: PostSummary[]) {
      return toNextPostSearchCursor(lastPage, sort);
    },
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

/**
 * 홈의 내 동네 목록. 검색과 같은 무한 스크롤이다.
 *
 * 키를 검색과 나눠 둔다. 조건이 없는 검색과 결과는 같지만, 홈은 탭을 오갈 때마다 보는 화면이라
 * 검색에서 스크롤을 내린 만큼을 그대로 물려받으면 안 된다 — 캐시가 섞이면 홈을 열었을 때
 * 갑자기 100번째 글까지 그려져 있다.
 *
 * 동네를 아직 정하지 않았으면(regionCode가 null) 요청하지 않는다.
 */
export function useNeighborhoodPostsQuery(regionCode: string | null): PostSearchQueryResult {
  return useInfiniteQuery<PostSummary[], Error, InfiniteData<PostSummary[]>>({
    queryKey: neighborhoodPostsQueryKey(regionCode ?? 'nowhere'),
    queryFn: function loadPage({ pageParam }): Promise<PostSummary[]> {
      if (regionCode === null) {
        return Promise.reject(new Error('동네를 먼저 설정해 주세요.'));
      }
      return fetchNeighborhoodPosts(regionCode, (pageParam as PostSearchCursor | null) ?? null);
    },
    initialPageParam: null,
    getNextPageParam: function toNextCursor(lastPage: PostSummary[]) {
      return toNextPostSearchCursor(lastPage, DEFAULT_POST_SORT);
    },
    enabled: regionCode !== null,
    staleTime: POST_LIST_STALE_TIME_MS,
  });
}
