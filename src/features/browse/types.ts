/**
 * 목록에 거는 조건 전부. 서로 겹쳐서(AND) 적용된다.
 *
 * 동네는 여기에 없다 — 조건이 아니라 전제다. 검색과 필터는 언제나 내 동네 안에서만 돈다.
 */
export type PostSearchFilters = {
  /** 제품 이름(title)과 게시물 내용(description)에서 찾는다. 빈 문자열이면 검색어 없음. */
  keyword: string;
  /** 대분류·소분류 어느 쪽이든 들어올 수 있다. 대분류면 그 아래 소분류 글이 모두 걸린다. */
  categoryId: number | null;
  /** 이 가격 이상. null이면 하한 없음. */
  minPrice: number | null;
  /** 이 가격 이하. null이면 상한 없음. */
  maxPrice: number | null;
  /** 켜면 판매완료를 숨긴다. 예약중은 남는다. */
  availableOnly: boolean;
};
