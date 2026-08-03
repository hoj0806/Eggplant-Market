import type { TradePlace } from '../place/types';

/** 0001의 post_status enum과 같은 값이다. */
export type PostStatus = 'selling' | 'reserved' | 'sold';

/** 글쓰기 폼이 들고 있는 값. 가격은 입력 중이라 아직 문자열이다. */
export type PostFormValues = {
  title: string;
  description: string;
  price: string;
  /** 소분류 id. 대분류만 골라서는 저장할 수 없다. */
  categoryId: number | null;
  imageFiles: File[];
  /** 선택 사항. 고르지 않으면 null. */
  tradePlace: TradePlace | null;
};

export type PostFieldName = 'title' | 'description' | 'price' | 'categoryId' | 'imageFiles';

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
  bumpedAt: string;
};
