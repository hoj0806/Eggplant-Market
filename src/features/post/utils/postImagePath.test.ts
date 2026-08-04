import { toPostImagePath, toPostImagePaths } from './postImagePath';

const BASE = 'https://hcmpbpeyhmmismxjkkzv.supabase.co/storage/v1/object/public/post-images';

describe('toPostImagePath', function pathSuite() {
  it('공개 URL에서 버킷 안 경로만 꺼낸다', function normalCase() {
    expect(toPostImagePath(`${BASE}/user-1/1754300000000-0.jpg`)).toBe(
      'user-1/1754300000000-0.jpg',
    );
  });

  it('쿼리 문자열은 걷어낸다', function queryCase() {
    expect(toPostImagePath(`${BASE}/user-1/photo.jpg?t=1754300000000`)).toBe('user-1/photo.jpg');
  });

  it('퍼센트 인코딩을 되돌린다 — remove()는 날것의 경로를 받는다', function encodedCase() {
    expect(toPostImagePath(`${BASE}/user-1/%EC%82%AC%EC%A7%84.jpg`)).toBe('user-1/사진.jpg');
  });

  it('우리 버킷이 아닌 주소는 정리 대상에서 뺀다', function foreignCase() {
    expect(toPostImagePath('https://example.test/photo.jpg')).toBeNull();
    expect(
      toPostImagePath('https://hcmpbpeyhmmismxjkkzv.supabase.co/storage/v1/object/public/avatars/a.jpg'),
    ).toBeNull();
  });

  it('경로가 비어 있으면 null이다', function emptyCase() {
    expect(toPostImagePath(`${BASE}/`)).toBeNull();
  });
});

describe('toPostImagePaths', function pathsSuite() {
  it('되짚을 수 있는 주소만 남긴다', function filterCase() {
    const paths = toPostImagePaths([
      `${BASE}/user-1/a.jpg`,
      'https://example.test/b.jpg',
      `${BASE}/user-1/c.jpg`,
    ]);

    expect(paths).toEqual(['user-1/a.jpg', 'user-1/c.jpg']);
  });
});
