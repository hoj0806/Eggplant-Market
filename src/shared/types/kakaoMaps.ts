/**
 * 카카오맵 JS SDK 중 이 앱이 실제로 쓰는 부분만 타입으로 옮겨 적은 것.
 * `any` 금지 규칙 때문에 SDK를 쓰려면 최소한의 선언이 필요하다.
 *
 * 지도(Map)는 만들지 않는다 — 동네 설정은 `libraries=services`의 Geocoder만 사용한다.
 * 콜백·생성자 타입은 화살표 금지 규칙에 맞춰 호출 시그니처 형태로 적었다.
 */

export type KakaoStatus = 'OK' | 'ZERO_RESULT' | 'ERROR';

/** H = 행정동, B = 법정동. 이 앱은 B(법정동)를 기준으로 삼는다. */
export type KakaoRegionType = 'H' | 'B';

/** coord2RegionCode 결과 한 건. */
export type KakaoRegionCodeResult = {
  region_type: KakaoRegionType;
  address_name: string;
  region_1depth_name: string;
  region_2depth_name: string;
  region_3depth_name: string;
  region_4depth_name: string;
  /** region_type이 B면 법정동 코드, H면 행정동 코드. */
  code: string;
  x: number;
  y: number;
};

/** addressSearch 결과의 지번 주소 부분. 도로명만 잡힌 결과에서는 null이다. */
export type KakaoAddressDetail = {
  address_name: string;
  region_1depth_name: string;
  region_2depth_name: string;
  region_3depth_name: string;
  /** 법정동 코드. */
  b_code: string;
  /** 행정동 코드. 지번 주소가 아닌 경우 빈 문자열일 수 있다. */
  h_code: string;
  x: string;
  y: string;
};

/** addressSearch 결과 한 건. 좌표는 문자열로 온다. */
export type KakaoAddressSearchResult = {
  address_name: string;
  address_type: string;
  x: string;
  y: string;
  address: KakaoAddressDetail | null;
};

export type KakaoCoord2RegionCodeCallback = {
  (result: ReadonlyArray<KakaoRegionCodeResult>, status: KakaoStatus): void;
};

export type KakaoAddressSearchCallback = {
  (result: ReadonlyArray<KakaoAddressSearchResult>, status: KakaoStatus): void;
};

export type KakaoGeocoder = {
  /** 인자 순서가 (경도, 위도)다. 위/경도 순서를 뒤집기 쉬우니 주의. */
  coord2RegionCode(x: number, y: number, callback: KakaoCoord2RegionCodeCallback): void;
  addressSearch(query: string, callback: KakaoAddressSearchCallback): void;
};

export type KakaoGeocoderConstructor = {
  new (): KakaoGeocoder;
};

/**
 * 장소(POI) 검색 결과 한 건. 거래희망장소를 고를 때 쓴다.
 * 좌표는 주소 검색과 마찬가지로 문자열(x=경도, y=위도)로 온다.
 */
export type KakaoPlaceSearchResult = {
  id: string;
  place_name: string;
  address_name: string;
  /** 도로명 주소. 없는 장소도 있어 빈 문자열로 온다. */
  road_address_name: string;
  category_group_name: string;
  x: string;
  y: string;
};

/** keywordSearch 콜백의 세 번째 인자. 이 앱은 첫 페이지만 쓰므로 형태만 적어 둔다. */
export type KakaoPagination = {
  totalCount: number;
};

export type KakaoKeywordSearchCallback = {
  (
    result: ReadonlyArray<KakaoPlaceSearchResult>,
    status: KakaoStatus,
    pagination: KakaoPagination,
  ): void;
};

/** 좌표 객체. 값을 직접 읽지는 않고 검색 옵션에 그대로 넘기기만 한다. */
export type KakaoLatLng = {
  getLat(): number;
  getLng(): number;
};

export type KakaoLatLngConstructor = {
  new (lat: number, lng: number): KakaoLatLng;
};

/** 검색 중심·반경·정렬. 주지 않으면 전국에서 뽑혀 내 동네 장소가 밀린다. */
export type KakaoKeywordSearchOptions = {
  location?: KakaoLatLng;
  /** 미터. 카카오가 허용하는 최댓값은 20000이다. */
  radius?: number;
  sort?: string;
  size?: number;
};

export type KakaoPlaces = {
  keywordSearch(
    keyword: string,
    callback: KakaoKeywordSearchCallback,
    options?: KakaoKeywordSearchOptions,
  ): void;
};

export type KakaoPlacesConstructor = {
  new (): KakaoPlaces;
};

export type KakaoMapsNamespace = {
  LatLng: KakaoLatLngConstructor;
  services: {
    Geocoder: KakaoGeocoderConstructor;
    Places: KakaoPlacesConstructor;
    /** 정렬 상수. 문자열을 직접 넣지 말고 이 값을 쓴다. */
    SortBy: {
      ACCURACY: string;
      DISTANCE: string;
    };
  };
  /** autoload=false로 받은 SDK를 실제로 초기화한다. */
  load(callback: KakaoMapsLoadCallback): void;
};

export type KakaoMapsLoadCallback = {
  (): void;
};

declare global {
  interface Window {
    kakao?: {
      maps?: KakaoMapsNamespace;
    };
  }
}
