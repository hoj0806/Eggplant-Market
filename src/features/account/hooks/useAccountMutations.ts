import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { deleteAccount } from '../api/accountApi';
import { signOutLocally } from '../../auth/api/authApi';
import { selectClearSession, useAuthStore } from '../../auth/store/authStore';

/**
 * 회원탈퇴.
 *
 * 계정이 사라진 뒤에도 이 브라우저에는 토큰과 쿼리 캐시가 남아 있다. 그대로 두면
 * 화면이 이미 없는 사람의 프로필을 계속 그리다가 다음 요청에서야 401을 만난다.
 * 그래서 지우자마자 이 기기의 세션을 걷어내고(signOutLocally) 캐시를 비운다 —
 * 로그아웃(useSignOutMutation)이 하는 뒷정리와 같고, 로그아웃 쪽만 서버에도 알린다.
 *
 * 세션이 비면 RequireMember가 로그인 화면으로 보내므로 따로 navigate하지 않는다.
 */
export function useDeleteAccountMutation(): UseMutationResult<void, Error, void> {
  const queryClient = useQueryClient();
  const clearSession = useAuthStore(selectClearSession);

  return useMutation<void, Error, void>({
    mutationFn: async function removeAccount(): Promise<void> {
      await deleteAccount();
      await signOutLocally();
    },
    onSuccess: function handleDeleted(): void {
      clearSession();
      queryClient.clear();
    },
  });
}
