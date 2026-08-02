/**
 * 카카오 장소(POI) 검색을 감싸는 유일한 자리.
 *
 * 동네 검색(features/region)과 나란한 구조다. 다른 점은 부르는 API뿐이다 —
 * 동네는 Geocoder(주소), 거래희망장소는 Places(장소 이름)를 쓴다.
 *
 * 실패 코드와 문구는 region의 것을 그대로 쓴다. SDK 로드 실패·앱키 누락처럼
 * 사용자가 겪는 문제와 해야 할 조치가 완전히 같아서 따로 만들 이유가 없다.
 *
 * 이 모듈만 kakaoMapLoader(=import.meta.env)에 닿는다. ts-jest는 CommonJS로 옮기면서
 * import.meta를 그대로 뱉기 때문에, 컴포넌트 테스트는 이 모듈을 통째로 jest.mock 한다.
 */
import { KAKAO_KEY_MISSING_CODE, loadKakaoMaps } from '../../../shared/lib/kakaoMapLoader';
import { toRegionError } from '../../region/utils/regionErrors';
import { dedupePlacesById, fromPlaceSearchResult } from '../utils/toPlace';
import type { KakaoMapsNamespace, KakaoPlaces } from '../../../shared/types/kakaoMaps';
import type { RegionCoords } from '../../region/types';
import type { TradePlace } from '../types';

/** 카카오가 허용하는 최대 반경. 내 동네에서 만날 장소를 찾는 용도라 넉넉하다. */
const SEARCH_RADIUS_M = 20000;
/** 한 페이지 최대치. 페이지를 넘기지 않고 첫 페이지만 쓴다. */
const MAX_PLACE_RESULTS = 15;

type PlacesContext = {
  places: KakaoPlaces;
  maps: KakaoMapsNamespace;
};

/** Places 인스턴스는 한 번만 만들어 재사용한다. 실패하면 비워 다음 시도가 다시 붙게 한다. */
let contextPromise: Promise<PlacesContext> | null = null;

function isKeyMissing(error: unknown): boolean {
  if (error === null || typeof error !== 'object') {
    return false;
  }

  return (error as { code?: unknown }).code === KAKAO_KEY_MISSING_CODE;
}

function loadPlacesContext(): Promise<PlacesContext> {
  if (contextPromise === null) {
    contextPromise = loadKakaoMaps()
      .then(function createPlaces(maps): PlacesContext {
        return { places: new maps.services.Places(), maps };
      })
      .catch(function forgetFailedLoad(error: unknown): never {
        contextPromise = null;
        throw toRegionError(isKeyMissing(error) ? 'sdk_key_missing' : 'sdk_load_failed');
      });
  }

  return contextPromise;
}

function isTradePlace(place: TradePlace | null): place is TradePlace {
  return place !== null;
}

/**
 * 검색 중심을 준다. 옵션 없이 검색하면 전국에서 15건이 뽑혀
 * "우리 동네 스타벅스"를 찾으려다 엉뚱한 도시 결과만 보게 된다.
 */
function toSearchOptions(context: PlacesContext, center: RegionCoords | null) {
  if (center === null) {
    return { size: MAX_PLACE_RESULTS };
  }

  return {
    location: new context.maps.LatLng(center.lat, center.lng),
    radius: SEARCH_RADIUS_M,
    sort: context.maps.services.SortBy.DISTANCE,
    size: MAX_PLACE_RESULTS,
  };
}

/**
 * 장소 이름 검색. 결과가 없는 것은 오류가 아니라 빈 목록이다.
 * `center`는 사용자의 동네 좌표를 넘긴다(동네를 아직 모르면 null).
 */
export async function searchPlacesByKeyword(
  query: string,
  center: RegionCoords | null,
): Promise<TradePlace[]> {
  const context = await loadPlacesContext();

  return new Promise(function resolvePlaces(resolve, reject): void {
    context.places.keywordSearch(
      query,
      function handlePlaces(result, status): void {
        if (status === 'ZERO_RESULT') {
          resolve([]);
          return;
        }
        if (status !== 'OK') {
          reject(toRegionError('geocode_failed'));
          return;
        }

        const places = result.map(fromPlaceSearchResult).filter(isTradePlace);

        resolve(dedupePlacesById(places));
      },
      toSearchOptions(context, center),
    );
  });
}
