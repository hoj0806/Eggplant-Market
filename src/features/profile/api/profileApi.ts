import { supabase } from '../../../shared/lib/supabaseClient';
import { toAvatarStoragePath } from '../utils/avatarStoragePath';
import { toSearchRadius } from '../../browse/utils/searchRadius';
import type { Region } from '../../region/types';
import type { Profile } from '../types';

const AVATAR_BUCKET = 'avatars';
// 한 줄 리터럴이어야 한다. 문자열을 +로 이으면 리터럴 타입을 잃어
// supabase-js가 select 결과를 GenericStringError로 추론한다.
const PROFILE_COLUMNS =
  'id, nickname, avatar_url, manner_temp, dong_name, region_code, region_depth1, region_depth2, region_depth3, location_lat, location_lng, search_radius_m, onboarded_at';
const DEFAULT_AVATAR_EXTENSION = 'png';
const SAFE_EXTENSION_PATTERN = /^[a-zA-Z0-9]{1,5}$/;

type ProfileRow = {
  id: string;
  nickname: string;
  avatar_url: string | null;
  manner_temp: number | string;
  dong_name: string | null;
  region_code: string | null;
  region_depth1: string | null;
  region_depth2: string | null;
  region_depth3: string | null;
  location_lat: number | null;
  location_lng: number | null;
  search_radius_m: number;
  onboarded_at: string | null;
};

export type CompleteOnboardingInput = {
  userId: string;
  nickname: string;
  /** null이면 기본 이미지를 쓴다(업로드하지 않음). */
  avatarFile: File | null;
  region: Region;
};

export type UpdateProfileRegionInput = {
  userId: string;
  region: Region;
};

export type UpdateSearchRadiusInput = {
  userId: string;
  /** 미터. 서버가 100~20000으로 한 번 더 조인다(0024). */
  radiusM: number;
};

export type UpdateProfileBasicsInput = {
  userId: string;
  nickname: string;
  /** 새로 고른 사진. null이면 사진은 건드리지 않는다. */
  avatarFile: File | null;
  /** true면 기본 이미지로 되돌린다(avatar_url = null). */
  removeAvatar: boolean;
};

/** 네 컬럼이 모두 차 있어야 동네로 인정한다. 하나라도 비면 아직 안 정한 것이다. */
function toRegion(row: ProfileRow): Region | null {
  if (
    row.region_code === null ||
    row.dong_name === null ||
    row.location_lat === null ||
    row.location_lng === null
  ) {
    return null;
  }

  return {
    code: row.region_code,
    depth1: row.region_depth1 ?? '',
    depth2: row.region_depth2 ?? '',
    depth3: row.region_depth3 ?? '',
    fullName: row.dong_name,
    coords: { lat: row.location_lat, lng: row.location_lng },
  };
}

/** numeric 컬럼(manner_temp)은 정밀도 손실을 막으려고 문자열로 오기도 한다. */
function toProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    nickname: row.nickname,
    avatarUrl: row.avatar_url,
    mannerTemp: Number(row.manner_temp),
    region: toRegion(row),
    searchRadiusM: toSearchRadius(row.search_radius_m),
    onboardedAt: row.onboarded_at,
  };
}

/**
 * 동네를 profiles 컬럼으로 편다.
 *
 * location은 PostGIS geography라 EWKT 문자열로 넣는다 — PostgREST가 값을 컬럼 타입의
 * 입력 함수(geography_in)에 그대로 태우므로 별도 RPC 없이 들어간다.
 * 반대로 읽을 때는 EWKB hex가 나와 쓸 수 없어서, 좌표는 생성 컬럼 location_lat/lng로 읽는다.
 * POINT의 인자 순서는 (경도, 위도)다.
 */
