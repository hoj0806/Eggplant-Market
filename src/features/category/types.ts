/** 카테고리 한 칸. 대분류·소분류 모두 같은 모양이다(테이블도 하나다). */
export type Category = {
  id: number;
  name: string;
  slug: string;
};

/**
 * 대분류와 그 소분류들.
 *
 * 깊이는 2단계로 고정이다 — 당근마켓도 그 이상 내려가지 않고,
 * 게시물은 항상 소분류(잎)에 붙는다.
 */
export type CategoryTree = Category & {
  children: Category[];
};
