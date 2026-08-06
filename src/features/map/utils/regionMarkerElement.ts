import type { RegionPostCount } from '../types';

/**
 * 마커 하나를 DOM으로 짓는다.
 *
 * React 컴포넌트가 아닌 이유는 `CustomOverlay`가 **HTMLElement를 받기 때문**이다.
 * 포털로 React를 밀어 넣을 수도 있지만, 마커는 지도가 살아 있는 동안 붙었다 떨어지기를
 * 반복하는 것이라 생명주기 주인이 둘(React와 지도)이 된다. 짓는 쪽과 걷는 쪽을 지도 하나로
 * 두는 편이 단순하다.
 *
 * 그래서 이 파일은 `document`만 알고 지도는 모른다 — 덕분에 jsdom에서 그대로 테스트된다.
 *
 * 클릭 리스너를 여기서 다는 것도 같은 이유다. `content`가 진짜 DOM이라 `kakao.maps.event`가
 * 필요 없다.
 */

const BASE_CLASS =
  'flex -translate-x-1/2 -translate-y-full cursor-pointer flex-col items-center gap-0.5 ' +
  'rounded-full px-2.5 py-1 text-xs font-semibold shadow-md transition';

const UNSELECTED_CLASS = 'bg-white text-gray-900 ring-1 ring-gray-300';
const SELECTED_CLASS = 'bg-emerald-600 text-white ring-2 ring-emerald-700';

export type RegionMarkerHandlers = {
  onSelect(regionCode: string): void;
};

/**
 * 마커에 적는 글. "수유동 12"처럼 **동 이름과 개수**다.
 *
 * 전체 이름("서울특별시 강북구 수유동")을 쓰지 않는다 — 지도 위에서는 마커가 여럿 붙어
 * 있어 긴 이름이 서로를 가린다. 어느 시·구인지는 지도가 이미 보여주고 있다.
 */
export function toMarkerLabel(dongName: string): string {
  const parts = dongName.trim().split(/\s+/);

  return parts[parts.length - 1] ?? dongName;
}

export function createRegionMarkerElement(
  region: RegionPostCount,
  isSelected: boolean,
  handlers: RegionMarkerHandlers,
): HTMLElement {
  const element = document.createElement('button');

  element.type = 'button';
  element.className = `${BASE_CLASS} ${isSelected ? SELECTED_CLASS : UNSELECTED_CLASS}`;
  // 보조기기에는 "수유동 12"가 아니라 무엇을 세었는지까지 읽혀야 한다.
  element.setAttribute('aria-label', `${region.dongName} ${region.postCount}건`);
  element.setAttribute('aria-pressed', String(isSelected));
  element.textContent = `${toMarkerLabel(region.dongName)} ${region.postCount}`;

  element.addEventListener('click', function handleClick(event: MouseEvent): void {
    // 지도가 클릭을 함께 받으면 마커를 누를 때마다 지도도 반응한다.
    event.stopPropagation();
    handlers.onSelect(region.regionCode);
  });

  return element;
}
