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

export type KakaoMapsNamespace = {
  services: {
    Geocoder: KakaoGeocoderConstructor;
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
