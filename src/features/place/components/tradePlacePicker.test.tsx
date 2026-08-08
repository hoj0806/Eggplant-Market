import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TradePlacePicker from './tradePlacePicker';
import type { TradePlace } from '../types';

// placeApi는 kakaoMapLoader를 거쳐 import.meta.env에 닿는다. 실제 모듈을 로드하면 죽는다.
const mockSearchPlacesByKeyword = jest.fn();

jest.mock('../api/placeApi', function mockPlaceApi() {
  return {
    searchPlacesByKeyword: function searchPlacesByKeyword(query: string, center: unknown) {
      return mockSearchPlacesByKeyword(query, center);
    },
  };
});

const CENTER = { lat: 37.6379, lng: 127.0146 };

const SUYU_STATION: TradePlace = {
  id: '10012',
  name: '수유역 4번출구',
  addressName: '서울 강북구 도봉로 338',
  coords: { lat: 37.6379, lng: 127.0254 },
};

function renderPicker(onChange: jest.Mock, value: TradePlace | null = null) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <TradePlacePicker value={value} center={CENTER} onChange={onChange} />
    </QueryClientProvider>,
  );
}

describe('TradePlacePicker', function tradePlacePickerSuite() {
  beforeEach(function resetMocks() {
    jest.clearAllMocks();
    mockSearchPlacesByKeyword.mockResolvedValue([]);
  });

  it('내 동네를 중심으로 검색한다', async function centerCase() {
    mockSearchPlacesByKeyword.mockResolvedValue([SUYU_STATION]);
    renderPicker(jest.fn());

    await userEvent.type(screen.getByLabelText('거래희망장소 (선택)'), '수유역');

    expect(await screen.findByText('수유역 4번출구')).toBeInTheDocument();
    expect(mockSearchPlacesByKeyword).toHaveBeenLastCalledWith('수유역', CENTER);
  });

  it('고른 장소를 부모에게 넘긴다', async function selectCase() {
    mockSearchPlacesByKeyword.mockResolvedValue([SUYU_STATION]);
    const handleChange = jest.fn();
    renderPicker(handleChange);

    await userEvent.type(screen.getByLabelText('거래희망장소 (선택)'), '수유역');
    await userEvent.click(await screen.findByText('수유역 4번출구'));

    expect(handleChange).toHaveBeenCalledWith(SUYU_STATION);
  });

  it('결과가 없으면 다른 이름으로 찾아보라고 안내한다', async function emptyCase() {
    renderPicker(jest.fn());

    await userEvent.type(screen.getByLabelText('거래희망장소 (선택)'), '없는장소');

    expect(
      await screen.findByText('검색 결과가 없습니다. 다른 이름으로 찾아보세요.'),
    ).toBeInTheDocument();
  });

  it('고른 장소를 해제할 수 있다', async function clearCase() {
    const handleChange = jest.fn();
    renderPicker(handleChange, SUYU_STATION);

    await userEvent.click(screen.getByRole('button', { name: '거래희망장소 선택 해제' }));

    expect(handleChange).toHaveBeenCalledWith(null);
  });
});
