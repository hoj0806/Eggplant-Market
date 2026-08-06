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

/**
 * 목록을 무엇으로 모을 것인가. 필터·정렬과 성격이 다르다 —
 * 필터는 "우리 동네 안에서 무엇을", 정렬은 "어떤 순서로"인데 이것은 **어디까지가 우리 동네인가**다.
 *
 * `region`은 지금까지의 유일한 기준이었다(법정동 코드 일치). `radius`는 내 동네 대표 좌표에서
 * 반경(`profiles.search_radius_m`) 안에 드는 글이다. 0024가 둘을 병행으로 열었다.
 *
 * 반경이 실제로 고르는 것은 **글이 아니라 동네**다 — `posts.location`이 판매자의 정확한
 * 위치가 아니라 그 사람 동네의 대표 좌표라(0005), 같은 동 글은 거리가 전부 같다.
 * 그래서 "1km"는 "1km 안에 있는 물건"이 아니라 "1km 안에 중심이 있는 동네의 물건"이다.
 */
export type PostSearchScope = 'region' | 'radius';

/**
 * 목록 정렬 기준. 필터와 달리 결과의 **범위가 아니라 순서**만 바꾼다.
 *
 * 값은 서버(`search_posts`의 `p_sort`)가 아는 이름 그대로다. 화면용 이름을 따로 두고
 * 요청 직전에 옮기면, 정렬을 하나 더 붙일 때 고칠 곳이 두 군데가 된다.
 *
 * `distance`만 앞의 다섯과 다르다 — **기준이 `radius`일 때만 고를 수 있다.**
 * 잴 중심이 없으면 정렬값이 전부 null인데 화면에는 "가까운 순"이라고 적히기 때문이고,
 * 서버도 같은 이유로 거절한다(0024).
 */
export type PostSortOption =
  | 'latest'
  | 'popular'
  | 'likes'
  | 'price_asc'
  | 'price_desc'
  | 'distance';
