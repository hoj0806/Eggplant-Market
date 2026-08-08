import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { fetchBlockedUsers, fetchIsBlocked } from '../api/blockApi';
import type { BlockedUser } from '../types';

const BLOCK_STALE_TIME_MS = 60_000;

/**
 * 차단은 내 것이므로 키에 사용자를 넣는다. 넣지 않으면 계정을 바꿔 들어왔을 때
 * 앞사람의 차단 목록이 그대로 보인다(pendingReviewsQueryKey와 같은 이유).
 *
 * 목록과 낱개 판정이 같은 앞자락(`['blocks', 나]`)을 쓴다 — 차단 한 번에 둘 다 갱신돼야 한다.
 */
export function blockedUsersQueryKey(viewerId: string | null): ReadonlyArray<string> {
  return ['blocks', viewerId ?? 'anonymous'];
}

export function blockStatusQueryKey(
  viewerId: string | null,
  targetId: string,
): ReadonlyArray<string> {
  return ['blocks', viewerId ?? 'anonymous', targetId];
}

/** 마이페이지 차단 목록 화면이 쓴다. */
export function useBlockedUsersQuery(viewerId: string | null): UseQueryResult<BlockedUser[], Error> {
  return useQuery<BlockedUser[], Error>({
    queryKey: blockedUsersQueryKey(viewerId),
    queryFn: fetchBlockedUsers,
    enabled: viewerId !== null,
    staleTime: BLOCK_STALE_TIME_MS,
  });
}

/**
 * 이 사람을 내가 차단했는지. ⋯ 메뉴가 "차단하기"와 "차단 해제" 중 무엇을 그릴지 정한다.
 *
 * 게스트와 나 자신에게는 묻지 않는다 — 둘 다 차단 버튼이 아예 없는 자리다.
 */
export function useBlockStatusQuery(
  viewerId: string | null,
  targetId: string | null,
): UseQueryResult<boolean, Error> {
  const isEnabled = viewerId !== null && targetId !== null && viewerId !== targetId;

  return useQuery<boolean, Error>({
    queryKey: blockStatusQueryKey(viewerId, targetId ?? 'unknown'),
    queryFn: function loadStatus(): Promise<boolean> {
      if (viewerId === null || targetId === null) {
        return Promise.reject(new Error('차단 여부를 확인할 수 없습니다.'));
      }
      return fetchIsBlocked({ blockerId: viewerId, blockedId: targetId });
    },
    enabled: isEnabled,
    staleTime: BLOCK_STALE_TIME_MS,
  });
}
