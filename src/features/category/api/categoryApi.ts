import { supabase } from '../../../shared/lib/supabaseClient';
import { toCategoryTree, type CategoryRow } from '../utils/toCategoryTree';
import type { CategoryTree } from '../types';

// 한 줄 리터럴이어야 한다. 문자열을 +로 이으면 리터럴 타입을 잃어
// supabase-js가 select 결과를 GenericStringError로 추론한다.
const CATEGORY_COLUMNS = 'id, name, slug, parent_id, sort_order';

/**
 * 카테고리 전체를 한 번에 받아 트리로 접는다.
 *
 * 대분류 12개 + 소분류 70여 개라 전부 받아도 작고, 대분류를 고를 때마다 소분류를
 * 다시 요청하면 select 조작이 눈에 띄게 굼떠진다.
 */
export async function fetchCategoryTree(): Promise<CategoryTree[]> {
  const { data, error } = await supabase
    .from('categories')
    .select(CATEGORY_COLUMNS)
    .order('sort_order', { ascending: true });

  if (error !== null) {
    throw error;
  }

  return toCategoryTree(data as CategoryRow[]);
}
