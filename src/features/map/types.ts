/**
 * 지도 마커 한 개 = 동네 한 곳.
 *
 * 글 한 건이 아니다. `posts.location`이 판매자 동네의 대표 좌표라(0005) 같은 동 글은
 * 좌표가 사실상 한 점이어서, 글마다 핀을 찍으면 한 자리에 겹쳐 쌓인다(0025).
 *
 * `coords`는 그 동네 글들이 가리키는 좌표의 **평균**이다. 같은 법정동이라도 동네를 고른
 * 방법에 따라 좌표가 갈리기 때문이다 — GPS로 잡으면 카카오의 동 대표 좌표지만 이름으로
 * 검색하면 그 지번의 좌표가 들어온다(`fromAddressSearchResult`).
 */
export type RegionPostCount = {
  /** 법정동 코드 10자리. 마커의 신원이자 목록을 다시 불러오는 열쇠다. */
  regionCode: string;
  /**
   * 화면에 적는 동네 이름. 같은 코드라도 표기가 갈릴 수 있어 서버가 최빈값을 골라 준다
   * ("서울특별시 강북구 수유동" ∥ "서울 강북구 수유동" — 카카오가 그렇게 내려준다).
   */
  dongName: string;
  coords: {
    lat: number;
    lng: number;
  };
  postCount: number;
  /** 내 동네 좌표에서 위 평균점까지의 거리(미터). 마커가 놓인 자리에서 잰 값이다. */
  distanceM: number;
};

/**
 * 지도에서 나는 실패 중 사용자에게 다르게 말해야 하는 것.
 *
 * 동네 설정(`RegionErrorCode`)과 값이 겹치지만 따로 둔다. 저쪽은 GPS·지오코딩까지 다루고
 * 여기는 SDK를 띄우는 일뿐이라, 한 타입으로 묶으면 어느 화면도 자기가 안 내는 코드를
 * 함께 이고 다니게 된다.
 */
export type MapErrorCode = 'sdk_key_missing' | 'sdk_load_failed';
