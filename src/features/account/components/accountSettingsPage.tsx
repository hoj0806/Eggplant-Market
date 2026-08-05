import { useState } from 'react';
import { Link } from 'react-router-dom';
import DeleteAccountSection from './deleteAccountSection';
import PasswordChangeForm from './passwordChangeForm';
import PageSpinner from '../../../shared/ui/pageSpinner';
import { selectAuthUser, useAuthStore } from '../../auth/store/authStore';
import { useChangePasswordMutation } from '../hooks/useAccountMutations';
import { toAccountErrorMessage } from '../utils/accountErrorMessage';
import { hasPasswordLogin } from '../utils/passwordLogin';
import type { PasswordChangeValues } from '../types';

const SECTION_CLASS =
  'flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm ' +
  'dark:border-gray-800 dark:bg-gray-950';

/**
 * 계정 설정 — 비밀번호 변경과 회원탈퇴.
 *
 * 프로필 수정(닉네임·사진)과 나누어 둔다. 그쪽은 남에게 보이는 것을 고치는 화면이고
 * 여기는 계정 자체를 다루는 화면이라, 실수로 탈퇴 버튼 옆에서 닉네임을 만지게 하고 싶지 않다.
 *
 * 비밀번호 칸은 구글로만 가입한 사람에게는 보이지 않는다(hasPasswordLogin).
 * 로그인 가드는 라우터의 RequireMember가 이미 걸었다.
 */
function AccountSettingsPage() {
  const user = useAuthStore(selectAuthUser);
  const changePasswordMutation = useChangePasswordMutation();
  const [isChanged, setIsChanged] = useState(false);

  function handleChangePassword(values: PasswordChangeValues): void {
    if (user?.email === undefined) {
      return;
    }

    setIsChanged(false);
    changePasswordMutation.mutate(
      {
        email: user.email,
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      },
      {
        onSuccess: function markChanged(): void {
          setIsChanged(true);
        },
      },
    );
  }

  if (user === null) {
    return <PageSpinner message="세션을 확인하는 중입니다…" />;
  }

  const canChangePassword = hasPasswordLogin(user) && user.email !== undefined;
  const errorMessage =
    changePasswordMutation.error !== null
      ? toAccountErrorMessage(changePasswordMutation.error)
      : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-screen-sm flex-col gap-6 p-6">
      <header className="flex flex-col gap-2">
        <Link
          to="/my"
          className="text-sm text-gray-500 transition hover:text-gray-700
                     dark:text-gray-400 dark:hover:text-gray-200"
        >
          ← 마이페이지
        </Link>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-50">계정 설정</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">{user.email ?? ''}</p>
      </header>

      {canChangePassword ? (
        <section className={SECTION_CLASS}>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">
            비밀번호 변경
          </h2>

          {errorMessage !== null ? (
            <p
              role="alert"
              className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700
                         dark:border-red-800 dark:bg-red-950 dark:text-red-300"
            >
              {errorMessage}
            </p>
          ) : null}

          {isChanged ? (
            <p
              role="status"
              className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm
                         text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950
                         dark:text-emerald-200"
            >
              비밀번호를 변경했습니다.
            </p>
          ) : null}

          {/*
            성공하면 key가 바뀌어 폼이 빈 값으로 다시 선다.
            입력한 비밀번호 셋을 화면에 남겨 둘 이유가 없다.
          */}
          <PasswordChangeForm
            key={isChanged ? 'changed' : 'editing'}
            isPending={changePasswordMutation.isPending}
            onSubmit={handleChangePassword}
          />
        </section>
      ) : (
        <section className={SECTION_CLASS}>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">
            로그인 방법
          </h2>
          <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
            소셜 계정으로 로그인하고 있어 가지마켓에는 비밀번호가 없어요. 비밀번호는 로그인에
            쓰는 서비스에서 바꿔 주세요.
          </p>
        </section>
      )}

      <section className={SECTION_CLASS}>
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-50">회원탈퇴</h2>
        <DeleteAccountSection />
      </section>
    </main>
  );
}

export default AccountSettingsPage;
