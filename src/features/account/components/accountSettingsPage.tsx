import DeleteAccountSection from './deleteAccountSection';
import PageHeader from '../../../shared/ui/pageHeader';
import PageSpinner from '../../../shared/ui/pageSpinner';
import { selectAuthUser, useAuthStore } from '../../auth/store/authStore';

const SECTION_CLASS =
  'flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm ' +
  'dark:border-gray-800 dark:bg-gray-950';

/** 소셜 제공자 id를 화면에 적을 이름으로. 모르는 값이 오면 그대로 보여준다. */
const PROVIDER_LABEL: Record<string, string> = {
  google: '구글',
  kakao: '카카오',
};

/**
 * 계정 설정 — 로그인 방법 안내와 회원탈퇴.
 *
 * 프로필 수정(닉네임·사진)과 나누어 둔다. 그쪽은 남에게 보이는 것을 고치는 화면이고
 * 여기는 계정 자체를 다루는 화면이라, 실수로 탈퇴 버튼 옆에서 닉네임을 만지게 하고 싶지 않다.
 *
 * **비밀번호 변경 칸은 없앴다.** 로그인이 소셜뿐이라 가지마켓이 들고 있는 비밀번호가 없다 —
 * 바꿀 것은 카카오·구글 쪽에 있다. 예전에는 `hasPasswordLogin`으로 갈라 두 갈래를 그렸는데
 * 이제 한쪽만 남아 갈래 자체가 사라졌다.
 *
 * 로그인 가드는 라우터의 RequireMember가 이미 걸었다.
 */
function AccountSettingsPage() {
  const user = useAuthStore(selectAuthUser);

  if (user === null) {
    return <PageSpinner message="세션을 확인하는 중입니다…" />;
  }

  // 어느 소셜로 들어왔는지. 여러 개가 연결돼 있으면 전부 적는다.
  const providers = Array.isArray(user.app_metadata.providers)
    ? user.app_metadata.providers
    : [user.app_metadata.provider];
  const providerText = providers
    .filter(function isName(value: unknown): value is string {
      return typeof value === 'string' && value.length > 0;
    })
    .map(function toLabel(name: string): string {
      return PROVIDER_LABEL[name] ?? name;
    })
    .join(' · ');

  return (
    <main className="flex min-h-screen page-narrow flex-col gap-6 p-6">
      <PageHeader
        backTo="/my"
        backLabel="마이페이지"
        title="계정 설정"
        description={user.email ?? ''}
      />

      <section className={SECTION_CLASS}>
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">로그인 방법</h2>
        <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
          {providerText === '' ? '소셜 계정' : `${providerText} 계정`}으로 로그인하고 있어요.
          가지마켓에는 비밀번호가 없어서, 비밀번호를 바꾸거나 되찾는 일은 로그인에 쓰는
          서비스에서 해 주세요.
        </p>
      </section>

      <section className={SECTION_CLASS}>
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">회원탈퇴</h2>
        <DeleteAccountSection />
      </section>
    </main>
  );
}

export default AccountSettingsPage;
