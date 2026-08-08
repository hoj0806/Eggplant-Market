import {
  dedupeRegionsByCode,
  fromAddressSearchResult,
  fromRegionCodeResult,
  pickRegionCodeResult,
  toRegionFullName,
} from './toRegion';
import type {
  KakaoAddressDetail,
  KakaoAddressSearchResult,
  KakaoRegionCodeResult,
} from '../../../shared/types/kakaoMaps';
import type { Region } from '../types';

function createRegionCodeResult(
  overrides: Partial<KakaoRegionCodeResult> = {},
): KakaoRegionCodeResult {
  return {
    region_type: 'B',
    address_name: '서울특별시 강북구 수유동',
    region_1depth_name: '서울특별시',
    region_2depth_name: '강북구',
    region_3depth_name: '수유동',
    region_4depth_name: '',
    code: '1130510300',
    x: 127.0146,
    y: 37.6379,
    ...overrides,
  };
}

function createAddressDetail(overrides: Partial<KakaoAddressDetail> = {}): KakaoAddressDetail {
  return {
    address_name: '서울 강북구 수유동',
    region_1depth_name: '서울',
    region_2depth_name: '강북구',
    region_3depth_name: '수유동',
    b_code: '1130510300',
    h_code: '1130565000',
    x: '127.0146',
    y: '37.6379',
    ...overrides,
  };
}

function createAddressSearchResult(
  overrides: Partial<KakaoAddressSearchResult> = {},
): KakaoAddressSearchResult {
  return {
    address_name: '서울 강북구 수유동',
    address_type: 'REGION',
    x: '127.0146',
    y: '37.6379',
    address: createAddressDetail(),
    ...overrides,
  };
}

function createRegion(overrides: Partial<Region> = {}): Region {
  return {
    code: '1130510300',
    depth1: '서울특별시',
    depth2: '강북구',
    depth3: '수유동',
    fullName: '서울특별시 강북구 수유동',
    coords: { lat: 37.6379, lng: 127.0146 },
    ...overrides,
  };
}

describe('toRegionFullName', function fullNameSuite() {
  it('시·구·동을 공백으로 잇는다', function joinsCase() {
    expect(toRegionFullName('서울특별시', '강북구', '수유동')).toBe('서울특별시 강북구 수유동');
  });

  it('시군구가 없는 지역은 빈 칸을 남기지 않는다', function sejongCase() {
    expect(toRegionFullName('세종특별자치시', '', '한솔동')).toBe('세종특별자치시 한솔동');
  });
});

describe('pickRegionCodeResult', function pickSuite() {
  it('법정동(B)을 행정동(H)보다 먼저 고른다', function prefersLegalCase() {
    const results = [
      createRegionCodeResult({ region_type: 'H', code: '1130565000', region_3depth_name: '수유1동' }),
      createRegionCodeResult({ region_type: 'B', code: '1130510300', region_3depth_name: '수유동' }),
    ];

    expect(pickRegionCodeResult(results)?.code).toBe('1130510300');
  });

  it('법정동이 없으면 행정동으로 물러선다', function fallbackCase() {
    const results = [createRegionCodeResult({ region_type: 'H', code: '1130565000' })];

    expect(pickRegionCodeResult(results)?.region_type).toBe('H');
  });

  it('바다처럼 행정구역이 없는 좌표에서는 null이다', function emptyCase() {
    expect(pickRegionCodeResult([])).toBeNull();
  });
});

describe('fromRegionCodeResult', function fromRegionCodeSuite() {
  it('사용자 위치가 아니라 동네 대표 좌표를 쓴다', function usesRegionCoordsCase() {
    const region = fromRegionCodeResult(createRegionCodeResult({ x: 127.5, y: 37.5 }));

    expect(region.coords).toEqual({ lat: 37.5, lng: 127.5 });
    expect(region.fullName).toBe('서울특별시 강북구 수유동');
  });
});

describe('fromAddressSearchResult', function fromAddressSuite() {
  it('문자열 좌표를 숫자로 바꾼다', function parsesCoordsCase() {
    const region = fromAddressSearchResult(createAddressSearchResult());

    expect(region?.coords).toEqual({ lat: 37.6379, lng: 127.0146 });
    expect(region?.code).toBe('1130510300');
  });

  it('지번 주소가 없는(도로명만 잡힌) 결과는 버린다', function noAddressCase() {
    expect(fromAddressSearchResult(createAddressSearchResult({ address: null }))).toBeNull();
  });

  it('동 단위까지 내려가지 않은(시·구까지만 잡힌) 결과는 버린다', function noDongCase() {
    const withoutDong = createAddressSearchResult({
      address: createAddressDetail({ region_3depth_name: '' }),
    });

    expect(fromAddressSearchResult(withoutDong)).toBeNull();
  });

  it('좌표를 숫자로 읽을 수 없으면 버린다', function invalidCoordsCase() {
    const broken = createAddressSearchResult({
      address: createAddressDetail({ x: '', y: '' }),
    });

    expect(fromAddressSearchResult(broken)).toBeNull();
  });
});

describe('dedupeRegionsByCode', function dedupeSuite() {
  it('같은 법정동 코드는 하나만 남기고 순서를 지킨다', function dedupeCase() {
    const regions = [
      createRegion({ code: '1130510300' }),
      createRegion({ code: '1130510300' }),
      createRegion({ code: '1168010100', fullName: '서울특별시 강남구 역삼동' }),
    ];

    const result = dedupeRegionsByCode(regions);

    expect(result).toHaveLength(2);
    expect(result[0].code).toBe('1130510300');
    expect(result[1].code).toBe('1168010100');
  });
});
