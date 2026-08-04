import {
  useInfiniteQuery,
  useQuery,
  type InfiniteData,
  type UseInfiniteQueryResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { fetchUserPosts, fetchUserProfile } from '../api/userProfileApi';
import { toNextMyPostCursor } from '../utils/myPostCursor';
import type { MyPostCursor, MyPostSummary, UserProfile } from '../types';

const USER_PROFILE_STALE_TIME_MS = 60_000;
const USER_POSTS_STALE_TIME_MS = 30_000;

export type UserPostsQueryResult = UseInfiniteQueryResult<InfiniteData<MyPostSummary[]>, Error>;

/**
 * 보는 사람을 키에 넣지 않는다.
 *
 * 마이페이지 목록(myPostsQueryKey)과 갈리는 지점이다. 그쪽은 서버가 auth.uid()로 답을 정해서
 * 누가 보느냐에 따라 내용이 달라지지만, 남의 프로필은 누가 보든 같은 것이 돌아온다.
 */
export function userProfileQueryKey(userId: string): ReadonlyArray<string> {
  return ['user', userId, 'profile'];
}

export function userPostsQueryKey(userId: string): ReadonlyArray<string> {
  return ['user', userId, 'posts'];
}

export function useUserProfileQuery(userId: string | null): UseQueryResult<UserProfile, Error> {
  return useQuery<UserProfile, Error>({
    queryKey: userProfileQueryKey(userId ?? 'unknown'),
    queryFn: function loadProfile(): Promise<UserProfile> {
      if (userId === null) {
        return Promise.reject(new Error('사용자를 찾을 수 없습니다.'));
      }
      return fetchUserProfile(userId);
    },
    enabled: userId !== null,
    staleTime: USER_PROFILE_STALE_TIME_MS,
  });
}

/** 그 사람이 팔고 있는 물건. 커서 규칙은 마이페이지 목록과 같다. */
export function useUserPostsQuery(userId: string | null): UserPostsQueryResult {
  return useInfiniteQuery<MyPostSummary[], Error, InfiniteData<MyPostSummary[]>>({
    queryKey: userPostsQueryKey(userId ?? 'unknown'),
    queryFn: function loadPage({ pageParam }): Promise<MyPostSummary[]> {
      if (userId === null) {
        return Promise.reject(new Error('사용자를 찾을 수 없습니다.'));
      }
      return fetchUserPosts(userId, (pageParam as MyPostCursor | null) ?? null);
    },
    initialPageParam: null,
    getNextPageParam: toNextMyPostCursor,
    enabled: userId !== null,
    staleTime: USER_POSTS_STALE_TIME_MS,
  });
}
