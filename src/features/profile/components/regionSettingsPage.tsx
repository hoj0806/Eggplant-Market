import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import SearchRadiusSelect from './searchRadiusSelect';
import PageHeader from '../../../shared/ui/pageHeader';
import PageSpinner from '../../../shared/ui/pageSpinner';
import { selectAuthStatus, selectAuthUser, useAuthStore } from '../../auth/store/authStore';
import { DEFAULT_SEARCH_RADIUS_M } from '../../browse/utils/searchRadius';
import RegionPicker from '../../region/components/regionPicker';
import {
  useUpdateRegionMutation,
  useUpdateSearchRadiusMutation,
} from '../hooks/useProfileMutations';
import { useMyProfileQuery } from '../hooks/useProfileQuery';
import { toProfileErrorMessage } from '../utils/profileErrorMessage';
import { validateRegion } from '../utils/validateProfileInput';
import type { Region } from '../../region/types';

/**
 * 동네 변경 화면. 온보딩 2단계와 같은 RegionPicker를 쓴다.
 *
 * 검색 반경도 여기 있다. 값 자체는 검색 화면에서만 쓰이지만(0024) **무엇을 기준으로 재는지가
 * 동네**라, 동네와 떨어뜨려 두면 "어디서부터 2km인가"를 알 수 없다.
 */
function RegionSettingsPage() {
  const status = useAuthStore(selectAuthStatus);
  const user = useAuthStore(selectAuthUser);
  const profileQuery = useMyProfileQuery(user?.id ?? null);
  const updateRegionMutation = useUpdateRegionMutation();
  const updateRadiusMutation = useUpdateSearchRadiusMutation();

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

  /**
   * 반경은 고른 즉시 저장한다.
   *
   * 동네처럼 "저장했습니다"를 띄우지 않는다 — 고른 칩이 그 자리에서 켜지므로 결과가 이미
   * 보이고, 안내를 띄우면 동네 저장 문구와 같은 자리에서 번갈아 나타나 어느 쪽이 저장됐는지
   * 헷갈린다. 실패했을 때만 위의 오류 문구가 뜬다.
   */
  function handleRadiusChange(radiusM: number): void {
    if (user === null) {
      return;
    }

    updateRadiusMutation.mutate({ userId: user.id, radiusM });
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
  const currentRadius = profileQuery.data?.searchRadiusM ?? DEFAULT_SEARCH_RADIUS_M;
  // 둘 중 어느 저장이 실패했든 사용자에게는 "저장이 안 됐다" 하나다. 먼저 난 것을 보여준다.
  const failedMutation = updateRegionMutation.error ?? updateRadiusMutation.error;
  const errorMessage = failedMutation !== null ? toProfileErrorMessage(failedMutation) : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-screen-sm flex-col gap-6 p-6">
      <PageHeader
        backTo="/"
        backLabel="홈"
        title="내 동네 설정"
        description={
          currentRegion === null
            ? '아직 동네를 정하지 않았습니다.'
            : `현재 동네는 ${currentRegion.fullName}입니다.`
        }
      />

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

      <section
        className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-6
                   shadow-sm dark:border-gray-800 dark:bg-gray-950"
      >
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">검색 반경</h2>
          {/*
            반경이 실제로 고르는 것은 물건이 아니라 동네다. 글의 좌표가 판매자 동네의
            대표 좌표라(0005) 같은 동 글은 거리가 전부 같기 때문이다.
            "2km 안의 물건"이라고 적으면 물건 하나하나까지 재 준다는 뜻이 되어 거짓말이 된다.
          */}
          <p className="text-sm text-gray-600 dark:text-gray-400">
            검색 화면에서 <b>반경</b>으로 볼 때 쓰는 값입니다. 내 동네를 중심으로 이 거리 안에
            드는 <b>동네</b>의 글이 함께 보여요.
          </p>
        </div>

        <SearchRadiusSelect
          value={currentRadius}
          disabled={updateRadiusMutation.isPending}
          onChange={handleRadiusChange}
        />
      </section>
    </main>
  );
}

export default RegionSettingsPage;
