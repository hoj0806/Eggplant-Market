import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import ProfileSettingsForm from './profileSettingsForm';
import PageSpinner from '../../../shared/ui/pageSpinner';
import { selectAuthStatus, selectAuthUser, useAuthStore } from '../../auth/store/authStore';
import { useUpdateProfileBasicsMutation } from '../hooks/useProfileMutations';
import { useMyProfileQuery } from '../hooks/useProfileQuery';
import { toProfileErrorMessage } from '../utils/profileErrorMessage';
import type { ProfileEditValues } from '../types';

/** 닉네임·프로필 사진 변경 화면. 데이터는 여기서 읽고 폼은 값만 다룬다. */
function ProfileSettingsPage() {
  const status = useAuthStore(selectAuthStatus);
  const user = useAuthStore(selectAuthUser);
  const profileQuery = useMyProfileQuery(user?.id ?? null);
  const updateProfileMutation = useUpdateProfileBasicsMutation();

  const [isSaved, setIsSaved] = useState(false);

  function handleSubmit(values: ProfileEditValues): void {
    if (user === null) {
      return;
    }

    setIsSaved(false);
    updateProfileMutation.mutate(
      { userId: user.id, ...values },
      {
        onSuccess: function handleSaved(): void {
          setIsSaved(true);
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

  if (profileQuery.isLoading || profileQuery.data === undefined) {
    return <PageSpinner message="프로필을 불러오는 중입니다…" />;
  }

  const profile = profileQuery.data;
  const errorMessage =
    updateProfileMutation.error !== null
      ? toProfileErrorMessage(updateProfileMutation.error)
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
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-50">프로필 수정</h1>
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

        {isSaved ? (
          <p
            role="status"
            className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm
                       text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950
                       dark:text-emerald-200"
          >
            프로필을 저장했습니다.
          </p>
        ) : null}

        {/*
          저장이 끝나면 프로필 캐시가 바뀌고, key가 달라져 폼이 새 값으로 다시 선다.
          이렇게 하지 않으면 사진을 지운 뒤에도 폼이 옛 removeAvatar 상태를 들고 있는다.
        */}
        <ProfileSettingsForm
          key={`${profile.nickname}-${profile.avatarUrl ?? 'default'}`}
          initialNickname={profile.nickname}
          currentAvatarUrl={profile.avatarUrl}
          isPending={updateProfileMutation.isPending}
          onSubmit={handleSubmit}
        />
      </section>
    </main>
  );
}

export default ProfileSettingsPage;
