import { toAvatarStoragePath } from './avatarStoragePath';

const PUBLIC_BASE = 'https://hcmpbpeyhmmismxjkkzv.supabase.co/storage/v1/object/public/avatars';

describe('toAvatarStoragePath', function avatarStoragePathSuite() {
  it('우리 버킷의 공개 URL에서 경로만 뽑는다', function extractsPath() {
    expect(toAvatarStoragePath(`${PUBLIC_BASE}/user-1/1754200000000.png`)).toBe(
      'user-1/1754200000000.png',
    );
  });

  it('캐시 무효화용 쿼리스트링은 잘라 낸다', function stripsQuery() {
    expect(toAvatarStoragePath(`${PUBLIC_BASE}/user-1/1754200000000.png?t=123`)).toBe(
      'user-1/1754200000000.png',
    );
  });

  it('사진이 없으면(null) 지울 것도 없다', function nullCase() {
    expect(toAvatarStoragePath(null)).toBeNull();
  });

  it('다른 버킷의 URL은 건드리지 않는다', function otherBucketCase() {
    const url =
      'https://hcmpbpeyhmmismxjkkzv.supabase.co/storage/v1/object/public/post-images/user-1/a.jpg';

    expect(toAvatarStoragePath(url)).toBeNull();
  });

  it('외부 URL은 건드리지 않는다 — 구글 프로필 사진 같은 것', function externalUrlCase() {
    expect(toAvatarStoragePath('https://lh3.googleusercontent.com/a/abc123')).toBeNull();
  });

  it('버킷 뒤가 비어 있으면 경로가 아니다', function emptyPathCase() {
    expect(toAvatarStoragePath(`${PUBLIC_BASE}/`)).toBeNull();
  });
});
