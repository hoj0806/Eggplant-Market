import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { fetchNeighborhoodPosts, fetchPostDetail } from '../api/postApi';
import type { PostDetail, PostSummary } from '../types';

const POST_DETAIL_STALE_TIME_MS = 30_000;
const POST_LIST_STALE_TIME_MS = 30_000;

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
