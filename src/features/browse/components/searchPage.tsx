import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import PostFilterBar from './postFilterBar';
import PostFilterPanel from './postFilterPanel';
import PostList from './postList';
import PostSearchField from './postSearchField';
import SearchRegionPrompt from './searchRegionPrompt';
import SearchScopeToggle from './searchScopeToggle';
import PageSpinner from '../../../shared/ui/pageSpinner';
import { useSearchPostsQuery } from '../../post/hooks/usePostQueries';
import { useActiveRegion } from '../hooks/useActiveRegion';
import {
  clearFilters,
  fromSearchParams,
  hasActiveFilter,
  scopeFromSearchParams,
  sortFromSearchParams,
  toSearchParams,
} from '../utils/postSearchFilters';
import { toPostSortOption } from '../utils/postSort';
import type { PostSearchArea } from '../../post/api/postApi';
import type { PostSummary } from '../../post/types';
import type { Region } from '../../region/types';
import type { PostSearchFilters, PostSearchScope, PostSortOption } from '../types';

/**
 * 화면이 고른 기준을 요청이 아는 범위로 옮긴다.
 *
 * 동네가 없으면 null이다 — 두 기준 모두 동네에서 나온다. 반경도 마찬가지다:
 * 재는 중심이 내 동네의 대표 좌표라(0005) 동네를 모르면 원을 그릴 자리가 없다.
 */
function toSearchArea(
  region: Region | null,
  scope: PostSearchScope,
  radiusM: number,
): PostSearchArea | null {
  if (region === null) {
    return null;
  }

  if (scope === 'radius') {
    return { kind: 'radius', coords: region.coords, radiusM };
  }

  return { kind: 'region', regionCode: region.code };
}

/**
 * 검색·필터 화면.
 *
 * 필터의 원본은 컴포넌트 state가 아니라 URL이다. 뒤로가기·새로고침·링크 공유가 그대로 동작하고,
 * "필터 초기화"도 쿼리를 다시 쓰는 것으로 끝난다.
 *
 * 동네는 조건이 아니라 전제다. 동네가 정해지기 전에는 목록 대신 동네를 고르라고 안내한다.
 */
