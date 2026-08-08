import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RegionCountList from './regionCountList';
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

const NEARBY = toRegion();
const FURTHER = toRegion({
  regionCode: '1129013900',
  dongName: '서울특별시 성북구 석관동',
  postCount: 27,
  distanceM: 4971,
});

describe('RegionCountList', function regionCountListSuite() {
  it('동네마다 이름·거리·개수를 적는다', function showsEachRegion() {
    render(
      <RegionCountList regions={[NEARBY]} selectedRegionCode={null} onSelect={jest.fn()} />,
    );

    const item = screen.getByRole('button');
    expect(item).toHaveTextContent('서울특별시 강북구 수유동');
    expect(item).toHaveTextContent('740m');
    expect(item).toHaveTextContent('12건');
  });

  it('1km가 넘는 거리는 킬로미터로 적는다', function formatsKilometers() {
    render(
      <RegionCountList regions={[FURTHER]} selectedRegionCode={null} onSelect={jest.fn()} />,
    );

    expect(screen.getByRole('button')).toHaveTextContent('5km');
  });

  it('받은 순서 그대로 그린다', function keepsServerOrder() {
    // 서버가 가까운 순으로 내려준다(0025). 여기서 다시 정렬하면 두 곳이 어긋날 수 있다.
    render(
      <RegionCountList
        regions={[NEARBY, FURTHER]}
        selectedRegionCode={null}
        onSelect={jest.fn()}
      />,
    );

    const items = screen.getAllByRole('button');
    expect(items[0]).toHaveTextContent('수유동');
    expect(items[1]).toHaveTextContent('석관동');
  });

  it('고른 동네만 눌린 상태다', function marksSelected() {
    render(
      <RegionCountList
        regions={[NEARBY, FURTHER]}
        selectedRegionCode={FURTHER.regionCode}
        onSelect={jest.fn()}
      />,
    );

    const items = screen.getAllByRole('button');
    expect(items[0]).toHaveAttribute('aria-pressed', 'false');
    expect(items[1]).toHaveAttribute('aria-pressed', 'true');
  });

  it('누르면 그 동네 코드를 올려보낸다', function reportsSelection() {
    const handleSelect = jest.fn();
    render(
      <RegionCountList regions={[NEARBY]} selectedRegionCode={null} onSelect={handleSelect} />,
    );

    return userEvent.click(screen.getByRole('button')).then(function assertCalled(): void {
      expect(handleSelect).toHaveBeenCalledWith('1130510300');
    });
  });

  it('셀 동네가 없으면 아무것도 그리지 않는다', function rendersNothingWhenEmpty() {
    // 0건 안내는 페이지가 맡는다. 여기서도 적으면 같은 말이 두 번 나온다.
    const { container } = render(
      <RegionCountList regions={[]} selectedRegionCode={null} onSelect={jest.fn()} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
