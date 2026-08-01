import { supabase } from '../../../shared/lib/supabaseClient';
import type { Profile } from '../types';

const AVATAR_BUCKET = 'avatars';
const PROFILE_COLUMNS = 'id, nickname, avatar_url, manner_temp, dong_name, onboarded_at';
const DEFAULT_AVATAR_EXTENSION = 'png';
const SAFE_EXTENSION_PATTERN = /^[a-zA-Z0-9]{1,5}$/;

type ProfileRow = {
  id: string;
  nickname: string;
  avatar_url: string | null;
  manner_temp: number | string;
  dong_name: string | null;
  onboarded_at: string | null;
};

export type CompleteOnboardingInput = {
  userId: string;
  nickname: string;
  /** null이면 기본 이미지를 쓴다(업로드하지 않음). */
  avatarFile: File | null;
};

/** numeric 컬럼(manner_temp)은 정밀도 손실을 막으려고 문자열로 오기도 한다. */
function toProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    nickname: row.nickname,
    avatarUrl: row.avatar_url,
    mannerTemp: Number(row.manner_temp),
    dongName: row.dong_name,
    onboardedAt: row.onboarded_at,
  };
}

function toFileExtension(file: File): string {
  const candidate = file.name.split('.').pop();
  if (candidate !== undefined && SAFE_EXTENSION_PATTERN.test(candidate)) {
    return candidate.toLowerCase();
  }
  return DEFAULT_AVATAR_EXTENSION;
}

export async function fetchProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', userId)
    .single();

  if (error !== null) {
    throw error;
  }

  return toProfile(data as ProfileRow);
}

/**
 * 프로필 사진을 스토리지에 올리고 공개 URL을 돌려준다.
 * 경로 첫 칸은 반드시 사용자 id — storage RLS가 본인 폴더만 쓰도록 막고 있다.
 * 파일명에 타임스탬프를 붙여 CDN 캐시가 옛 이미지를 물고 있는 것을 피한다.
 */
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const path = `${userId}/${Date.now()}.${toFileExtension(file)}`;

  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: true });

  if (error !== null) {
    throw error;
  }

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);

  return data.publicUrl;
}

/**
 * 온보딩 완료 — 닉네임·프로필 사진을 저장하고 onboarded_at을 채운다.
 * profiles 행 자체는 가입 시점에 트리거(handle_new_user)가 이미 만들어 두었으므로 update다.
 */
export async function completeProfileOnboarding(
  input: CompleteOnboardingInput,
): Promise<Profile> {
  const avatarUrl =
    input.avatarFile === null ? null : await uploadAvatar(input.userId, input.avatarFile);

  const { data, error } = await supabase
    .from('profiles')
    .update({
      nickname: input.nickname,
      avatar_url: avatarUrl,
      onboarded_at: new Date().toISOString(),
    })
    .eq('id', input.userId)
    .select(PROFILE_COLUMNS)
    .single();

  if (error !== null) {
    throw error;
  }

  return toProfile(data as ProfileRow);
}
