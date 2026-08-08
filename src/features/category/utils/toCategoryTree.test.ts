import { findParentCategoryId, toCategoryTree, type CategoryRow } from './toCategoryTree';

const ROWS: CategoryRow[] = [
  { id: 2, name: '가구/인테리어', slug: 'furniture', parent_id: null, sort_order: 20 },
  { id: 1, name: '디지털/가전', slug: 'digital', parent_id: null, sort_order: 10 },
  { id: 14, name: '노트북', slug: 'digital-laptop', parent_id: 1, sort_order: 30 },
  { id: 13, name: '휴대폰', slug: 'digital-phone', parent_id: 1, sort_order: 10 },
  { id: 20, name: '침실가구', slug: 'furniture-bedroom', parent_id: 2, sort_order: 10 },
];

describe('toCategoryTree', function toCategoryTreeSuite() {
  it('대분류 아래에 소분류를 넣는다', function nestingCase() {
    const trees = toCategoryTree(ROWS);

    expect(trees).toHaveLength(2);
    expect(trees[0].name).toBe('디지털/가전');
    expect(trees[0].children.map(function toName(child) {
      return child.name;
    })).toEqual(['휴대폰', '노트북']);
  });

  it('대분류와 소분류 모두 sort_order 순으로 세운다', function sortingCase() {
    const trees = toCategoryTree(ROWS);

    expect(trees.map(function toSlug(tree) {
      return tree.slug;
    })).toEqual(['digital', 'furniture']);
  });

  it('부모가 없는 소분류는 버린다', function orphanCase() {
    const trees = toCategoryTree([
      ...ROWS,
      { id: 99, name: '떠도는분류', slug: 'orphan', parent_id: 404, sort_order: 10 },
    ]);

    const names = trees.flatMap(function toChildNames(tree) {
      return tree.children.map(function toName(child) {
        return child.name;
      });
    });
    expect(names).not.toContain('떠도는분류');
    expect(trees).toHaveLength(2);
  });

  it('빈 목록은 빈 트리다', function emptyCase() {
    expect(toCategoryTree([])).toEqual([]);
  });
});

describe('findParentCategoryId', function findParentSuite() {
  const trees = toCategoryTree(ROWS);

  it('소분류의 부모 대분류를 찾는다', function foundCase() {
    expect(findParentCategoryId(trees, 14)).toBe(1);
  });

  it('고른 것이 없으면 null이다', function nullCase() {
    expect(findParentCategoryId(trees, null)).toBeNull();
  });

  it('트리에 없는 id는 null이다', function unknownCase() {
    expect(findParentCategoryId(trees, 777)).toBeNull();
  });
});