function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const activeRegion = useActiveRegion();

  const filters = fromSearchParams(searchParams);
  const scope = scopeFromSearchParams(searchParams);
  const sort = sortFromSearchParams(searchParams);
  const area = toSearchArea(activeRegion.region, scope, activeRegion.searchRadiusM);
  const postsQuery = useSearchPostsQuery(area, filters, sort);

  function applyQuery(
    next: PostSearchFilters,
    nextSort: PostSortOption,
    nextScope: PostSearchScope,
    replace = false,
  ): void {
    setSearchParams(toSearchParams(next, nextSort, nextScope), { replace });
  }

  function handleKeywordChange(keyword: string): void {
    // 검색어는 history를 갈아 끼운다. 타이핑이 멈출 때마다 쌓으면
    // "노트북"을 치다 잠깐 쉰 횟수만큼 뒤로가기를 눌러야 화면을 벗어난다.
    applyQuery({ ...filters, keyword }, sort, scope, true);
  }

  function handleApplyFilters(next: PostSearchFilters): void {
    // 필터는 사용자가 명시적으로 누른 것이라 history에 쌓는다. 뒤로가기로 이전 조건에 돌아간다.
    applyQuery(next, sort, scope);
    setIsPanelOpen(false);
  }

  function handleResetFilters(): void {
    // 정렬과 기준은 남긴다. "필터 초기화"는 조건을 푸는 버튼이지 순서나 범위를 되돌리는 버튼이 아니다.
    applyQuery(clearFilters(filters), sort, scope);
  }

  function handleSortChange(nextSort: PostSortOption): void {
    applyQuery(filters, nextSort, scope);
  }

  /**
   * 기준을 바꾼다. 필터·검색어는 그대로 두고 범위만 넓히거나 좁힌다.
   *
   * 정렬은 한 번 더 거른다 — 거리순으로 보다가 "우리 동네"로 오면 그 정렬은 이 기준에서
   * 뜻이 없어지고, 그대로 보내면 서버가 거절해 목록이 오류가 된다(0024).
   * 그때만 최신순으로 되돌아간다.
   */
  function handleScopeChange(nextScope: PostSearchScope): void {
    applyQuery(filters, toPostSortOption(sort, nextScope), nextScope);
  }

  function handleTogglePanel(): void {
    setIsPanelOpen(function toggle(current: boolean): boolean {
      return !current;
    });
  }

  function handleGuestRegionSelect(region: Region): void {
    activeRegion.setGuestRegion(region);
  }

  function handleLoadMore(): void {
    void postsQuery.fetchNextPage();
  }

  // 페이지 단위로 쌓인 결과를 카드 목록 하나로 편다.
  const posts: PostSummary[] = (postsQuery.data?.pages ?? []).flat();
  // 정렬은 결과의 범위를 좁히지 않는다. 정렬만 바꾼 0건은 "동네에 글이 없다"는 뜻이다.
  const isNarrowed = filters.keyword !== '' || hasActiveFilter(filters);

  return (
    <main className="flex page-wide flex-col gap-4 p-6">
      <header className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-50">검색</h1>
          <div className="flex min-w-0 items-center gap-3">
            <span className="truncate text-sm text-gray-500 dark:text-gray-400">
              {activeRegion.region?.fullName ?? '동네 미설정'}
            </span>
            {/*
              걸어 둔 조건을 그대로 들고 간다. 지도가 다른 것을 세고 있으면 개수가 어긋나 보인다.
              동네가 없으면 지도도 그릴 중심이 없어 링크 자체를 내린다.
            */}
            {activeRegion.region !== null ? (
              <Link
                to={{ pathname: '/search/map', search: searchParams.toString() }}
                className="shrink-0 rounded-lg border border-gray-300 px-2.5 py-1 text-sm
                           font-semibold text-gray-700 transition hover:bg-gray-50
                           dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                지도
              </Link>
            ) : null}
          </div>
        </div>

        <PostSearchField keyword={filters.keyword} onKeywordChange={handleKeywordChange} />
      </header>

      {activeRegion.isLoading ? <PageSpinner message="동네를 확인하는 중입니다…" /> : null}

      {!activeRegion.isLoading && activeRegion.region === null ? (
        <SearchRegionPrompt isGuest={activeRegion.isGuest} onRegionSelect={handleGuestRegionSelect} />
      ) : null}

      {!activeRegion.isLoading && activeRegion.region !== null ? (
        <>
          <SearchScopeToggle
            value={scope}
            radiusM={activeRegion.searchRadiusM}
            isGuest={activeRegion.isGuest}
            onChange={handleScopeChange}
          />

          <PostFilterBar
            filters={filters}
            sort={sort}
            scope={scope}
            isPanelOpen={isPanelOpen}
            onTogglePanel={handleTogglePanel}
            onReset={handleResetFilters}
            onSortChange={handleSortChange}
          />

          {isPanelOpen ? (
            <PostFilterPanel
              // 적용된 필터가 바뀌면 draft도 그 값에서 다시 시작해야 한다.
              // 정렬은 뺀다 — 필터를 고르는 중에 순서를 바꿨다고 입력하던 값이 날아가면 안 된다.
              key={toSearchParams(filters).toString()}
              filters={filters}
              onApply={handleApplyFilters}
              onClose={handleTogglePanel}
            />
          ) : null}

          <PostList
            posts={posts}
            isLoading={postsQuery.isLoading}
            isError={postsQuery.isError}
            isNarrowed={isNarrowed}
            hasNextPage={postsQuery.hasNextPage}
            isFetchingNextPage={postsQuery.isFetchingNextPage}
            onLoadMore={handleLoadMore}
          />
        </>
      ) : null}
    </main>
  );
}

export default SearchPage;
