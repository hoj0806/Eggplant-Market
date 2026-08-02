/**
 * 비로그인 사용자가 고른 동네를 브라우저에 남긴다.
 *
 * 로그인 사용자의 동네는 profiles에 있지만 게스트는 저장할 곳이 없다.
 * 검색할 때마다 동네를 다시 고르게 하면 쓸 수 없는 화면이 되므로 localStorage에 둔다.
 * sessionStorage가 아닌 이유: 탭을 닫아도 "내 동네"는 유지되는 것이 자연스럽다.
 *
 * 사용자가 직접 고칠 수 있는 값이라 형태를 하나도 믿지 않는다.
 * 깨진 값이면 동네를 고르지 않은 것으로 보고 넘어간다 — 여기서 던지면 앱 첫 화면이 죽는다.
 */

import type { Region, RegionCoords } from '../types';

const STORAGE_KEY = 'guestRegion';

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isCoords(value: unknown): value is RegionCoords {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<RegionCoords>;

  return Number.isFinite(candidate.lat) && Number.isFinite(candidate.lng);
}

/** 저장된 값이 지금의 Region 타입과 맞는지 본다. 한 칸이라도 어긋나면 버린다. */
export function isRegion(value: unknown): value is Region {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Partial<Region>;

  return (
    isString(candidate.code) &&
    candidate.code.length > 0 &&
    isString(candidate.depth1) &&
    isString(candidate.depth2) &&
    isString(candidate.depth3) &&
    isString(candidate.fullName) &&
    isCoords(candidate.coords)
  );
}

export function readStoredRegion(): Region | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      return null;
    }

    const parsed: unknown = JSON.parse(raw);

    return isRegion(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeStoredRegion(region: Region): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(region));
  } catch {
    // 시크릿 모드 등에서 저장이 막힐 수 있다. 이번 세션에만 기억되고 말 뿐이라 무시한다.
  }
}
