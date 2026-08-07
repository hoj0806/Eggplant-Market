import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { signInWithSocial, signOut } from '../api/authApi';
import { selectClearSession, useAuthStore } from '../store/authStore';
import type { SocialProvider } from '../types';

/**
 * 소셜 로그인.
 *
 * 프로바이더별로 훅을 나누지 않는다 — 하는 일이 같고, 나누면 버튼이 늘 때마다 훅도 는다.
 * 어느 것을 누르는 중인지는 `variables`로 가린다(`isPending && variables === 'kakao'`).
 */
export function useSocialSignInMutation(): UseMutationResult<void, Error, SocialProvider> {
  return useMutation<void, Error, SocialProvider>({
    mutationFn: signInWithSocial,
  });
}

/** 로그아웃 시 이전 사용자의 서버 데이터가 남지 않도록 쿼리 캐시도 비운다. */
export function useSignOutMutation(): UseMutationResult<void, Error, void> {
  const queryClient = useQueryClient();
  const clearSession = useAuthStore(selectClearSession);

  return useMutation<void, Error, void>({
    mutationFn: signOut,
    onSuccess: function handleSignedOut(): void {
      clearSession();
      queryClient.clear();
    },
  });
}
