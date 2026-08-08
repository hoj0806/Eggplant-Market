import { Navigate } from 'react-router-dom';
import AuthFormMessage from './authFormMessage';
import AuthLayout from './authLayout';
import SocialSignInButton from './socialSignInButton';
import { useSocialSignInMutation } from '../hooks/useAuthMutations';
import { selectAuthStatus, useAuthStore } from '../store/authStore';
import type { SocialProvider } from '../types';
import { toAuthErrorMessage } from '../utils/authErrorMessage';

/**
 * 버튼이 놓이는 순서. 카카오가 위다 — 국내 중고거래 사용자가 먼저 찾는 쪽이고,
 * 구글은 이미 쓰던 사람이 알아보고 누른다.
 */
const SOCIAL_PROVIDERS: ReadonlyArray<SocialProvider> = ['kakao', 'google'];

/**
 * 로그인 — **소셜 둘뿐이다.**
 *
 * 이메일·비밀번호를 걷어냈다. 그래서 이 화면에는 **가입과 로그인의 구분이 없다** —
 * OAuth가 처음 온 사람이면 계정을 만들고 이미 있으면 들여보내므로, 나눠 물을 것이 없고
 * `/signup`도 사라졌다(주소를 치면 여기로 돌려보낸다).
 *
 * 잊어버릴 비밀번호가 없으니 "비밀번호를 잊으셨나요?"도 없다. 계정을 되찾는 일은
 * 카카오·구글이 맡는다 — 우리가 들고 있지 않은 것을 우리가 되찾아 줄 수는 없다.
 *
 * 아직 안 켠 프로바이더를 누르면 서버가 `provider is not enabled`로 답하고
 * `authErrorMessage`가 "아직 활성화되지 않았습니다"로 옮긴다. 버튼을 미리 두고 오류로
 * 알리는 편이, 준비되기 전까지 버튼을 감춰 두는 것보다 낫다 — 감추면 준비가 끝났을 때
 * 되살릴 자리를 잊는다.
 */
function SignInPage() {
  const status = useAuthStore(selectAuthStatus);
  const socialSignInMutation = useSocialSignInMutation();

  function handleSocialClick(provider: SocialProvider): void {
    socialSignInMutation.mutate(provider);
  }

  if (status === 'authenticated') {
    return <Navigate to="/" replace />;
  }

  const errorMessage =
    socialSignInMutation.error !== null
      ? toAuthErrorMessage(socialSignInMutation.error)
      : null;

  return (
    <AuthLayout
      title="로그인"
      description="카카오나 구글 계정으로 바로 시작할 수 있어요."
      footer={
        <span>처음이신가요? 로그인하면 계정이 자동으로 만들어집니다.</span>
      }
    >
      {errorMessage !== null ? <AuthFormMessage tone="error" message={errorMessage} /> : null}

      <div className="flex flex-col gap-3">
        {SOCIAL_PROVIDERS.map(function renderButton(provider: SocialProvider) {
          return (
            <SocialSignInButton
              key={provider}
              provider={provider}
              // 어느 버튼을 눌렀는지까지 봐야 한다. 안 그러면 하나를 눌렀을 때 둘 다 잠긴다.
              isPending={
                socialSignInMutation.isPending && socialSignInMutation.variables === provider
              }
              onClick={handleSocialClick}
            />
          );
        })}
      </div>
    </AuthLayout>
  );
}

export default SignInPage;
