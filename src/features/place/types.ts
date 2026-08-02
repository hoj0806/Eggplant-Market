import type { RegionCoords } from '../region/types';

/**
 * 거래희망장소로 고른 장소(POI) 하나.
 *
 * 동네(`Region`)와 달리 여기 좌표는 **실제 그 장소의 좌표**다.
 * 공개해도 되는 값이라 그대로 저장한다 — 애초에 "여기서 만나자"고 알리려고 고르는 정보다.
 * (반대로 profiles의 동네 좌표를 대표 좌표로 뭉개는 이유는 `features/region/types.ts` 참고)
 */
export type TradePlace = {
  /** 카카오가 주는 장소 id. 화면 목록의 key로만 쓰고 DB에는 넣지 않는다. */
  id: string;
  /** 장소 이름. 예: "수유역 4번출구" */
  name: string;
  /** 주소. 도로명이 있으면 도로명, 없으면 지번. */
  addressName: string;
  coords: RegionCoords;
};
