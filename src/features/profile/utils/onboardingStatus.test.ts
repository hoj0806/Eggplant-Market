import { isOnboardingComplete, needsRegionOnly, toInitialNickname } from './onboardingStatus';
import type { Region } from '../../region/types';
import type { Profile } from '../types';

const REGION: Region = {
  code: '1130510300',
  depth1: '서울특별시',
  depth2: '강북구',
  depth3: '수유동',
  fullName: '서울특별시 강북구 수유동',
  coords: { lat: 37.6379, lng: 127.0146 },
};

function createProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: '11111111-2222-3333-4444-555555555555',
    nickname: '가지마켓',
    avatarUrl: null,
    mannerTemp: 36.5,
    region: REGION,
    searchRadiusM: 2000,
    onboardedAt: '2026-08-02T00:00:00.000Z',
    ...overrides,
  };
}

describe('isOnboardingComplete', function isOnboardingCompleteSuite() {
  it('닉네임과 동네가 모두 있으면 완료다', function completeCase() {
    expect(isOnboardingComplete(createProfile())).toBe(true);
  });

  it('아직 아무것도 정하지 않았으면 미완료다', function freshCase() {
    expect(isOnboardingComplete(createProfile({ onboardedAt: null, region: null }))).toBe(false);
  });

  // 동네 설정 기능 이전에 가입한 사용자. onboarded_at만 보면 통과해 동네를 영영 못 정한다.
  it('동네 없이 onboarded_at만 차 있으면 미완료다', function legacyUserCase() {
    expect(isOnboardingComplete(createProfile({ region: null }))).toBe(false);
  });
});

describe('toInitialNickname', function toInitialNicknameSuite() {
  it('가입 트리거가 넣은 임시 닉네임은 빈 칸으로 시작한다', function tempNicknameCase() {
    expect(toInitialNickname(createProfile({ nickname: 'user_1a2b3c4d' }))).toBe('');
  });

  it('사용자가 정한 닉네임은 그대로 채운다', function realNicknameCase() {
    expect(toInitialNickname(createProfile({ nickname: '가지마켓' }))).toBe('가지마켓');
  });

  it('임시 닉네임과 모양만 비슷한 이름은 지우지 않는다', function lookalikeCase() {
    expect(toInitialNickname(createProfile({ nickname: 'user_hello' }))).toBe('user_hello');
  });
});

describe('needsRegionOnly', function needsRegionOnlySuite() {
  // 동네 설정 기능 이전에 가입한 사용자. 프로필은 이미 정했으니 동네만 물어야 한다.
  it('가입을 마친 사용자에게는 동네 단계만 보여준다', function legacyUserCase() {
    expect(needsRegionOnly(createProfile({ region: null }))).toBe(true);
  });

  it('갓 가입한 사용자는 프로필 단계부터 거친다', function freshUserCase() {
    expect(needsRegionOnly(createProfile({ onboardedAt: null, region: null }))).toBe(false);
  });

  // 건너뛰면 트리거가 넣은 임시 닉네임이 그대로 굳는다.
  it('닉네임이 임시값이면 건너뛰지 않는다', function tempNicknameCase() {
    expect(
      needsRegionOnly(createProfile({ nickname: 'user_1a2b3c4d', region: null })),
    ).toBe(false);
  });
});
