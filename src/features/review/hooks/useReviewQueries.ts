import {
  useInfiniteQuery,
  useQuery,
  type InfiniteData,
  type UseInfiniteQueryResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { fetchPendingReviews, fetchUserReviews } from '../api/reviewApi';
import { toNextReviewCursor } from '../utils/reviewCursor';
import type { PendingReview, ReceivedReview, ReviewCursor } from '../types';

const USER_REVIEWS_STALE_TIME_MS = 60_000;
const PENDING_REVIEWS_STALE_TIME_MS = 30_000;

export type UserReviewsQueryResult = UseInfiniteQueryResult<InfiniteData<ReceivedReview[]>, Error>;

export function userReviewsQueryKey(userId: string): ReadonlyArray<string> {
  return ['user', userId, 'reviews'];
}

/**
 * 남은 후기는 내 것이므로 사용자를 키에 넣는다.
 * 넣지 않으면 계정을 바꿔 들어왔을 때 앞사람의 "후기 남기기" 버튼이 그대로 붙어 있다.
 */
export function pendingReviewsQueryKey(userId: string | null): ReadonlyArray<string> {
  return ['reviews', 'pending', userId ?? 'anonymous'];
}

/** 어떤 사용자가 받은 후기. 프로필 화면이 쓴다. */
export function useUserReviewsQuery(userId: string | null): UserReviewsQueryResult {
  return useInfiniteQuery<ReceivedReview[], Error, InfiniteData<ReceivedReview[]>>({
    queryKey: userReviewsQueryKey(userId ?? 'unknown'),
    queryFn: function loadPage({ pageParam }): Promise<ReceivedReview[]> {
      if (userId === null) {
        return Promise.reject(new Error('사용자를 찾을 수 없습니다.'));
      }
      return fetchUserReviews(userId, (pageParam as ReviewCursor | null) ?? null);
    },
    initialPageParam: null,
    getNextPageParam: toNextReviewCursor,
    enabled: userId !== null,
    staleTime: USER_REVIEWS_STALE_TIME_MS,
  });
}

/**
 * 내가 아직 후기를 남기지 않은 거래.
 *
 * 구매내역·판매관리가 카드마다 버튼을 붙일지 정하는 데 쓴다. 목록 RPC(0009)에 컬럼을 더하는
 * 대신 이 한 번의 조회를 목록과 나란히 두는 편을 골랐다 — 네 목록이 같은 열 벌을 돌려주기로 한
 * 약속을 깨지 않기 위해서다.
 */
export function usePendingReviewsQuery(
  userId: string | null,
): UseQueryResult<PendingReview[], Error> {
  return useQuery<PendingReview[], Error>({
    queryKey: pendingReviewsQueryKey(userId),
    queryFn: fetchPendingReviews,
    enabled: userId !== null,
    staleTime: PENDING_REVIEWS_STALE_TIME_MS,
  });
}
