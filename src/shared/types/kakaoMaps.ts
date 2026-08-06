/**
 * 카카오맵 JS SDK 중 이 앱이 실제로 쓰는 부분만 타입으로 옮겨 적은 것.
 * `any` 금지 규칙 때문에 SDK를 쓰려면 최소한의 선언이 필요하다.
 *
 * 처음에는 "지도(Map)는 만들지 않는다"고 적혀 있었다. 동네 설정·거래장소 검색이
 * `services`의 Geocoder·Places만 썼기 때문이다. 지도 화면이 생기면서 그 전제가 바뀌어,
 * `Map`·`Circle`·`CustomOverlay`·`LatLngBounds`를 아래에 더했다.
 *
 * **로더는 그대로다.** `libraries=services`는 services를 **더** 얹는 옵션이지 지도를
 * 빼는 옵션이 아니다 — 지도 API는 어느 경우에나 함께 온다. backlog가 "로더 옵션부터
 * 넓혀야 한다"고 적어 둔 것은 절반만 맞았다. 넓힐 것은 타입 선언뿐이었다.
 *
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

/**
 * 지도 한 장.
 *
 * `level`은 낮을수록 확대다(1이 가장 가깝다). 우리는 `setBounds` 대신 반경으로 계산한
 * level을 직접 넣는다 — `toMapLevel`의 주석 참고.
 *
 * `relayout`은 지도가 만들어진 뒤 컨테이너 크기가 바뀌었을 때 쓴다. 이것을 부르지 않으면
 * 타일이 처음 크기 그대로 그려져 화면 절반이 회색으로 남는다.
 */
export type KakaoMap = {
  setCenter(latlng: KakaoLatLng): void;
  setLevel(level: number): void;
  relayout(): void;
};

export type KakaoMapOptions = {
  center: KakaoLatLng;
  level: number;
  /** 휠·더블클릭 확대를 막을 때 쓴다. 지금은 열어 둔다. */
  draggable?: boolean;
};

export type KakaoMapConstructor = {
  new (container: HTMLElement, options: KakaoMapOptions): KakaoMap;
};

/** 지도 위에 얹는 것들의 공통 동작. `setMap(null)`이 곧 제거다. */
export type KakaoOverlay = {
  setMap(map: KakaoMap | null): void;
};

/** 검색 반경을 눈에 보이게 그리는 원. */
export type KakaoCircleOptions = {
  center: KakaoLatLng;
  /** 미터. */
  radius: number;
  strokeWeight?: number;
  strokeColor?: string;
  strokeOpacity?: number;
  strokeStyle?: string;
  fillColor?: string;
  fillOpacity?: number;
};

export type KakaoCircleConstructor = {
  new (options: KakaoCircleOptions): KakaoOverlay;
};

/**
 * 마커 자리에 임의의 DOM을 얹는다. 기본 `Marker`를 쓰지 않는 이유는 **숫자를 적어야**
 * 하기 때문이다 — 이 지도의 마커 하나는 글 하나가 아니라 동네 하나이고, 그 동네에 몇 건이
 * 있는지가 마커의 내용이다.
 *
 * `content`에 HTMLElement를 넘기면 그 요소에 평범한 DOM 리스너를 달 수 있어
 * `kakao.maps.event`를 따로 쓸 필요가 없다.
 */
export type KakaoCustomOverlayOptions = {
  position: KakaoLatLng;
  content: HTMLElement;
  map?: KakaoMap;
  /** 0이면 content의 위쪽이 좌표에 붙는다. 기본값은 0.5(가운데). */
  yAnchor?: number;
  /** 겹칠 때의 순서. 고른 동네를 위로 올릴 때 쓴다. */
  zIndex?: number;
  clickable?: boolean;
};

export type KakaoCustomOverlayConstructor = {
  new (options: KakaoCustomOverlayOptions): KakaoOverlay;
};

export type KakaoMapsNamespace = {
  LatLng: KakaoLatLngConstructor;
  Map: KakaoMapConstructor;
  Circle: KakaoCircleConstructor;
  CustomOverlay: KakaoCustomOverlayConstructor;
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
