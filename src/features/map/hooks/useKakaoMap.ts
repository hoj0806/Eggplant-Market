import { useEffect, useRef, useState, type RefObject } from 'react';
import { loadKakaoMaps } from '../../../shared/lib/kakaoMapLoader';
import { toMapLevel } from '../utils/mapLevel';
import { toMapErrorCode } from '../utils/mapErrorMessage';
import type { KakaoMap, KakaoMapsNamespace } from '../../../shared/types/kakaoMaps';
import type { RegionCoords } from '../../region/types';
import type { MapErrorCode } from '../types';

export type KakaoMapState = {
  /** 지도를 붙일 자리. 이 ref를 단 요소에 SDK가 타일을 그린다. */
  containerRef: RefObject<HTMLDivElement | null>;
  /** 지도가 준비되기 전에는 null. 마커를 얹는 쪽이 이 값을 기다린다. */
  map: KakaoMap | null;
  maps: KakaoMapsNamespace | null;
  isLoading: boolean;
  errorCode: MapErrorCode | null;
  retry(): void;
};

/**
 * 지도 한 장을 띄우고 살려 둔다. SDK에 닿는 곳은 이 훅과 `mapApi`뿐이다.
 *
 * **지도는 한 번만 만든다.** 중심이나 반경이 바뀔 때 다시 만들지 않고 `setCenter`·`setLevel`로
 * 옮긴다 — 다시 만들면 타일을 처음부터 다시 받아 화면이 한 번 하얘지고, 사용자가 끌어 둔
 * 위치도 함께 날아간다.
 *
 * 로더는 실패한 시도를 기억하지 않으므로(`loadPromise`를 null로 되돌린다) `retry`는 그냥
 * 다시 부르면 된다.
 */
export function useKakaoMap(center: RegionCoords | null, radiusM: number): KakaoMapState {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<KakaoMap | null>(null);

  const [maps, setMaps] = useState<KakaoMapsNamespace | null>(null);
  const [map, setMap] = useState<KakaoMap | null>(null);
  const [errorCode, setErrorCode] = useState<MapErrorCode | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(
    function createMap(): () => void {
      // 중심이 없으면 그릴 것이 없다. 컨테이너도 아직 화면에 없다.
      if (center === null) {
        return function noop(): void {};
      }

      // StrictMode의 이중 effect나 늦게 온 응답이 이미 떠난 화면에 지도를 심지 않게 한다.
      let isActive = true;

      setErrorCode(null);

      loadKakaoMaps()
        .then(function drawMap(namespace: KakaoMapsNamespace): void {
          const container = containerRef.current;
          if (!isActive || container === null) {
            return;
          }

          setMaps(namespace);

          if (mapRef.current === null) {
            mapRef.current = new namespace.Map(container, {
              center: new namespace.LatLng(center.lat, center.lng),
              level: toMapLevel(radiusM),
            });
          }

          setMap(mapRef.current);
        })
        .catch(function handleFailure(error: unknown): void {
          if (isActive) {
            setErrorCode(toMapErrorCode(error));
          }
        });

      return function cancel(): void {
        isActive = false;
      };
    },
    // `attempt`는 다시 시도를 위한 것이다. center·radius 변화는 아래 effect가 맡는다.
    [center, radiusM, attempt],
  );

  useEffect(
    function moveMap(): void {
      const current = mapRef.current;
      if (current === null || maps === null || center === null) {
        return;
      }

      current.setCenter(new maps.LatLng(center.lat, center.lng));
      current.setLevel(toMapLevel(radiusM));
      // 지도를 만든 뒤 컨테이너가 커졌으면 타일이 처음 크기 그대로 남는다.
      current.relayout();
    },
    [maps, center, radiusM],
  );

  function retry(): void {
    setAttempt(function next(current: number): number {
      return current + 1;
    });
  }

  return {
    containerRef,
    map,
    maps,
    isLoading: map === null && errorCode === null && center !== null,
    errorCode,
    retry,
  };
}
