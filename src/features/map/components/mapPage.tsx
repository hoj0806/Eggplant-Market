import { ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import RegionCountList from './regionCountList';
import RegionMapCanvas from './regionMapCanvas';
import PageSpinner from '../../../shared/ui/pageSpinner';
import PostList from '../../browse/components/postList';
import SearchRegionPrompt from '../../browse/components/searchRegionPrompt';
import GuestRegionSwitcher from '../../region/components/guestRegionSwitcher';
import { useActiveRegion } from '../../browse/hooks/useActiveRegion';
import { fromSearchParams, hasActiveFilter } from '../../browse/utils/postSearchFilters';
import { DEFAULT_POST_SORT } from '../../browse/utils/postSort';
import { toSearchRadiusLabel } from '../../browse/utils/searchRadius';
import { useSearchPostsQuery } from '../../post/hooks/usePostQueries';
import { useRegionCountsQuery } from '../hooks/useRegionCountsQuery';
import type { PostSummary } from '../../post/types';
import type { Region } from '../../region/types';
import type { RegionPostCount } from '../types';

const MESSAGE_CLASS = 'py-6 text-center text-sm text-gray-500 dark:text-gray-400';

/**
 * 아직 세지 않았을 때 쓰는 빈 목록.
 *
 * `?? []`를 그 자리에 적으면 **렌더할 때마다 다른 배열**이 된다. 마커를 얹는 effect가
 * 이 값을 보고 도는데, 매번 새 배열이면 지도가 뜨기 전까지 마커를 걷었다 얹기를 반복한다.
 */
const EMPTY_REGIONS: ReadonlyArray<RegionPostCount> = [];

function findRegion(
  regions: ReadonlyArray<RegionPostCount>,
  regionCode: string | null,
): RegionPostCount | null {
  if (regionCode === null) {
    return null;
  }

  return (
    regions.find(function hasCode(region: RegionPostCount): boolean {
      return region.regionCode === regionCode;
    }) ?? null
  );
}

/**
 * 지도로 주변 물건 보기.
 *
 * 마커 하나가 **동네 하나**다. 글마다 핀을 찍지 않는 이유는 `posts.location`이 판매자 동네의
 * 대표 좌표라(0005) 같은 동 글이 한 점에 겹쳐 쌓이기 때문이다. 겹치는 것을 서버에서 미리
 * 세어 내려받는다(0025).
 *
 * 반경은 언제나 켜져 있다. 검색(`/search`)과 달리 기준 전환이 없다 — 내 동네 하나만 보는
 * 지도는 마커가 한 개뿐이라 지도일 이유가 없다.
 *
 * 필터는 URL에서 그대로 이어받는다. 검색에서 "노트북"을 걸고 지도로 넘어왔는데 전부 다
 * 보이면, 지도가 다른 것을 세고 있다고 읽힌다.
 */
function MapPage() {
  const [searchParams] = useSearchParams();
  const activeRegion = useActiveRegion();
  const [selectedRegionCode, setSelectedRegionCode] = useState<string | null>(null);

  const filters = fromSearchParams(searchParams);
  const center = activeRegion.region?.coords ?? null;
  const radiusM = activeRegion.searchRadiusM;

  const countsQuery = useRegionCountsQuery(center, radiusM, filters);
  const regions = countsQuery.data ?? EMPTY_REGIONS;

  // 고른 동네의 목록. 지도는 반경으로 세지만, 하나를 고른 뒤에는 그 동네 안이 전부다.
  const selected = findRegion(regions, selectedRegionCode);
  const postsQuery = useSearchPostsQuery(
    selected === null ? null : { kind: 'region', regionCode: selected.regionCode },
    filters,
    DEFAULT_POST_SORT,
  );
  const posts: PostSummary[] = (postsQuery.data?.pages ?? []).flat();

  function handleSelect(regionCode: string): void {
    setSelectedRegionCode(function toggle(current: string | null): string | null {
      // 같은 마커를 다시 누르면 접는다. 지도를 다 가린 목록을 닫을 다른 길이 없다.
      return current === regionCode ? null : regionCode;
    });
  }

  function handleGuestRegionSelect(region: Region): void {
    activeRegion.setGuestRegion(region);
  }

  function handleLoadMore(): void {
    void postsQuery.fetchNextPage();
  }

  return (
    <main className="flex page-wide flex-col gap-4 p-6">
      <header className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-50">지도</h1>
          {/* 걸어 둔 조건을 그대로 들고 돌아간다. 지도에서 좁힌 것을 목록에서 이어 본다. */}
          <Link
            to={{ pathname: '/search', search: searchParams.toString() }}
            className="text-sm text-emerald-700 transition hover:underline dark:text-emerald-400"
          >
            목록으로 <ChevronRight size={16} />
          </Link>
        </div>
        <p className="truncate text-sm text-gray-500 dark:text-gray-400">
          {activeRegion.region?.fullName ?? '동네 미설정'} 중심 {toSearchRadiusLabel(radiusM)} 이내
        </p>
        {/*
          마커 하나가 글 하나가 아니라 동네 하나라는 것을 먼저 말한다. 말하지 않으면
          "석관동 27"을 보고 물건 하나의 위치를 찍어 준 것으로 읽는다.
        */}
        <p className="text-xs text-gray-500 dark:text-gray-400">
          마커 하나가 <b>동네 하나</b>입니다. 눌러서 그 동네 물건을 볼 수 있어요.
        </p>
      </header>

      {activeRegion.isLoading ? <PageSpinner message="동네를 확인하는 중입니다…" /> : null}

      {!activeRegion.isLoading && activeRegion.region === null ? <SearchRegionPrompt /> : null}

      {/*
        마커를 눌러도 지도의 중심은 그대로다(그쪽은 그 동네 목록을 펴는 일이다).
        게스트가 다른 곳을 중심으로 보려면 여기서 동네를 바꾸는 수밖에 없다.
      */}
      {activeRegion.isGuest && activeRegion.region !== null ? (
        <GuestRegionSwitcher
          region={activeRegion.region}
          isDefaultRegion={activeRegion.isDefaultRegion}
          onRegionSelect={handleGuestRegionSelect}
        />
      ) : null}

      {!activeRegion.isLoading && center !== null ? (
        <>
          <RegionMapCanvas
            center={center}
            radiusM={radiusM}
            regions={regions}
            selectedRegionCode={selectedRegionCode}
            onSelect={handleSelect}
          />

          {countsQuery.isLoading ? <p className={MESSAGE_CLASS}>주변 동네를 세는 중입니다…</p> : null}

          {countsQuery.isError ? (
            <p role="alert" className="py-6 text-center text-sm text-red-600 dark:text-red-400">
              주변 동네를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
            </p>
          ) : null}

          {!countsQuery.isLoading && !countsQuery.isError && regions.length === 0 ? (
            <p className={MESSAGE_CLASS}>
              {hasActiveFilter(filters) || filters.keyword !== ''
                ? '이 반경 안에는 조건에 맞는 물건이 없어요. 조건을 바꾸거나 반경을 넓혀 보세요.'
                : '이 반경 안에는 아직 올라온 물건이 없어요. 반경을 넓혀 보세요.'}
            </p>
          ) : null}

          <RegionCountList
            regions={regions}
            selectedRegionCode={selectedRegionCode}
            onSelect={handleSelect}
          />

          {selected !== null ? (
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
                {selected.dongName} · {selected.postCount}건
              </h2>

              <PostList
                posts={posts}
                isLoading={postsQuery.isLoading}
                isError={postsQuery.isError}
                // 조건은 지도에 들어올 때 이미 걸려 있다. 0건이면 그 조건 탓이다.
                isNarrowed={hasActiveFilter(filters) || filters.keyword !== ''}
                emptyMessage={`${selected.dongName}에는 조건에 맞는 물건이 없어요.`}
                hasNextPage={postsQuery.hasNextPage}
                isFetchingNextPage={postsQuery.isFetchingNextPage}
                onLoadMore={handleLoadMore}
              />
            </section>
          ) : null}
        </>
      ) : null}
    </main>
  );
}

export default MapPage;
