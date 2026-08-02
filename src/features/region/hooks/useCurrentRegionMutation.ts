import { useMutation, type UseMutationResult } from '@tanstack/react-query';
import { coordsToRegion } from '../api/regionApi';
import { getCurrentCoords } from '../utils/getCurrentCoords';
import type { Region } from '../types';

/**
 * 현재 위치로 동네를 찾는다.
 * 읽어 온 좌표는 어느 동네인지 알아내는 데만 쓰고 저장하지 않는다.
 * 실패해도 재시도하지 않는다 — 권한 거부는 다시 물어도 같은 답이 온다.
 */
export function useCurrentRegionMutation(): UseMutationResult<Region, Error, void> {
  return useMutation<Region, Error, void>({
    mutationFn: function locateCurrentRegion(): Promise<Region> {
      return getCurrentCoords().then(coordsToRegion);
    },
  });
}
