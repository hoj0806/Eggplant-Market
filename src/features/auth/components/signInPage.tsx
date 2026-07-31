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
