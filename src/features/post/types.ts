import type { TradePlace } from '../place/types';

/** 0001의 post_status enum과 같은 값이다. */
export type PostStatus = 'selling' | 'reserved' | 'sold';

/**
 * 폼이 들고 있는 사진 한 장.
 *
 * 등록에서는 언제나 `new`뿐이지만 수정에서는 이미 올라가 있는 사진(`existing`)과
 * 방금 고른 사진이 한 줄에 섞인다. 둘을 배열 두 개로 나누지 않는 이유는 **순서**다 —
 * 첫 장이 목록 썸네일이라, 기존 사진 뒤에 새 사진을 붙이는 것 말고 다른 순서를 만들 수 없게 된다.
 */
export type PostImageItem =
  | { kind: 'existing'; url: string }
  | { kind: 'new'; file: File };

/** 글쓰기·수정 폼이 들고 있는 값. 가격은 입력 중이라 아직 문자열이다. */
export type PostFormValues = {
  title: string;
  description: string;
  price: string;
  /** 소분류 id. 대분류만 골라서는 저장할 수 없다. */
  categoryId: number | null;
  /** 화면에 보이는 순서 그대로. 첫 장이 썸네일이다. */
  images: PostImageItem[];
  /** 선택 사항. 고르지 않으면 null. */
  tradePlace: TradePlace | null;
};

export type PostFieldName = 'title' | 'description' | 'price' | 'categoryId' | 'images';

export type PostFieldErrors = Partial<Record<PostFieldName, string>>;

export type PostSeller = {
  id: string;
  nickname: string;
  avatarUrl: string | null;
  mannerTemp: number;
};

/** 예약자 또는 구매자. 매너온도는 아직 이 자리에서 보여줄 일이 없어 읽지 않는다. */
export type PostBuyer = {
  id: string;
  nickname: string;
  avatarUrl: string | null;
};

/** 상세 화면이 필요한 모든 것. 한 번의 조회로 채운다. */
export type PostDetail = {
  id: number;
  title: string;
  description: string;
  price: number;
  status: PostStatus;
  categoryId: number | null;
  categoryName: string | null;
  /** 판매자 동네 이름. 예: "서울특별시 강북구 수유동" */
  dongName: string | null;
  tradePlace: TradePlace | null;
  images: string[];
  viewCount: number;
  likeCount: number;
  /** 로그인하지 않았으면 언제나 false. */
  isLiked: boolean;
  createdAt: string;
  /**
   * 판매자가 **내용을 고친** 시각. 상태 변경·끌올·조회수·찜은 올리지 않는다(0020).
   * 한 번도 안 고쳤으면 `createdAt`과 같다 — `isEdited`가 그 비교를 한다.
   */
  updatedAt: string;
  /** 마지막 끌올 시각. 한 번도 안 했으면 등록 시각이다. 다음 끌올 가능 시각의 기준. */
  bumpedAt: string;
  /** 거래완료로 바뀐 시각. 그 전에는 null. */
  soldAt: string | null;
  seller: PostSeller;
  /** 예약중이면 예약자, 거래완료면 구매자, 판매중이면 null. */
  buyer: PostBuyer | null;
};

/** 목록 카드 한 장. 상세보다 훨씬 적게 읽는다. */
export type PostSummary = {
  id: number;
  title: string;
  price: number;
  status: PostStatus;
  thumbnailUrl: string | null;
  dongName: string | null;
  likeCount: number;
  viewCount: number;
  /**
   * 댓글 개수. **대댓글도 함께 센다** — 카드에 적히는 "댓글 3"은 그 글에 달린 말의 개수이지
   * 1단만 센 값이 아니다(0028).
   */
  commentCount: number;
  bumpedAt: string;
  /**
   * 검색 기준 좌표에서 이 글의 **동네까지**의 거리(미터). 법정동 기준으로 볼 때는 null이다.
   *
   * 물건까지의 거리가 아니다 — `posts.location`이 판매자 동네의 대표 좌표라(0005)
   * 같은 동 글은 이 값이 전부 같다. 거리순의 커서가 이 값이다.
   */
  distanceM: number | null;
};
