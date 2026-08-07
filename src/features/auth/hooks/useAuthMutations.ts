import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import {
  sendPasswordResetEmail,
  signInWithEmail,
  signInWithGoogle,
  signOut,
  signUpWithEmail,
  updatePassword,
} from '../api/authApi';
import {
  selectClearSession,
  selectEndPasswordRecovery,
  useAuthStore,
} from '../store/authStore';
import type { AuthSession, EmailCredentials, SignUpResult } from '../types';

export function useEmailSignUpMutation(): UseMutationResult<
  SignUpResult,
  Error,
  EmailCredentials
> {
  return useMutation<SignUpResult, Error, EmailCredentials>({
    mutationFn: signUpWithEmail,
  });
}

export function useEmailSignInMutation(): UseMutationResult<
  AuthSession,
  Error,
  EmailCredentials
> {
  return useMutation<AuthSession, Error, EmailCredentials>({
    mutationFn: signInWithEmail,
  });
}

export function useGoogleSignInMutation(): UseMutationResult<void, Error, void> {
  return useMutation<void, Error, void>({
    mutationFn: signInWithGoogle,
  });
}

/** 재설정 메일 보내기. 가입 여부는 결과로 드러나지 않는다(authApi 참고). */
export function usePasswordResetRequestMutation(): UseMutationResult<void, Error, string> {
  return useMutation<void, Error, string>({
    mutationFn: sendPasswordResetEmail,
  });
}

/**
 * 새 비밀번호 정하기.
 *
 * 성공하면 재설정 표를 내린다. 안 내리면 그 뒤로도 `/reset-password`가 계속 열려 있어,
 * 한 번 받은 링크로 **몇 번이고** 비밀번호를 바꿀 수 있는 창이 된다.
 * 세션은 그대로 두어 로그인된 채로 이어진다 — 방금 본인임을 증명한 사람이다.
 */
export function useNewPasswordMutation(): UseMutationResult<void, Error, string> {
  const endPasswordRecovery = useAuthStore(selectEndPasswordRecovery);

  return useMutation<void, Error, string>({
    mutationFn: updatePassword,
    onSuccess: function closeRecoveryWindow(): void {
      endPasswordRecovery();
    },
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
