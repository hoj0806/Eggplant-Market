import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import {
  signInWithEmail,
  signInWithGoogle,
  signOut,
  signUpWithEmail,
} from '../api/authApi';
import { selectClearSession, useAuthStore } from '../store/authStore';
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
