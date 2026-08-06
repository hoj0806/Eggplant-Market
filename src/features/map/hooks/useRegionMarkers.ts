import { useEffect, useRef } from 'react';
import { createRegionMarkerElement } from '../utils/regionMarkerElement';
import type {
  KakaoMap,
  KakaoMapsNamespace,
  KakaoOverlay,
} from '../../../shared/types/kakaoMaps';
import type { RegionCoords } from '../../region/types';
import type { RegionPostCount } from '../types';

const CIRCLE_STROKE_COLOR = '#059669';
const CIRCLE_FILL_COLOR = '#10b981';

/** 고른 마커가 이웃 마커에 가리지 않게 위로 올린다. */
const SELECTED_MARKER_Z_INDEX = 10;

type RegionMarkersParams = {
  map: KakaoMap | null;
  maps: KakaoMapsNamespace | null;
  center: RegionCoords | null;
  radiusM: number;
  regions: ReadonlyArray<RegionPostCount>;
  selectedRegionCode: string | null;
  onSelect(regionCode: string): void;
};

/**
 * 마커와 반경 원을 지도에 얹는다.
 *
 * **매번 전부 걷어내고 다시 얹는다.** 바뀐 것만 골라 고치는 편이 빨라 보이지만, 마커는
 * 많아야 수십 개이고 무엇이 바뀌었는지를 재는 코드가 마커를 그리는 코드보다 길어진다.
 * 그리고 한 번이라도 어긋나면 **지도에 유령 마커가 남는다** — 목록에서는 사라졌는데
 * 지도에는 있는 상태라, 눌러도 아무 일이 일어나지 않는 자리가 생긴다.
 *
 * 고른 동네가 바뀌어도 다시 얹는다. 마커의 생김새가 선택 여부에 달려 있어서다.
 */
export function useRegionMarkers(params: RegionMarkersParams): void {
  /**
   * 리스너가 늘 최신 콜백을 부르게 한다.
   *
   * `onSelect`를 deps에 넣을 수 없어서다 — 부르는 쪽에서 인라인으로 만드는 함수라 렌더마다
   * 신원이 달라지고, 그러면 **렌더할 때마다 마커를 전부 걷었다 다시 얹는다.**
   */
  const onSelectRef = useRef(params.onSelect);
  onSelectRef.current = params.onSelect;

  const { map, maps, center, radiusM, regions, selectedRegionCode } = params;

  useEffect(
    function drawOverlays(): () => void {
      if (map === null || maps === null || center === null) {
        return function noop(): void {};
      }

      const overlays: KakaoOverlay[] = [];

      // 반경 원이 먼저다. 마커 밑에 깔려야 마커를 가리지 않는다.
      overlays.push(
        new maps.Circle({
          center: new maps.LatLng(center.lat, center.lng),
          radius: radiusM,
          strokeWeight: 2,
          strokeColor: CIRCLE_STROKE_COLOR,
          strokeOpacity: 0.8,
          strokeStyle: 'shortdash',
          fillColor: CIRCLE_FILL_COLOR,
          fillOpacity: 0.08,
        }),
      );

      for (const region of regions) {
        const isSelected = region.regionCode === selectedRegionCode;

        overlays.push(
          new maps.CustomOverlay({
            position: new maps.LatLng(region.coords.lat, region.coords.lng),
            content: createRegionMarkerElement(region, isSelected, {
              onSelect: function handleSelect(regionCode: string): void {
                onSelectRef.current(regionCode);
              },
            }),
            // 풍선의 아래 끝이 좌표에 붙어야 "이 자리"를 가리킨다.
            yAnchor: 1,
            zIndex: isSelected ? SELECTED_MARKER_Z_INDEX : 1,
            clickable: true,
          }),
        );
      }

      for (const overlay of overlays) {
        overlay.setMap(map);
      }

      // 이번에 얹은 것만 걷는다. 다음 effect가 돌기 전에 반드시 한 번 불린다.
      return function clear(): void {
        for (const overlay of overlays) {
          overlay.setMap(null);
        }
      };
    },
    [map, maps, center, radiusM, regions, selectedRegionCode],
  );
}
