import { randomUUID } from 'node:crypto';
import { getAdminClient } from '../../../shared/testUtils/integration/supabaseAdminClient';
import {
  objectExists,
  removeObjects,
  uploadObject,
} from '../../../shared/testUtils/integration/storageFixtures';
import { toAvatarStoragePath } from '../utils/avatarStoragePath';

/**
 * 뒷정리 경로 ①② — 프로필 사진 **교체**와 **삭제**.
 *
 * 둘 다 `profileApi.removeAvatarObject`로 모인다. 그 함수가 하는 일은 딱 둘이다.
 *
 * ```
 * toAvatarStoragePath(avatar_url)   공개 URL → 스토리지 경로
 * storage.remove([path])            그 경로를 지운다
 * ```
 *
 * 앞엣것은 단위 테스트가 이미 본다(`avatarStoragePath.test.ts`). 하지만 그 테스트가 아는
 * 공개 URL은 **사람이 손으로 적은 모양**이다. Supabase가 실제로 만들어 주는 주소가 그 모양이
 * 맞는지는 아무도 확인한 적이 없고, **틀려도 아무 신호가 안 뜬다** —
 * `remove()`는 없는 경로에도 성공하기 때문이다.
 *
 * 그래서 여기서는 **왕복**을 본다. 진짜로 올리고 → 진짜 공개 URL을 받고 →
 * 그것을 되짚어 → 진짜로 지워지는지.
 */

const BUCKET = 'avatars';
const USER = randomUUID();
const OWNED: string[] = [];

async function seedAvatar(fileName: string): Promise<{ path: string; publicUrl: string }> {
  const path = `${USER}/${fileName}`;
  const publicUrl = await uploadObject(BUCKET, path);

  OWNED.push(path);
  return { path, publicUrl };
}

describe('프로필 사진 뒷정리 (실제 저장소)', function avatarCleanupSuite() {
  afterAll(async function cleanup() {
    await removeObjects(BUCKET, OWNED);
  });

  it('진짜 공개 URL이 원래 경로로 되짚힌다', async function publicUrlRoundTrips() {
    // 앱이 `uploadAvatar`에서 붙이는 이름 모양(타임스탬프).
    const { path, publicUrl } = await seedAvatar(`${Date.now()}.png`);

    expect(publicUrl).toContain('/storage/v1/object/public/avatars/');
    expect(toAvatarStoragePath(publicUrl)).toBe(path);
  });

  it('되짚은 경로로 지우면 진짜 지워진다 — ② 사진 삭제', async function removeActuallyDeletes() {
    const { path, publicUrl } = await seedAvatar(`${Date.now()}-remove.png`);
    expect(await objectExists(BUCKET, path)).toBe(true);

    // removeAvatarObject가 하는 것과 같은 두 걸음.
    const resolved = toAvatarStoragePath(publicUrl);
    await removeObjects(BUCKET, [resolved as string]);

    expect(await objectExists(BUCKET, path)).toBe(false);
  });

  it('교체하면 옛 파일만 사라지고 새 파일은 남는다 — ① 사진 교체', async function replaceKeepsNewOnly() {
    const previous = await seedAvatar(`${Date.now()}-old.png`);
    const next = await seedAvatar(`${Date.now()}-new.png`);

    // 교체는 새 파일을 올린 뒤 **옛 URL**을 지우는 순서다(profileApi).
    await removeObjects(BUCKET, [toAvatarStoragePath(previous.publicUrl) as string]);

    expect(await objectExists(BUCKET, previous.path)).toBe(false);
    expect(await objectExists(BUCKET, next.path)).toBe(true);
  });

  it('없는 경로를 지워도 오류가 안 난다 — 이 계층의 위험 그 자체', async function removeIsSilent() {
    // **경로를 틀리면 조용히 아무 일도 안 일어난다.** 위 왕복 검사가 필요한 이유다.
    const { error } = await getAdminClient()
      .storage.from(BUCKET)
      .remove([`${USER}/이런-파일은-없다.png`]);

    expect(error).toBeNull();
  });

  it('외부 URL은 경로가 없어 건드리지 않는다', async function skipsForeignUrls() {
    // 구글 프로필 사진이 들어와 있을 때 엉뚱한 경로를 만들어 지우려 드는 일을 막는 자리.
    expect(toAvatarStoragePath('https://lh3.googleusercontent.com/a/abc123')).toBeNull();
  });
});
