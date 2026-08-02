import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import PageSpinner from '../../../shared/ui/pageSpinner';
import { selectAuthStatus, selectAuthUser, useAuthStore } from '../../auth/store/authStore';
import RegionPicker from '../../region/components/regionPicker';
import { useUpdateRegionMutation } from '../hooks/useProfileMutations';
import { useMyProfileQuery } from '../hooks/useProfileQuery';
import { toProfileErrorMessage } from '../utils/profileErrorMessage';
import { validateRegion } from '../utils/validateProfileInput';
import type { Region } from '../../region/types';

/** 동네 변경 화면. 온보딩 2단계와 같은 RegionPicker를 쓴다. */
function RegionSettingsPage() {
  const status = useAuthStore(selectAuthStatus);
  const user = useAuthStore(selectAuthUser);
  const profileQuery = useMyProfileQuery(user?.id ?? null);
  const updateRegionMutation = useUpdateRegionMutation();

  const [selectedRegion, setSelectedRegion] = useState<Region | null>(null);
  const [regionError, setRegionError] = useState<string | undefined>(undefined);
  const [isSaved, setIsSaved] = useState(false);

  function handleRegionChange(region: Region): void {
    setRegionError(undefined);
    setIsSaved(false);
    setSelectedRegion(region);
  }

  function handleSave(): void {
    const message = validateRegion(selectedRegion);
    if (message !== undefined || selectedRegion === null || user === null) {
      setRegionError(message);
      return;
    }

    updateRegionMutation.mutate(
      { userId: user.id, region: selectedRegion },
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

  if (profileQuery.isLoading) {
    return <PageSpinner message="프로필을 불러오는 중입니다…" />;
  }

  const currentRegion = profileQuery.data?.region ?? null;
  const errorMessage =
    updateRegionMutation.error !== null
      ? toProfileErrorMessage(updateRegionMutation.error)
      : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-screen-sm flex-col gap-6 p-6">
      <header className="flex flex-col gap-2">
        <Link
          to="/"
          className="text-sm text-gray-500 transition hover:text-gray-700
                     dark:text-gray-400 dark:hover:text-gray-200"
        >
          ← 홈으로
        </Link>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-50">내 동네 설정</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {currentRegion === null
            ? '아직 동네를 정하지 않았습니다.'
            : `현재 동네는 ${currentRegion.fullName}입니다.`}
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

        {isSaved ? (
          <p
            role="status"
            className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm
                       text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950
                       dark:text-emerald-200"
          >
            동네를 바꿨습니다.
          </p>
        ) : null}

        <RegionPicker
          value={selectedRegion}
          disabled={updateRegionMutation.isPending}
          errorMessage={regionError}
          onChange={handleRegionChange}
        />

        <button
          type="button"
          disabled={updateRegionMutation.isPending}
          onClick={handleSave}
          className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white
                     transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {updateRegionMutation.isPending ? '저장 중…' : '이 동네로 변경'}
        </button>
      </section>
    </main>
  );
}

export default RegionSettingsPage;
