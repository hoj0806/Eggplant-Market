import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import AuthDivider from './authDivider';
import AuthFormMessage from './authFormMessage';
import AuthLayout from './authLayout';
import GoogleSignInButton from './googleSignInButton';
import SignUpForm from './signUpForm';
import {
  useEmailSignUpMutation,
  useGoogleSignInMutation,
} from '../hooks/useAuthMutations';
import { selectAuthStatus, useAuthStore } from '../store/authStore';
import type { EmailCredentials, SignUpResult } from '../types';
import { toAuthErrorMessage } from '../utils/authErrorMessage';

const EMAIL_CONFIRM_NOTICE =
  '인증 메일을 보냈습니다. 메일의 링크를 눌러 가입을 완료해 주세요.';

function SignUpPage() {
  const navigate = useNavigate();
  const status = useAuthStore(selectAuthStatus);
  const signUpMutation = useEmailSignUpMutation();
  const googleSignInMutation = useGoogleSignInMutation();
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);

  function handleSignUpSuccess(result: SignUpResult): void {
    if (result.needsEmailConfirm) {
      setNoticeMessage(EMAIL_CONFIRM_NOTICE);
      return;
    }
    navigate('/', { replace: true });
  }

  function handleSubmit(credentials: EmailCredentials): void {
    setNoticeMessage(null);
    signUpMutation.mutate(credentials, { onSuccess: handleSignUpSuccess });
  }

  function handleGoogleClick(): void {
    setNoticeMessage(null);
    googleSignInMutation.mutate();
  }

  if (status === 'authenticated') {
    return <Navigate to="/" replace />;
  }

  const errorMessage =
    signUpMutation.error !== null
      ? toAuthErrorMessage(signUpMutation.error)
      : googleSignInMutation.error !== null
        ? toAuthErrorMessage(googleSignInMutation.error)
        : null;

  return (
    <AuthLayout
      title="회원가입"
      description="이웃과 중고거래를 시작해 보세요."
      footer={
        <span>
          이미 계정이 있으신가요?{' '}
          <Link to="/login" className="font-semibold text-emerald-600 dark:text-emerald-400">
            로그인
          </Link>
        </span>
      }
    >
      {errorMessage !== null ? <AuthFormMessage tone="error" message={errorMessage} /> : null}
      {noticeMessage !== null ? <AuthFormMessage tone="info" message={noticeMessage} /> : null}

      <SignUpForm isPending={signUpMutation.isPending} onSubmit={handleSubmit} />

      <AuthDivider />

      <GoogleSignInButton
        label="구글로 시작하기"
        isPending={googleSignInMutation.isPending}
        onClick={handleGoogleClick}
      />
    </AuthLayout>
  );
}

export default SignUpPage;
