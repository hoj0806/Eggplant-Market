import { Navigate, useNavigate } from 'react-router-dom';
import OnboardingForm from './onboardingForm';
import PageSpinner from '../../../shared/ui/pageSpinner';
import { selectAuthStatus, selectAuthUser, useAuthStore } from '../../auth/store/authStore';
import { useCompleteOnboardingMutation } from '../hooks/useProfileMutations';
import { useMyProfileQuery } from '../hooks/useProfileQuery';
import type { ProfileOnboardingValues } from '../types';
import { toProfileErrorMessage } from '../utils/profileErrorMessage';

/**
 * 최초 가입 직후 닉네임·프로필 사진을 정하는 화면.
 * 이메일 가입과 구글 로그인 모두 이곳을 거친다(가입 경로에 따라 첫 경험이 갈리지 않도록).
 */
function OnboardingPage() {
  const navigate = useNavigate();
  const status = useAuthStore(selectAuthStatus);
  const user = useAuthStore(selectAuthUser);
  const profileQuery = useMyProfileQuery(user?.id ?? null);
  const onboardingMutation = useCompleteOnboardingMutation();

  function handleSubmit(values: ProfileOnboardingValues): void {
    if (user === null) {
      return;
    }

    onboardingMutation.mutate(
      { userId: user.id, nickname: values.nickname, avatarFile: values.avatarFile },
      {
        onSuccess: function handleOnboarded(): void {
          navigate('/', { replace: true });
        },
      },
    );
  }

  if (status === 'loading') {
    return <PageSpinner message="세션을 확인하는 중입니다…" />;
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace />;
  }

  if (profileQuery.isLoading) {
    return <PageSpinner message="프로필을 불러오는 중입니다…" />;
  }

  // 이미 마친 사람이 주소창으로 들어온 경우 되돌린다.
  if (profileQuery.data !== undefined && profileQuery.data.onboardedAt !== null) {
    return <Navigate to="/" replace />;
  }

  const errorMessage =
    onboardingMutation.error !== null
      ? toProfileErrorMessage(onboardingMutation.error)
      : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-screen-sm flex-col justify-center gap-6 p-6">
      <header className="flex flex-col items-center gap-2 text-center">
        <span className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
          🍆 가지마켓
        </span>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-50">
          프로필을 만들어 주세요
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          이웃에게 보여질 닉네임과 사진입니다.
        </p>
      </header>

      <section
        className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-6
                   shadow-sm dark:border-gray-800 dark:bg-gray-950"
      >
        {errorMessage !== null ? (
          <p
            role="alert"
            className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700
                       dark:border-red-800 dark:bg-red-950 dark:text-red-300"
          >
            {errorMessage}
          </p>
        ) : null}

        <OnboardingForm isPending={onboardingMutation.isPending} onSubmit={handleSubmit} />
      </section>
    </main>
  );
}

export default OnboardingPage;
