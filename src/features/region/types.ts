/** 위경도 한 쌍. 카카오 SDK는 (x=경도, y=위도) 순서라 변환할 때 주의해야 한다. */
export type RegionCoords = {
  lat: number;
  lng: number;
};

/**
 * 사용자의 동네. 법정동(카카오 region_type = 'B') 기준이다.
 *
 * `coords`는 **사용자의 현재 위치가 아니라 동네의 대표 좌표**다.
 * profiles는 누구나 조회할 수 있는 테이블(RLS: `profiles_select using (true)`)이라
 * 정확한 GPS 좌표를 저장하면 집 위치가 그대로 공개된다.
 */
export type Region = {
  /** 법정동 코드 10자리. 이름은 겹칠 수 있어도 코드는 겹치지 않는다. */
  code: string;
  /** 시/도. 예: "서울특별시" */
  depth1: string;
  /** 시군구. 예: "강북구" */
  depth2: string;
  /** 읍면동. 예: "수유동" */
  depth3: string;
  /** 화면·DB에 쓰는 전체 이름. 예: "서울특별시 강북구 수유동" */
  fullName: string;
  coords: RegionCoords;
};

/**
 * 동네 설정에서 사용자에게 다르게 안내해야 하는 실패들.
 * 문자열 코드로 다루는 이유는 `utils/regionErrors.ts` 주석 참고.
 */
export type RegionErrorCode =
  | 'insecure_origin'
  | 'geolocation_unsupported'
  | 'geolocation_denied'
  | 'geolocation_unavailable'
  | 'geolocation_timeout'
  | 'sdk_key_missing'
  | 'sdk_load_failed'
  | 'geocode_zero_result'
  | 'geocode_failed';
