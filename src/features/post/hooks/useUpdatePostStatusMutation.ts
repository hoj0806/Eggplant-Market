import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { postDetailQueryKey } from './usePostQueries';
import { updatePostStatus, type UpdatePostStatusInput } from '../api/postApi';

export type UpdatePostStatusVariables = Omit<UpdatePostStatusInput, 'postId'>;

/**
 * 거래 상태 변경.
 *
 * 낙관적으로 뒤집지 않는다. 찜과 달리 연타하는 동작이 아니고, 서버가 거절할 이유가 여럿이라
 * (거래완료 되돌리기, 채팅하지 않은 사람을 구매자로) 미리 바꿔 놓으면 되돌리는 쪽이 더 번거롭다.
 * 대신 성공하면 상세를 다시 받아 예약자·구매자 정보까지 한 번에 맞춘다.
 */
export function useUpdatePostStatusMutation(
  postId: number,
  viewerId: string | null,
): UseMutationResult<void, Error, UpdatePostStatusVariables> {
  const queryClient = useQueryClient();

  return useMutation<void, Error, UpdatePostStatusVariables>({
    mutationFn: function changeStatus(variables: UpdatePostStatusVariables): Promise<void> {
      return updatePostStatus({ postId, status: variables.status, buyerId: variables.buyerId });
    },
    onSuccess: function refreshEverywhere(): void {
      // 상태 뱃지는 상세·홈 목록·검색 결과·채팅방 헤더 네 군데에 있다.
      queryClient.invalidateQueries({ queryKey: postDetailQueryKey(postId, viewerId) });
      queryClient.invalidateQueries({ queryKey: ['posts', 'neighborhood'] });
      queryClient.invalidateQueries({ queryKey: ['posts', 'search'] });
      queryClient.invalidateQueries({ queryKey: ['chatRooms'] });
      queryClient.invalidateQueries({ queryKey: ['chatRoom'] });
    },
  });
}
