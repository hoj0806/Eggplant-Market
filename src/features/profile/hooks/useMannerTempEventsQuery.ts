import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { fetchMannerTempEvents } from '../api/mannerTempEventApi';
import type { MannerTempEvent } from '../types';

export function mannerTempEventsQueryKey(userId: string): ReadonlyArray<string> {
  return ['mannerTempEvents', userId];
}

/**
 * 내 매너온도 이력.
 *
 * 캐시 키에 사용자 id를 넣는다. 질의 자체는 id를 안 보내지만(정책이 고른다) **계정을 바꾸면
 * 다른 사람의 이력이 남아 보이므로** 키는 사람마다 갈라야 한다.
 *
 * `staleTime`을 두지 않는다. 이 줄은 후기가 들고 날 때만 늘어나는데 그 일은 이 화면 밖에서
 * 벌어지므로, 열 때마다 다시 받는 편이 맞다 — 자주 여는 화면도 아니다.
 */
export function useMannerTempEventsQuery(
  userId: string | null,
): UseQueryResult<MannerTempEvent[], Error> {
  return useQuery<MannerTempEvent[], Error>({
    queryKey: mannerTempEventsQueryKey(userId ?? 'anonymous'),
    queryFn: fetchMannerTempEvents,
    enabled: userId !== null,
  });
}
