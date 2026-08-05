import {
  useMutation,
  useQueryClient,
  type QueryClient,
  type UseMutationResult,
} from '@tanstack/react-query';
import { blockUser, unblockUser } from '../api/blockApi';

/**
 * 차단 한 번이 흔드는 화면들.
 *
 * 차단은 "표시를 남기는 일"이 아니라 "안 보이게 하는 일"이라 목록이 전부 달라진다.
 *   · 홈·검색      상대의 글이 빠진다 (0014의 search_posts)
 *   · 채팅         상대와의 방이 빠진다 (fetch_chat_rooms → 탭바 배지까지)
 *   · 차단 목록    방금 넣거나 뺀 사람이 반영된다
 *
 * 해제도 같은 목록을 되돌리므로 두 뮤테이션이 같은 갱신을 쓴다.
 * 마이페이지 목록(`['my']`)은 건드리지 않는다 — 찜·최근 본 글은 내가 남긴 흔적이라
 * 상대를 차단해도 그대로 두는 편이 맞다(당근도 지우지 않는다).
 */
function invalidateBlockAffectedQueries(queryClient: QueryClient): void {
  queryClient.invalidateQueries({ queryKey: ['blocks'] });
  queryClient.invalidateQueries({ queryKey: ['posts', 'neighborhood'] });
  queryClient.invalidateQueries({ queryKey: ['posts', 'search'] });
  queryClient.invalidateQueries({ queryKey: ['chatRooms'] });
  queryClient.invalidateQueries({ queryKey: ['chatRoom'] });
}

export function useBlockUserMutation(
  viewerId: string,
  targetId: string,
): UseMutationResult<void, Error, void> {
  const queryClient = useQueryClient();

  return useMutation<void, Error, void>({
    mutationFn: function block(): Promise<void> {
      return blockUser({ blockerId: viewerId, blockedId: targetId });
    },
    onSuccess: function refreshLists(): void {
      invalidateBlockAffectedQueries(queryClient);
    },
  });
}

export function useUnblockUserMutation(
  viewerId: string,
  targetId: string,
): UseMutationResult<void, Error, void> {
  const queryClient = useQueryClient();

  return useMutation<void, Error, void>({
    mutationFn: function unblock(): Promise<void> {
      return unblockUser({ blockerId: viewerId, blockedId: targetId });
    },
    onSuccess: function refreshLists(): void {
      invalidateBlockAffectedQueries(queryClient);
    },
  });
}