function toRegionColumns(region: Region) {
  return {
    dong_name: region.fullName,
    region_code: region.code,
    region_depth1: region.depth1,
    region_depth2: region.depth2,
    region_depth3: region.depth3,
    location: `SRID=4326;POINT(${region.coords.lng} ${region.coords.lat})`,
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
 * 온보딩 완료 — 닉네임·프로필 사진·동네를 저장하고 onboarded_at을 채운다.
 * profiles 행 자체는 가입 시점에 트리거(handle_new_user)가 이미 만들어 두었으므로 update다.
 *
 * 두 단계로 나뉘어 있어도 쓰기는 여기 한 번뿐이다.
 * 중간에 그만두면 아무것도 저장되지 않아 "닉네임만 있고 동네는 없는" 상태가 생기지 않는다.
 *
 * 사진을 고르지 않았으면 avatar_url을 payload에서 뺀다.
 * 무조건 쓰면 온보딩을 다시 거치는 사용자의 기존 사진이 지워진다.
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
      ...(avatarUrl === null ? {} : { avatar_url: avatarUrl }),
      ...toRegionColumns(input.region),
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

/** 지금 저장돼 있는 사진 주소. 바꾼 뒤 옛 파일을 지우려면 미리 알아 둬야 한다. */
async function fetchAvatarUrl(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('avatar_url')
    .eq('id', userId)
    .single();

  if (error !== null) {
    throw error;
  }

  return (data as { avatar_url: string | null }).avatar_url;
}

/**
 * 스토리지에서 아바타 파일 하나를 지운다.
 *
 * 실패해도 조용히 넘어간다 — 뒷정리라서 그렇다(postApi.removeUploadedImages와 같은 자리).
 * 우리 버킷 URL이 아니면 경로가 null이라 아무것도 하지 않는다.
 */
async function removeAvatarObject(avatarUrl: string | null): Promise<void> {
  const path = toAvatarStoragePath(avatarUrl);
  if (path === null) {
    return;
  }

  await supabase.storage.from(AVATAR_BUCKET).remove([path]);
}

/** 사진을 어떻게 할지에 따라 update payload의 avatar_url 칸을 만든다. */
function toAvatarPayload(
  removeAvatar: boolean,
  uploadedUrl: string | null,
): { avatar_url: string | null } | Record<string, never> {
  if (uploadedUrl !== null) {
    return { avatar_url: uploadedUrl };
  }
  if (removeAvatar) {
    return { avatar_url: null };
  }

  // 아무것도 안 골랐으면 칸 자체를 비운다. 넣으면 기존 사진이 지워진다.
  return {};
}

/**
 * 닉네임·프로필 사진 변경.
 *
 * 온보딩(completeProfileOnboarding)과 쓰는 컬럼은 겹치지만 규칙이 다르다.
 *   · onboarded_at을 건드리지 않는다 (updateProfileRegion과 같다)
 *   · "사진 없음"이 두 가지로 갈린다 — 그대로 두기 / 기본 이미지로 되돌리기
 *
 * 스토리지는 트랜잭션에 들어가지 않으므로 양쪽으로 보상한다.
 *   update가 실패하면 방금 올린 파일을 지우고(createPost와 같은 형태),
 *   성공하면 이제 아무도 안 보는 옛 파일을 지운다.
 * 뒷정리 실패는 무시한다. 프로필은 이미 저장됐고, 파일 하나 때문에 오류를 띄울 이유가 없다.
 */
export async function updateProfileBasics(input: UpdateProfileBasicsInput): Promise<Profile> {
  const previousAvatarUrl = await fetchAvatarUrl(input.userId);
  const uploadedUrl =
    input.avatarFile === null ? null : await uploadAvatar(input.userId, input.avatarFile);

  const { data, error } = await supabase
    .from('profiles')
    .update({
      nickname: input.nickname,
      ...toAvatarPayload(input.removeAvatar, uploadedUrl),
    })
    .eq('id', input.userId)
    .select(PROFILE_COLUMNS)
    .single();

  if (error !== null) {
    await removeAvatarObject(uploadedUrl);
    throw error;
  }

  const profile = toProfile(data as ProfileRow);

  if (profile.avatarUrl !== previousAvatarUrl) {
    await removeAvatarObject(previousAvatarUrl);
  }

  return profile;
}

/** 동네만 바꾼다. 온보딩을 이미 마친 사용자용이라 onboarded_at은 건드리지 않는다. */
export async function updateProfileRegion(input: UpdateProfileRegionInput): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update(toRegionColumns(input.region))
    .eq('id', input.userId)
    .select(PROFILE_COLUMNS)
    .single();

  if (error !== null) {
    throw error;
  }

  return toProfile(data as ProfileRow);
}

/**
 * 검색 반경만 바꾼다.
 *
 * 동네와 한 화면에 있지만 저장은 따로다 — 동네는 "이 동네로 변경" 버튼까지 가는 절차인데
 * 반경은 고르는 즉시 정해지는 한 번의 선택이라, 한 payload로 묶으면 동네를 고르다 만 사용자가
 * 반경도 못 바꾼다.
 *
 * 0023의 guard는 이 칸을 잠그지 않는다. 사용자가 자기 뜻으로 정하는 값이고 남에게 보여도
 * 거짓말이 되지 않는다. 범위는 서버가 조인다(0024, 100~20000).
 */
export async function updateSearchRadius(input: UpdateSearchRadiusInput): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update({ search_radius_m: input.radiusM })
    .eq('id', input.userId)
    .select(PROFILE_COLUMNS)
    .single();

  if (error !== null) {
    throw error;
  }

  return toProfile(data as ProfileRow);
}
