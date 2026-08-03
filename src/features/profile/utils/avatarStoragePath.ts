/**
 * 아바타 공개 URL에서 스토리지 경로만 뽑는다.
 *
 * 사진을 바꿀 때마다 새 파일을 올리므로(uploadAvatar가 이름에 타임스탬프를 붙인다)
 * 옛 파일을 지워 주지 않으면 버킷에 아무도 안 보는 이미지가 계속 쌓인다.
 * 지우려면 URL이 아니라 경로가 필요한데, 우리가 들고 있는 것은 profiles.avatar_url뿐이다.
 *
 * 공개 URL의 모양:
 *   https://{ref}.supabase.co/storage/v1/object/public/avatars/{user_id}/{stamp}.{ext}
 *                                                     ^^^^^^^^ 여기 뒤가 경로다
 *
 * 우리 버킷의 URL이 아니면 null을 준다. 구글 프로필 사진 같은 외부 URL이 들어와 있을 때
 * 엉뚱한 경로를 만들어 지우려 드는 일을 막는 자리다.
 */

const AVATAR_BUCKET = 'avatars';
const PUBLIC_URL_MARKER = `/storage/v1/object/public/${AVATAR_BUCKET}/`;

export function toAvatarStoragePath(publicUrl: string | null): string | null {
  if (publicUrl === null) {
    return null;
  }

  const markerIndex = publicUrl.indexOf(PUBLIC_URL_MARKER);
  if (markerIndex === -1) {
    return null;
  }

  // 쿼리스트링(?t=…)이 붙어 오는 경우가 있어 잘라 낸다. 경로에는 ?가 들어가지 않는다.
  const path = publicUrl.slice(markerIndex + PUBLIC_URL_MARKER.length).split('?')[0];

  return path.length === 0 ? null : path;
}
