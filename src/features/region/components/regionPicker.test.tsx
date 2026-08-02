import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RegionPicker from './regionPicker';
import type { Region } from '../types';

// regionApi는 kakaoMapLoader를 거쳐 import.meta.env에 닿는다.
// ts-jest는 CommonJS로 옮기면서 import.meta를 그대로 뱉으므로 실제 모듈을 로드하면 죽는다.
// 팩토리를 주면 jest가 원본을 아예 읽지 않는다.
const mockSearchRegionsByKeyword = jest.fn();
const mockCoordsToRegion = jest.fn();

jest.mock('../api/regionApi', function mockRegionApi() {
  return {
    searchRegionsByKeyword: function searchRegionsByKeyword(query: string) {
      return mockSearchRegionsByKeyword(query);
    },
    coordsToRegion: function coordsToRegion(coords: unknown) {
      return mockCoordsToRegion(coords);
    },
  };
});

const SUYU: Region = {
  code: '1130510300',
  depth1: '서울특별시',
  depth2: '강북구',
  depth3: '수유동',
  fullName: '서울특별시 강북구 수유동',
  coords: { lat: 37.6379, lng: 127.0146 },
};

function stubGeolocationSuccess(): void {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      getCurrentPosition: function succeed(onSuccess: PositionCallback): void {
        onSuccess({ coords: { latitude: 37.6, longitude: 127.0 } } as GeolocationPosition);
      },
    },
  });
}

function stubGeolocationDenied(): void {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      getCurrentPosition: function fail(
        _onSuccess: PositionCallback,
        onError?: PositionErrorCallback,
      ): void {
        onError?.({ code: 1 } as GeolocationPositionError);
      },
    },
  });
}

function renderPicker(onChange: jest.Mock, value: Region | null = null) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <RegionPicker value={value} onChange={onChange} />
    </QueryClientProvider>,
  );
}

describe('RegionPicker', function regionPickerSuite() {
  beforeEach(function resetMocks() {
    jest.clearAllMocks();
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
    stubGeolocationSuccess();
    mockSearchRegionsByKeyword.mockResolvedValue([]);
    mockCoordsToRegion.mockResolvedValue(SUYU);
  });

  it('검색 결과에서 고른 동네를 부모에게 넘긴다', async function searchAndSelectCase() {
    mockSearchRegionsByKeyword.mockResolvedValue([SUYU]);
    const handleChange = jest.fn();
    renderPicker(handleChange);

    await userEvent.type(screen.getByLabelText('동네 이름으로 찾기'), '수유동');

    const option = await screen.findByRole('button', { name: '서울특별시 강북구 수유동' });
    await userEvent.click(option);

    expect(handleChange).toHaveBeenCalledWith(SUYU);
  });

  it('두 글자 미만은 검색하지 않는다', async function shortQueryCase() {
    renderPicker(jest.fn());

    await userEvent.type(screen.getByLabelText('동네 이름으로 찾기'), '수');

    // 디바운스가 끝나고도 호출이 없어야 한다. 타이머가 일으키는 상태 변경까지 act 안에서 끝낸다.
    await act(async function advancePastDebounce() {
      await new Promise(function waitPastDebounce(resolve) {
        setTimeout(resolve, 500);
      });
    });

    expect(mockSearchRegionsByKeyword).not.toHaveBeenCalled();
  });

  it('결과가 없으면 다른 이름으로 찾아보라고 안내한다', async function emptyResultCase() {
    renderPicker(jest.fn());

    await userEvent.type(screen.getByLabelText('동네 이름으로 찾기'), '없는동네');

    expect(
      await screen.findByText('검색 결과가 없습니다. 다른 이름으로 찾아보세요.'),
    ).toBeInTheDocument();
  });

  it('현재 위치로 동네를 찾아 부모에게 넘긴다', async function locateCase() {
    const handleChange = jest.fn();
    renderPicker(handleChange);

    await userEvent.click(screen.getByRole('button', { name: /현재 위치로 동네 찾기/ }));

    await waitFor(function assertChanged() {
      expect(handleChange).toHaveBeenCalledWith(SUYU);
    });
    expect(mockCoordsToRegion).toHaveBeenCalledWith({ lat: 37.6, lng: 127.0 });
  });

  it('위치 권한이 거부되면 검색으로 계속하라고 안내한다', async function deniedCase() {
    stubGeolocationDenied();
    const handleChange = jest.fn();
    renderPicker(handleChange);

    await userEvent.click(screen.getByRole('button', { name: /현재 위치로 동네 찾기/ }));

    expect(
      await screen.findByText(
        '위치 권한이 거부되었습니다. 브라우저 설정에서 허용하거나 동네 이름으로 검색해 주세요.',
      ),
    ).toBeInTheDocument();
    expect(handleChange).not.toHaveBeenCalled();
  });

  it('고른 동네를 보여준다', function selectedCase() {
    renderPicker(jest.fn(), SUYU);

    expect(screen.getByText('선택한 동네')).toBeInTheDocument();
  });
});
