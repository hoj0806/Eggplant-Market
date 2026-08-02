import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { fetchCategoryTree } from '../api/categoryApi';
import type { CategoryTree } from '../types';

/** 카테고리는 시드 고정값이라 한 세션 동안 다시 받을 이유가 없다. */
const CATEGORY_STALE_TIME_MS = 60 * 60 * 1000;

export function categoryQueryKey(): ReadonlyArray<string> {
  return ['categories'];
}

export function useCategoriesQuery(): UseQueryResult<CategoryTree[], Error> {
  return useQuery<CategoryTree[], Error>({
    queryKey: categoryQueryKey(),
    queryFn: fetchCategoryTree,
    staleTime: CATEGORY_STALE_TIME_MS,
  });
}
