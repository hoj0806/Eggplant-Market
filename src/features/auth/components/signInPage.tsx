import { Link, Navigate, useNavigate } from 'react-router-dom';
import AuthDivider from './authDivider';
import AuthFormMessage from './authFormMessage';
import AuthLayout from './authLayout';
import GoogleSignInButton from './googleSignInButton';
import SignInForm from './signInForm';
import {
  useEmailSignInMutation,
  useGoogleSignInMutation,
} from '../hooks/useAuthMutations';
import { selectAuthStatus, useAuthStore } from '../store/authStore';
import type { EmailCredentials } from '../types';
import { toAuthErrorMessage } from '../utils/authErrorMessage';

function SignInPage() {
  const navigate = useNavigate();
  const status = useAuthStore(selectAuthStatus);
  const signInMutation = useEmailSignInMutation();
  const googleSignInMutation = useGoogleSignInMutation();

  function handleSubmit(credentials: EmailCredentials): void {
    signInMutation.mutate(credentials, {
      onSuccess: function handleSignedIn(): void {
        navigate('/', { replace: true });
      },
    });
  }

  function handleGoogleClick(): void {
    googleSignInMutation.mutate();
  }

  if (status === 'authenticated') {
    return <Navigate to="/" replace />;
  }

  const errorMessage =
    signInMutation.error !== null
      ? toAuthErrorMessage(signInMutation.error)
      : googleSignInMutation.error !== null
        ? toAuthErrorMessage(googleSignInMutation.error)
        : null;

  return (
    <AuthLayout
      title="로그인"
      description="가지마켓에 오신 것을 환영합니다."
      footer={
        <span>
          아직 계정이 없으신가요?{' '}
          <Link to="/signup" className="font-semibold text-emerald-600 dark:text-emerald-400">
            회원가입
          </Link>
        </span>
      }
    >
      {errorMessage !== null ? <AuthFormMessage tone="error" message={errorMessage} /> : null}

      <SignInForm isPending={signInMutation.isPending} onSubmit={handleSubmit} />

      {/*
        폼 바로 아래다. 비밀번호를 틀려 오류를 본 사람의 눈이 그다음에 닿는 자리가 여기다 —
        푸터(회원가입)까지 내려가면 이미 다시 입력해 보고 있다.
      */}
      <p className="text-right text-sm">
        <Link
          to="/forgot-password"
          className="text-gray-500 transition hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          비밀번호를 잊으셨나요?
        </Link>
      </p>

      <AuthDivider />

      <GoogleSignInButton
        label="구글로 로그인"
        isPending={googleSignInMutation.isPending}
        onClick={handleGoogleClick}
      />
    </AuthLayout>
  );
}

export default SignInPage;
