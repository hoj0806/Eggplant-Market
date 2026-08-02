import type { Profile } from '../types';

/**
 * 온보딩을 끝냈는지 판정한다.
 *
 * 라우트 가드(requireOnboarding)와 온보딩 화면(onboardingPage)이 **반드시 같은 함수**를 써야 한다.
 * 한쪽만 조건을 바꾸면 서로를 밀어내며 무한히 리다이렉트한다.
 *
 * onboarded_at만 보지 않는 이유: 동네 설정 기능 이전에 가입한 사용자는 닉네임만 정하고도
 * onboarded_at이 채워져 있다. 이들도 동네를 정하게 해야 한다.
 */
export function isOnboardingComplete(profile: Profile): boolean {
  return profile.onboardedAt !== null && profile.region !== null;
}

/** 가입 트리거(handle_new_user)가 넣는 임시 닉네임. */
const TEMP_NICKNAME_PATTERN = /^user_[0-9a-f]{8}$/;

/**
 * 온보딩 1단계에 채워 넣을 닉네임.
 * 임시 닉네임은 사용자가 정한 값이 아니므로 빈 칸으로 시작해야 한다.
 */
export function toInitialNickname(profile: Profile): string {
  return TEMP_NICKNAME_PATTERN.test(profile.nickname) ? '' : profile.nickname;
}
