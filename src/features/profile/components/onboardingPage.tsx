import BrandMark from '../../../shared/ui/brandMark';
import { Navigate, useNavigate } from 'react-router-dom';
import OnboardingSteps, { type CompletedOnboardingDraft } from './onboardingSteps';
import PageSpinner from '../../../shared/ui/pageSpinner';
import { selectAuthStatus, selectAuthUser, useAuthStore } from '../../auth/store/authStore';
import { useCompleteOnboardingMutation } from '../hooks/useProfileMutations';
import { useMyProfileQuery } from '../hooks/useProfileQuery';
import { isOnboardingComplete, needsRegionOnly, toInitialNickname } from '../utils/onboardingStatus';
import { toProfileErrorMessage } from '../utils/profileErrorMessage';

/**
 * 최초 가입 직후 프로필과 동네를 정하는 화면. 두 단계로 나뉜다.
 * 이메일 가입과 구글 로그인 모두 이곳을 거친다(가입 경로에 따라 첫 경험이 갈리지 않도록).
 */
function OnboardingPage() {
  const navigate = useNavigate();
  const status = useAuthStore(selectAuthStatus);
  const user = useAuthStore(selectAuthUser);
  const profileQuery = useMyProfileQuery(user?.id ?? null);
  const onboardingMutation = useCompleteOnboardingMutation();

  function handleComplete(draft: CompletedOnboardingDraft): void {
    if (user === null) {
      return;
    }

    onboardingMutation.mutate(
      {
        userId: user.id,
        nickname: draft.nickname,
        avatarFile: draft.avatarFile,
        region: draft.region,
      },
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

  const profile = profileQuery.data;

  // 이미 마친 사람이 주소창으로 들어온 경우 되돌린다.
  // 판정은 라우트 가드(requireOnboarding)와 같은 함수를 써야 서로 밀어내지 않는다.
  if (profile !== undefined && isOnboardingComplete(profile)) {
    return <Navigate to="/" replace />;
  }

  const errorMessage =
    onboardingMutation.error !== null
      ? toProfileErrorMessage(onboardingMutation.error)
      : null;

  // 이미 가입을 마친 사용자는 동네만 비어 있다. 프로필을 처음부터 다시 정하라고 하면 안 된다.
  const regionOnly = profile !== undefined && needsRegionOnly(profile);

  return (
    <main className="flex min-h-screen page-narrow flex-col justify-center gap-6 p-6">
      <header className="flex flex-col items-center gap-2 text-center">
        <span className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
          <span className="flex items-center justify-center gap-2">
            <BrandMark size={28} />
            가지마켓
          </span>
        </span>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-50">
          {regionOnly ? '거래할 동네를 정해 주세요' : '시작하기 전에 몇 가지만 알려 주세요'}
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {regionOnly
            ? '동네를 정해야 이웃의 물건을 볼 수 있습니다. 나중에 언제든 바꿀 수 있어요.'
            : '이웃에게 보여질 프로필과 거래할 동네입니다.'}
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

        <OnboardingSteps
          initialNickname={profile === undefined ? '' : toInitialNickname(profile)}
          regionOnly={regionOnly}
          isPending={onboardingMutation.isPending}
          onComplete={handleComplete}
        />
      </section>
    </main>
  );
}

export default OnboardingPage;
