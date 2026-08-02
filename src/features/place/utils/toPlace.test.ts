import { dedupePlacesById, fromPlaceSearchResult } from './toPlace';
import type { KakaoPlaceSearchResult } from '../../../shared/types/kakaoMaps';
import type { TradePlace } from '../types';

function makeResult(overrides: Partial<KakaoPlaceSearchResult> = {}): KakaoPlaceSearchResult {
  return {
    id: '1234',
    place_name: '수유역 4번출구',
    address_name: '서울 강북구 수유동 174-1',
    road_address_name: '서울 강북구 도봉로 338',
    category_group_name: '지하철역',
    x: '127.0254',
    y: '37.6379',
    ...overrides,
  };
}

describe('fromPlaceSearchResult', function fromPlaceSuite() {
  it('도로명 주소가 있으면 도로명을 쓴다', function roadAddressCase() {
    const place = fromPlaceSearchResult(makeResult());

    expect(place).toEqual({
      id: '1234',
      name: '수유역 4번출구',
      addressName: '서울 강북구 도봉로 338',
      coords: { lat: 37.6379, lng: 127.0254 },
    });
  });

  it('도로명 주소가 없으면 지번 주소로 물러선다', function jibunAddressCase() {
    const place = fromPlaceSearchResult(makeResult({ road_address_name: '' }));

    expect(place?.addressName).toBe('서울 강북구 수유동 174-1');
  });

  it('좌표가 비어 있으면 쓸 수 없다', function emptyCoordsCase() {
    expect(fromPlaceSearchResult(makeResult({ x: '', y: '' }))).toBeNull();
  });

  it('좌표가 숫자가 아니면 쓸 수 없다', function invalidCoordsCase() {
    expect(fromPlaceSearchResult(makeResult({ x: '동쪽' }))).toBeNull();
  });

  it('이름이 없으면 쓸 수 없다', function emptyNameCase() {
    expect(fromPlaceSearchResult(makeResult({ place_name: '  ' }))).toBeNull();
  });
});

describe('dedupePlacesById', function dedupeSuite() {
  const first: TradePlace = {
    id: 'a',
    name: '수유역',
    addressName: '서울 강북구 도봉로 338',
    coords: { lat: 37.6, lng: 127.0 },
  };
  const duplicate: TradePlace = { ...first, name: '수유역(중복)' };
  const other: TradePlace = { ...first, id: 'b', name: '강북구청' };

  it('먼저 나온 장소를 남긴다', function keepFirstCase() {
    expect(dedupePlacesById([first, duplicate, other])).toEqual([first, other]);
  });
});
