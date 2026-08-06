import { createRegionMarkerElement, toMarkerLabel } from './regionMarkerElement';
import type { RegionPostCount } from '../types';

function toRegion(overrides: Partial<RegionPostCount> = {}): RegionPostCount {
  return {
    regionCode: '1130510300',
    dongName: '서울특별시 강북구 수유동',
    coords: { lat: 37.6379, lng: 127.0146 },
    postCount: 12,
    distanceM: 740,
    ...overrides,
  };
}

describe('toMarkerLabel', function toMarkerLabelSuite() {
  it('동 이름만 남긴다', function keepsLastPart() {
    // 지도 위에는 마커가 여럿 붙어 긴 이름이 서로를 가린다. 시·구는 지도가 이미 보여준다.
    expect(toMarkerLabel('서울특별시 강북구 수유동')).toBe('수유동');
    expect(toMarkerLabel('서울 강북구 수유동')).toBe('수유동');
  });

  it('시·군·구가 없는 지역도 그대로 읽는다', function handlesShortNames() {
    // 세종특별자치시처럼 depth2가 빈 곳이 있다(toRegionFullName 참고).
    expect(toMarkerLabel('세종특별자치시 조치원읍')).toBe('조치원읍');
    expect(toMarkerLabel('수유동')).toBe('수유동');
  });
});

describe('createRegionMarkerElement', function createRegionMarkerElementSuite() {
  it('동 이름과 개수를 적는다', function showsNameAndCount() {
    const element = createRegionMarkerElement(toRegion(), false, { onSelect: jest.fn() });

    expect(element.textContent).toBe('수유동 12');
  });

  it('보조기기에는 전체 이름과 무엇을 세었는지까지 읽힌다', function hasAccessibleLabel() {
    const element = createRegionMarkerElement(toRegion(), false, { onSelect: jest.fn() });

    expect(element.getAttribute('aria-label')).toBe('서울특별시 강북구 수유동 12건');
  });

  it('고른 마커는 눌린 상태로 표시한다', function marksSelected() {
    const selected = createRegionMarkerElement(toRegion(), true, { onSelect: jest.fn() });
    const plain = createRegionMarkerElement(toRegion(), false, { onSelect: jest.fn() });

    expect(selected.getAttribute('aria-pressed')).toBe('true');
    expect(plain.getAttribute('aria-pressed')).toBe('false');
    expect(selected.className).not.toBe(plain.className);
  });

  it('누르면 그 동네 코드를 올려보낸다', function reportsSelection() {
    const handleSelect = jest.fn();
    const element = createRegionMarkerElement(toRegion(), false, { onSelect: handleSelect });

    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(handleSelect).toHaveBeenCalledWith('1130510300');
  });

  it('클릭이 지도까지 올라가지 않는다', function stopsPropagation() {
    // 지도가 같은 클릭을 함께 받으면 마커를 누를 때마다 지도도 반응한다.
    const parent = document.createElement('div');
    const onParentClick = jest.fn();
    parent.addEventListener('click', onParentClick);

    const element = createRegionMarkerElement(toRegion(), false, { onSelect: jest.fn() });
    parent.appendChild(element);

    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(onParentClick).not.toHaveBeenCalled();
  });

  it('폼 안에 놓여도 제출하지 않는다', function isNotSubmitButton() {
    // button의 기본 type은 submit이다. 나중에 폼 안에 들어가면 지도를 누를 때마다 폼이 날아간다.
    const element = createRegionMarkerElement(toRegion(), false, { onSelect: jest.fn() });

    expect(element).toBeInstanceOf(HTMLButtonElement);
    expect((element as HTMLButtonElement).type).toBe('button');
  });
});
