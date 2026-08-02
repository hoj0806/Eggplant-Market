import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import PostFilterBar from './postFilterBar';
import PostFilterPanel from './postFilterPanel';
import PostSearchField from './postSearchField';
import PostSearchResultList from './postSearchResultList';
import SearchRegionPrompt from './searchRegionPrompt';
import PageSpinner from '../../../shared/ui/pageSpinner';
import { useSearchPostsQuery } from '../../post/hooks/usePostQueries';
import { useActiveRegion } from '../hooks/useActiveRegion';
import { clearFilters, fromSearchParams, toSearchParams } from '../utils/postSearchFilters';
import type { PostSummary } from '../../post/types';
import type { Region } from '../../region/types';
import type { PostSearchFilters } from '../types';

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
  const regionCode = activeRegion.region?.code ?? null;
  const postsQuery = useSearchPostsQuery(regionCode, filters);

  function applyFilters(next: PostSearchFilters, replace = false): void {
    setSearchParams(toSearchParams(next), { replace });
  }

  function handleKeywordChange(keyword: string): void {
    // 검색어는 history를 갈아 끼운다. 타이핑이 멈출 때마다 쌓으면
    // "노트북"을 치다 잠깐 쉰 횟수만큼 뒤로가기를 눌러야 화면을 벗어난다.
    applyFilters({ ...filters, keyword }, true);
  }

  function handleApplyFilters(next: PostSearchFilters): void {
    // 필터는 사용자가 명시적으로 누른 것이라 history에 쌓는다. 뒤로가기로 이전 조건에 돌아간다.
    applyFilters(next);
    setIsPanelOpen(false);
  }

  function handleResetFilters(): void {
    applyFilters(clearFilters(filters));
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
  const isNarrowed = searchParams.toString() !== '';

  return (
    <main className="mx-auto flex min-h-screen max-w-screen-sm flex-col gap-4 p-6">
      <header className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <Link
            to="/"
            className="text-sm font-semibold text-gray-500 transition hover:text-gray-700
                       dark:text-gray-400 dark:hover:text-gray-200"
          >
            ‹ 홈
          </Link>
          <span className="truncate text-sm text-gray-500 dark:text-gray-400">
            {activeRegion.region?.fullName ?? '동네 미설정'}
          </span>
        </div>

        <PostSearchField keyword={filters.keyword} onKeywordChange={handleKeywordChange} />
      </header>

      {activeRegion.isLoading ? <PageSpinner message="동네를 확인하는 중입니다…" /> : null}

      {!activeRegion.isLoading && activeRegion.region === null ? (
        <SearchRegionPrompt isGuest={activeRegion.isGuest} onRegionSelect={handleGuestRegionSelect} />
      ) : null}

      {!activeRegion.isLoading && activeRegion.region !== null ? (
        <>
          <PostFilterBar
            filters={filters}
            isPanelOpen={isPanelOpen}
            onTogglePanel={handleTogglePanel}
            onReset={handleResetFilters}
          />

          {isPanelOpen ? (
            <PostFilterPanel
              // 적용된 필터가 바뀌면 draft도 그 값에서 다시 시작해야 한다.
              key={searchParams.toString()}
              filters={filters}
              onApply={handleApplyFilters}
              onClose={handleTogglePanel}
            />
          ) : null}

          <PostSearchResultList
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
