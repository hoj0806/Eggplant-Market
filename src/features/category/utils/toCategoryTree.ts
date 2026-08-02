// categories 테이블의 평면 행을 대분류-소분류 트리로 접는다. 순수 함수라 DB를 모른다.

import type { Category, CategoryTree } from '../types';

/** DB 컬럼 이름 그대로. 변환은 이 파일에서만 한다. */
export type CategoryRow = {
  id: number;
  name: string;
  slug: string;
  parent_id: number | null;
  sort_order: number;
};

function toCategory(row: CategoryRow): Category {
  return { id: row.id, name: row.name, slug: row.slug };
}

function bySortOrder(left: CategoryRow, right: CategoryRow): number {
  return left.sort_order - right.sort_order;
}

/**
 * parent_id가 null이면 대분류, 있으면 그 대분류의 소분류다.
 *
 * 정렬은 여기서 한 번 더 한다 — 쿼리에 order가 있어도 이 함수만 보고 순서를 믿을 수 있어야
 * 테스트와 호출부가 편하다.
 *
 * 부모를 찾지 못한 행(있어선 안 되지만 FK 없이 넣은 데이터 등)은 버린다.
 * 소속 없는 소분류를 대분류로 올려 보여주면 사용자가 더 헷갈린다.
 */
export function toCategoryTree(rows: ReadonlyArray<CategoryRow>): CategoryTree[] {
  const sorted = [...rows].sort(bySortOrder);

  const trees: CategoryTree[] = [];
  const treeById = new Map<number, CategoryTree>();

  for (const row of sorted) {
    if (row.parent_id === null) {
      const tree: CategoryTree = { ...toCategory(row), children: [] };
      treeById.set(row.id, tree);
      trees.push(tree);
    }
  }

  for (const row of sorted) {
    if (row.parent_id === null) {
      continue;
    }

    const parent = treeById.get(row.parent_id);
    if (parent !== undefined) {
      parent.children.push(toCategory(row));
    }
  }

  return trees;
}

/** 소분류 id로 그 부모 대분류를 찾는다. 없으면 null. */
export function findParentCategoryId(
  trees: ReadonlyArray<CategoryTree>,
  categoryId: number | null,
): number | null {
  if (categoryId === null) {
    return null;
  }

  for (const tree of trees) {
    const matched = tree.children.some(function hasChild(child: Category): boolean {
      return child.id === categoryId;
    });
    if (matched) {
      return tree.id;
    }
  }

  return null;
}
