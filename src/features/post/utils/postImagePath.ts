export const POST_IMAGE_BUCKET = 'post-images';

/**
 * 공개 URL 안에서 버킷 경로가 시작되는 자리.
 * getPublicUrl이 만들어 주는 주소의 모양이다 —
 * `https://<ref>.supabase.co/storage/v1/object/public/post-images/<uid>/<파일명>`
 */
const PUBLIC_URL_MARKER = `/storage/v1/object/public/${POST_IMAGE_BUCKET}/`;

/**
 * 공개 URL을 스토리지 경로로 되돌린다.
 *
 * 게시물을 고치거나 지울 때 스토리지에서도 사진을 치우려면 경로가 필요한데,
 * post_images 테이블은 공개 URL만 들고 있다(등록할 때 그것만 저장했다).
 * 경로를 따로 저장하는 컬럼을 새로 만드는 대신, 주소에서 되짚는 쪽을 택했다 —
 * 이미 올라간 사진에도 그대로 통하고 마이그레이션이 필요 없다.
 *
 * 우리 버킷의 주소가 아니면 null이다. 정리 대상에서 조용히 빠진다 —
 * 남의 주소를 지우려 들 이유도, 그 시도로 저장이 실패할 이유도 없다.
 *
 * `?t=...` 같은 쿼리와 퍼센트 인코딩은 걷어낸다. remove()는 날것의 경로를 받는다.
 */
export function toPostImagePath(publicUrl: string): string | null {
  const markerIndex = publicUrl.indexOf(PUBLIC_URL_MARKER);
  if (markerIndex === -1) {
    return null;
  }

  const rest = publicUrl.slice(markerIndex + PUBLIC_URL_MARKER.length);
  const path = rest.split('?')[0].split('#')[0];
  if (path.length === 0) {
    return null;
  }

  try {
    return decodeURIComponent(path);
  } catch {
    // 인코딩이 깨진 주소. 되짚기를 포기하고 정리 대상에서 뺀다.
    return null;
  }
}

/** URL 여러 개를 한 번에. 우리 버킷이 아닌 주소는 걸러진다. */
export function toPostImagePaths(publicUrls: ReadonlyArray<string>): string[] {
  const paths: string[] = [];

  for (const url of publicUrls) {
    const path = toPostImagePath(url);
    if (path !== null) {
      paths.push(path);
    }
  }

  return paths;
}
