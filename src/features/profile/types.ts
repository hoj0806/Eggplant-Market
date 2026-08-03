import type { PostStatus, PostSummary } from '../post/types';
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

/**
 * 프로필 수정 화면의 값.
 *
 * `avatarFile`과 `removeAvatar`는 동시에 켜지지 않는다 — 새 사진을 고르는 순간 되돌리기는 풀린다.
 * 둘 다 비어 있으면 "사진은 그대로"라는 뜻이고, 그때는 저장 payload에서 avatar_url을 아예 뺀다.
 */
export type ProfileEditValues = ProfileOnboardingValues & {
  removeAvatar: boolean;
};

export type ProfileFieldName = 'nickname' | 'avatarFile';

export type ProfileFieldErrors = Partial<Record<ProfileFieldName, string>>;

/** 마이페이지의 네 목록. 값이 곧 RPC 이름과 화면 문구를 고르는 열쇠다. */
export type MyListKind = 'likes' | 'recent' | 'purchases' | 'sales';

/**
 * 목록 카드 한 장 + 그 목록의 정렬 기준 시각.
 *
 * `sortAt`의 의미는 목록마다 다르다(찜한 때·본 때·구매한 때·끌올한 때).
 * 정렬 키이자 커서의 앞 절반이고, 카드에 적히는 시간 문구의 재료다.
 */
export type MyPostSummary = PostSummary & {
  sortAt: string;
};

/** 다음 페이지의 시작점. `sortAt` 하나로는 같은 시각 행을 가를 수 없어 id까지 들고 간다. */
export type MyPostCursor = {
  sortAt: string;
  id: number;
};

/** 판매관리 필터. null이면 전체다. */
export type SellingStatusFilter = PostStatus | null;
