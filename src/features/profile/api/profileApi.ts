import { supabase } from '../../../shared/lib/supabaseClient';
import type { Region } from '../../region/types';
import type { Profile } from '../types';

const AVATAR_BUCKET = 'avatars';
// 한 줄 리터럴이어야 한다. 문자열을 +로 이으면 리터럴 타입을 잃어
// supabase-js가 select 결과를 GenericStringError로 추론한다.
const PROFILE_COLUMNS =
  'id, nickname, avatar_url, manner_temp, dong_name, region_code, region_depth1, region_depth2, region_depth3, location_lat, location_lng, onboarded_at';
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
