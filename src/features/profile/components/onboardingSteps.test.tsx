import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import OnboardingSteps from './onboardingSteps';
import type { Region } from '../../region/types';

// RegionPicker → regionApi → kakaoMapLoader가 import.meta.env를 쓴다.
// 팩토리를 주면 jest가 원본을 읽지 않으므로 이 테스트가 로드 단계에서 죽지 않는다.
const mockSearchRegionsByKeyword = jest.fn();
const mockCoordsToRegion = jest.fn();

jest.mock('../../region/api/regionApi', function mockRegionApi() {
  return {
    searchRegionsByKeyword: function searchRegionsByKeyword(query: string) {
      return mockSearchRegionsByKeyword(query);
    },
    coordsToRegion: function coordsToRegion(coords: unknown) {
      return mockCoordsToRegion(coords);
    },
  };
});

beforeAll(function stubObjectUrl() {
  URL.createObjectURL = jest.fn(function createObjectUrl() {
    return 'blob:preview';
  });
  URL.revokeObjectURL = jest.fn();
});

const SUYU: Region = {
  code: '1130510300',
  depth1: '서울특별시',
  depth2: '강북구',
  depth3: '수유동',
  fullName: '서울특별시 강북구 수유동',
  coords: { lat: 37.6379, lng: 127.0146 },
};

function renderSteps(onComplete: jest.Mock, initialNickname = '', regionOnly = false) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  render(
    <MemoryRouter initialEntries={['/onboarding']}>
      <QueryClientProvider client={queryClient}>
        <OnboardingSteps
          initialNickname={initialNickname}
          regionOnly={regionOnly}
          isPending={false}
          onComplete={onComplete}
        />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

async function fillNicknameAndContinue(nickname: string): Promise<void> {
  await userEvent.type(screen.getByLabelText('닉네임'), nickname);
  await userEvent.click(screen.getByRole('button', { name: '다음' }));
}

async function pickSuyu(): Promise<void> {
  await userEvent.type(screen.getByLabelText('동네 이름으로 찾기'), '수유동');
  await userEvent.click(await screen.findByRole('button', { name: SUYU.fullName }));
}

describe('OnboardingSteps', function onboardingStepsSuite() {
  beforeEach(function resetMocks() {
    jest.clearAllMocks();
    mockSearchRegionsByKeyword.mockResolvedValue([SUYU]);
    mockCoordsToRegion.mockResolvedValue(SUYU);
  });

  it('닉네임을 넣어야 동네 단계로 넘어간다', async function requiresNicknameCase() {
    renderSteps(jest.fn());

    await userEvent.click(screen.getByRole('button', { name: '다음' }));

    expect(await screen.findByText('닉네임을 입력해 주세요.')).toBeInTheDocument();
    expect(screen.queryByLabelText('동네 이름으로 찾기')).not.toBeInTheDocument();
  });

  it('두 단계를 마치면 닉네임과 동네를 한 번에 넘긴다', async function completeCase() {
    const handleComplete = jest.fn();
    renderSteps(handleComplete);

    await fillNicknameAndContinue('가지마켓');
    await pickSuyu();
    await userEvent.click(screen.getByRole('button', { name: '시작하기' }));

    expect(handleComplete).toHaveBeenCalledTimes(1);
    expect(handleComplete).toHaveBeenCalledWith({
      nickname: '가지마켓',
      avatarFile: null,
      region: SUYU,
    });
  });

  it('동네를 고르지 않고 끝내려 하면 막는다', async function missingRegionCase() {
    const handleComplete = jest.fn();
    renderSteps(handleComplete);

    await fillNicknameAndContinue('가지마켓');
    await userEvent.click(screen.getByRole('button', { name: '시작하기' }));

    expect(await screen.findByText('동네를 선택해 주세요.')).toBeInTheDocument();
    expect(handleComplete).not.toHaveBeenCalled();
  });

  it('이전으로 돌아가도 1단계에 넣은 닉네임이 남아 있다', async function keepsDraftCase() {
    renderSteps(jest.fn());

    await fillNicknameAndContinue('가지마켓');
    await userEvent.click(screen.getByRole('button', { name: '이전' }));

    expect(screen.getByLabelText('닉네임')).toHaveValue('가지마켓');
  });

  it('이미 닉네임이 있는 사용자는 채워진 채로 시작한다', function prefillCase() {
    renderSteps(jest.fn(), '기존닉네임');

    expect(screen.getByLabelText('닉네임')).toHaveValue('기존닉네임');
  });

  // 이미 가입한 계정에 프로필 설정 화면을 다시 띄우면 안 된다.
  it('가입을 마친 사용자에게는 프로필 단계를 건너뛰고 동네만 묻는다', function regionOnlyCase() {
    renderSteps(jest.fn(), '기존닉네임', true);

    expect(screen.getByLabelText('동네 이름으로 찾기')).toBeInTheDocument();
    expect(screen.queryByLabelText('닉네임')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '이전' })).not.toBeInTheDocument();
  });

  it('건너뛴 경우에도 기존 닉네임을 그대로 넘긴다', async function regionOnlySubmitCase() {
    const handleComplete = jest.fn();
    renderSteps(handleComplete, '기존닉네임', true);

    await pickSuyu();
    await userEvent.click(screen.getByRole('button', { name: '시작하기' }));

    expect(handleComplete).toHaveBeenCalledWith({
      nickname: '기존닉네임',
      avatarFile: null,
      region: SUYU,
    });
  });

  it('1단계에서는 아직 저장하지 않는다', async function noEarlyWriteCase() {
    const handleComplete = jest.fn();
    renderSteps(handleComplete);

    await fillNicknameAndContinue('가지마켓');

    await waitFor(function assertRegionStep() {
      expect(screen.getByLabelText('동네 이름으로 찾기')).toBeInTheDocument();
    });
    expect(handleComplete).not.toHaveBeenCalled();
  });
});
