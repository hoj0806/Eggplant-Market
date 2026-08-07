import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MannerTempHistoryPage from './mannerTempHistoryPage';
import type { MannerTempEvent, Profile } from '../types';

// 두 api 모두 supabaseClient(import.meta)에 닿는다. ts-jest가 CommonJS로 옮기면서
// import.meta를 그대로 뱉으므로 실제 모듈을 로드하면 죽는다(troble.md #5).
const mockFetchEvents = jest.fn();
const mockFetchProfile = jest.fn();

jest.mock('../api/mannerTempEventApi', function mockEventApi() {
  return {
    fetchMannerTempEvents: function fetchMannerTempEvents() {
      return mockFetchEvents();
    },
  };
});

jest.mock('../api/profileApi', function mockProfileApi() {
  return {
    fetchProfile: function fetchProfile(userId: unknown) {
      return mockFetchProfile(userId);
    },
  };
});

const VIEWER_ID = 'viewer-1';

jest.mock('../../auth/store/authStore', function mockAuthStore() {
  return {
    selectAuthUser: function selectAuthUser(state: unknown) {
      return state;
    },
    useAuthStore: function useAuthStore() {
      return { id: VIEWER_ID };
    },
  };
});

const PROFILE: Profile = {
  id: VIEWER_ID,
  nickname: '나',
  avatarUrl: null,
  mannerTemp: 37.1,
  region: null,
  searchRadiusM: 2000,
  onboardedAt: '2026-08-01T00:00:00.000Z',
};

function buildEvent(overrides: Partial<MannerTempEvent> = {}): MannerTempEvent {
  return {
    id: 1,
    beforeTemp: 36.5,
    afterTemp: 37.0,
    reviewCount: 1,
    reviewSum: 0.5,
    createdAt: '2026-08-07T00:00:00.000Z',
    ...overrides,
  };
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <MannerTempHistoryPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('MannerTempHistoryPage', function mannerTempHistorySuite() {
  beforeEach(function resetMocks() {
    jest.clearAllMocks();
    mockFetchEvents.mockResolvedValue([]);
    mockFetchProfile.mockResolvedValue(PROFILE);
  });

  // "기록이 없어요"가 아니다. 한 번도 안 움직인 사람과 이력이 생기기 전부터 있던 사람이
  // 같은 화면을 보는데, 둘 다에게 맞는 말은 "아직 움직인 적이 없다"이다(0034는 백필하지 않는다).
  it('이력이 없으면 아직 움직인 적이 없다고 말한다', async function emptyCase() {
    renderPage();

    expect(
      await screen.findByText('아직 매너온도가 움직인 적이 없어요. 거래를 마치고 후기를 받아 보세요.'),
    ).toBeInTheDocument();
  });

  it('지금 온도를 맨 위에 적는다', async function currentTempCase() {
    renderPage();

    expect(await screen.findByText('37.1°C')).toBeInTheDocument();
  });

  it('바뀐 값과 움직인 폭을 함께 보여준다', async function rowCase() {
    mockFetchEvents.mockResolvedValue([buildEvent()]);
    renderPage();

    expect(await screen.findByText('36.5°C → 37.0°C')).toBeInTheDocument();
    expect(screen.getByText('+0.5')).toBeInTheDocument();
  });

  // 이 화면이 답하려는 질문이 이것이다 — 후기 목록에는 사라진 후기가 없다.
  it('후기가 사라져 온도가 오른 줄을 그 이유와 함께 읽는다', async function removedCase() {
    mockFetchEvents.mockResolvedValue([
      // 최신순이다. 나쁜 후기가 달린 글이 지워져 온도가 되돌아온 줄이 맨 위다.
      buildEvent({ id: 2, beforeTemp: 36.6, afterTemp: 37.1, reviewCount: 2, reviewSum: 0.6 }),
      buildEvent({ id: 1, beforeTemp: 36.5, afterTemp: 36.6, reviewCount: 3, reviewSum: 0.1 }),
    ]);
    renderPage();

    expect(await screen.findByText('후기 1건이 사라졌어요')).toBeInTheDocument();
    expect(screen.getByText('후기 2건 · 합계 +0.6')).toBeInTheDocument();
  });

  // 견줄 앞 줄이 없으면 이유를 지어내지 않는다. 근거는 그래도 적힌다.
  it('가장 오래된 줄에는 이유 없이 근거만 적힌다', async function oldestRowCase() {
    mockFetchEvents.mockResolvedValue([buildEvent()]);
    renderPage();

    expect(await screen.findByText('후기 1건 · 합계 +0.5')).toBeInTheDocument();
    expect(screen.queryByText(/받았어요|사라졌어요/)).not.toBeInTheDocument();
  });

  it('불러오지 못하면 그 사실을 알린다', async function errorCase() {
    mockFetchEvents.mockRejectedValue(new Error('failed'));
    renderPage();

    expect(await screen.findByText('기록을 불러오지 못했습니다.')).toBeInTheDocument();
  });
});
