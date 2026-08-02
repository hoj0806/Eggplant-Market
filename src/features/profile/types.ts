import type { Region } from '../region/types';

export type Profile = {
  id: string;
  nickname: string;
  /** null이면 기본 이미지를 보여준다. */
  avatarUrl: string | null;
  mannerTemp: number;
  /** 아직 동네를 정하지 않았으면 null. */
  region: Region | null;
  /** null이면 아직 온보딩을 마치지 않은 사용자다. 판정은 isOnboardingComplete를 쓴다. */
  onboardedAt: string | null;
};

/** 온보딩 1단계(프로필) 값. */
export type ProfileOnboardingValues = {
  nickname: string;
  avatarFile: File | null;
};

/** 두 단계를 거치며 모으는 값. 마지막 단계에서 한 번에 저장한다. */
export type OnboardingDraft = ProfileOnboardingValues & {
  region: Region | null;
};

export type ProfileFieldName = 'nickname' | 'avatarFile';

export type ProfileFieldErrors = Partial<Record<ProfileFieldName, string>>;
