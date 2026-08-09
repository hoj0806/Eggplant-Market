import { randomUUID } from 'node:crypto';
import {
  objectExists,
  removeObjects,
  uploadObject,
} from '../../../shared/testUtils/integration/storageFixtures';
import { POST_IMAGE_BUCKET, toPostImagePath, toPostImagePaths } from '../utils/postImagePath';

/**
 * 뒷정리 경로 ③⑥ — 게시물 사진 **교체·삭제**(`removePostImageFiles`)와
 * 업로드 **중간 실패의 보상 삭제**(`removeUploadedImages`).
 *
 * 둘 다 같은 두 걸음으로 모인다.
 *
 * ```
 * toPostImagePaths(공개 URL들)   →  경로들
 * storage.remove(경로들)         →  지운다
 * ```
 *
 * 아바타와 다른 점이 하나 있어 따로 본다. **`toPostImagePath`는 `decodeURIComponent`를 한다.**
 * 사진 이름에 한글이나 공백이 들어가면 공개 URL에서는 퍼센트 인코딩되는데, `remove()`는
 * **날것의 경로**를 받기 때문이다. 되짚기가 그 변환을 정확히 되돌리는지는
 * **진짜 URL로만 확인된다** — 손으로 적은 URL로는 인코딩 규칙이 같은지 알 수 없다.
 */

const USER = randomUUID();
const OWNED: string[] = [];

async function seedImage(fileName: string): Promise<{ path: string; publicUrl: string }> {
  const path = `${USER}/${fileName}`;
  const publicUrl = await uploadObject(POST_IMAGE_BUCKET, path);

  OWNED.push(path);
  return { path, publicUrl };
}

describe('게시물 사진 뒷정리 (실제 저장소)', function postImageCleanupSuite() {
  afterAll(async function cleanup() {
    await removeObjects(POST_IMAGE_BUCKET, OWNED);
  });

  it('진짜 공개 URL이 원래 경로로 되짚힌다', async function publicUrlRoundTrips() {
    const { path, publicUrl } = await seedImage(`${Date.now()}-plain.png`);

    expect(publicUrl).toContain('/storage/v1/object/public/post-images/');
    expect(toPostImagePath(publicUrl)).toBe(path);
  });

  it('이름에 공백이 있어도 되짚힌다', async function decodesEncodedNames() {
    // 여기가 아바타와 갈리는 자리다. 공백은 공개 URL에서 `%20`이 되는데 remove()는
    // 날것을 받는다. `decodeURIComponent`가 그 변환을 정확히 되돌리는지 본다.
    //
    // 한글 이름으로는 못 잰다 — **스토리지가 키 자체를 거절한다**(`Invalid key`).
    // 앱은 `{stamp}-{index}.{ext}`로만 올리므로(uploadPostImages) 실제로는 둘 다 안 생긴다.
    // 그래도 되짚기가 인코딩을 다룰 줄 아는지는 확인해 둔다.
    const { path, publicUrl } = await seedImage(`${Date.now()} space.png`);

    expect(publicUrl).toContain('%20');
    expect(toPostImagePath(publicUrl)).toBe(path);
  });

  it('되짚은 경로로 지우면 진짜 지워진다 — ③ 사진 교체·삭제', async function removeActuallyDeletes() {
    const { path, publicUrl } = await seedImage(`${Date.now()}-remove.png`);
    expect(await objectExists(POST_IMAGE_BUCKET, path)).toBe(true);

    await removeObjects(POST_IMAGE_BUCKET, toPostImagePaths([publicUrl]));

    expect(await objectExists(POST_IMAGE_BUCKET, path)).toBe(false);
  });

  it('여러 장을 한 번에 지운다 — ⑥ 업로드 중간 실패의 보상', async function removesEveryUploadedFile() {
    // 세 장 중 마지막에서 실패하면 앞의 둘을 되돌린다. 하나라도 남으면 보상이 아니다.
    const first = await seedImage(`${Date.now()}-a.png`);
    const second = await seedImage(`${Date.now()}-b.png`);

    await removeObjects(
      POST_IMAGE_BUCKET,
      toPostImagePaths([first.publicUrl, second.publicUrl]),
    );

    expect(await objectExists(POST_IMAGE_BUCKET, first.path)).toBe(false);
    expect(await objectExists(POST_IMAGE_BUCKET, second.path)).toBe(false);
  });

  it('남의 버킷 주소가 섞여도 우리 것만 지운다', async function ignoresForeignUrls() {
    const mine = await seedImage(`${Date.now()}-mixed.png`);
    const urls = [mine.publicUrl, 'https://example.com/other.png'];

    expect(toPostImagePaths(urls)).toEqual([mine.path]);

    await removeObjects(POST_IMAGE_BUCKET, toPostImagePaths(urls));
    expect(await objectExists(POST_IMAGE_BUCKET, mine.path)).toBe(false);
  });
});
