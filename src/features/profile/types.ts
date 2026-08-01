export type Profile = {
  id: string;
  nickname: string;
  /** null이면 기본 이미지를 보여준다. */
  avatarUrl: string | null;
  mannerTemp: number;
  dongName: string | null;
  /** null이면 아직 온보딩(닉네임·프로필 사진 설정)을 마치지 않은 사용자다. */
  onboardedAt: string | null;
};

export type ProfileOnboardingValues = {
  nickname: string;
  avatarFile: File | null;
};

export type ProfileFieldName = 'nickname' | 'avatarFile';

export type ProfileFieldErrors = Partial<Record<ProfileFieldName, string>>;
