import { useKakaoMap } from '../hooks/useKakaoMap';
import { useRegionMarkers } from '../hooks/useRegionMarkers';
import { toMapErrorMessage } from '../utils/mapErrorMessage';
import type { RegionCoords } from '../../region/types';
import type { RegionPostCount } from '../types';

type RegionMapCanvasProps = {
  center: RegionCoords;
  radiusM: number;
  regions: ReadonlyArray<RegionPostCount>;
  selectedRegionCode: string | null;
  onSelect(regionCode: string): void;
};

/**
 * 지도 한 장과 그 위의 동네 마커들.
 *
 * 높이를 여기서 정한다. 지도는 **자기 컨테이너 크기만큼** 그려지는데, 부모가 크기를 안 주면
 * 0px짜리 회색 칸이 남는다. 흔한 함정이라 바깥에 맡기지 않는다.
 */
function RegionMapCanvas(props: RegionMapCanvasProps) {
  const mapState = useKakaoMap(props.center, props.radiusM);

  useRegionMarkers({
    map: mapState.map,
    maps: mapState.maps,
    center: props.center,
    radiusM: props.radiusM,
    regions: props.regions,
    selectedRegionCode: props.selectedRegionCode,
    onSelect: props.onSelect,
  });

  if (mapState.errorCode !== null) {
    return (
      <div
        className="flex h-72 flex-col items-center justify-center gap-3 rounded-2xl border
                   border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900"
      >
        <p role="alert" className="px-6 text-center text-sm text-red-600 dark:text-red-400">
          {toMapErrorMessage(mapState.errorCode)}
        </p>
        <button
          type="button"
          onClick={mapState.retry}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold
                     text-gray-700 transition hover:bg-gray-100
                     dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="relative h-72 overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800">
      {/*
        SDK가 이 요소 안에 타일을 그린다. 로딩 문구를 이 요소 **안**이 아니라 위에 겹치는
        이유는, 안에 넣으면 지도가 그려지는 순간 SDK가 자식을 통째로 갈아 끼워 React가
        모르는 사이에 노드가 사라지기 때문이다.
      */}
      <div ref={mapState.containerRef} className="h-full w-full" />

      {mapState.isLoading ? (
        <p
          className="absolute inset-0 flex items-center justify-center bg-gray-50 text-sm
                     text-gray-500 dark:bg-gray-900 dark:text-gray-400"
        >
          지도를 불러오는 중입니다…
        </p>
      ) : null}
    </div>
  );
}

export default RegionMapCanvas;
