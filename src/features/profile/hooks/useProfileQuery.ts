import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { fetchProfile } from '../api/profileApi';
import type { Profile } from '../types';

const PROFILE_STALE_TIME_MS = 60_000;

export function profileQueryKey(userId: string): ReadonlyArray<string> {
  return ['profile', userId];
}

/** 로그인 전(userId가 null)에는 요청을 보내지 않는다. */
export function useMyProfileQuery(userId: string | null): UseQueryResult<Profile, Error> {
  return useQuery<Profile, Error>({
    queryKey: profileQueryKey(userId ?? 'anonymous'),
    queryFn: function loadProfile(): Promise<Profile> {
      if (userId === null) {
        return Promise.reject(new Error('로그인이 필요합니다.'));
      }
      return fetchProfile(userId);
    },
    enabled: userId !== null,
    staleTime: PROFILE_STALE_TIME_MS,
  });
}
