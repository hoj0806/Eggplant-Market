import { getAdminClient } from './supabaseAdminClient';

/**
 * 스토리지를 만지는 통합 테스트의 공용 도구.
 *
 * 뒷정리 경로가 일곱 군데인데(회원탈퇴 · 아바타 교체/삭제 · 게시물 사진 교체/삭제 ·
 * 게시물 삭제 · 채팅방 나가기 · 업로드 보상) **전부 같은 모양의 위험을 안고 있다.**
 *
 * > `remove()`는 **없는 경로를 지워도 성공한다.**
 *
 * 즉 경로를 한 글자라도 틀리게 만들면 **오류 없이 아무 일도 안 일어난다.** 파일은 그대로
 * 쌓이고 아무 신호도 안 뜬다. 그래서 이 계층의 검증은 "지웠나"가 아니라
 * **"우리가 만든 경로가 진짜 파일과 맞나"** 를 물어야 한다.
 *
 * 확인에 서비스 키를 쓴다. 다른 통합 테스트는 "안 보여야 할 것이 안 보인다"를 보려고
 * 익명으로 확인하지만, 여기서 재는 것은 정책이 아니라 **파일이 남았는가**다.
 */

/** 가장 작은 PNG 머리말. 내용은 상관없고 바이트가 있기만 하면 된다. */
export const PIXEL_PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** 올리고 **공개 URL**을 돌려준다 — 앱이 DB에 저장하는 것이 바로 이 값이다. */
export async function uploadObject(bucket: string, path: string): Promise<string> {
  const admin = getAdminClient();
  const { error } = await admin.storage
    .from(bucket)
    .upload(path, PIXEL_PNG, { contentType: 'image/png', upsert: true });

  if (error !== null) {
    throw new Error(`씨앗 업로드 실패 (${bucket}/${path}): ${error.message}`);
  }

  return admin.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

export async function objectExists(bucket: string, path: string): Promise<boolean> {
  const slash = path.lastIndexOf('/');
  const { data, error } = await getAdminClient()
    .storage.from(bucket)
    .list(path.slice(0, slash), { limit: 100, offset: 0 });

  if (error !== null || data === null) {
    return false;
  }

  const name = path.slice(slash + 1);

  return data.some(function hasName(entry: { name: string }): boolean {
    return entry.name === name;
  });
}

export async function removeObjects(
  bucket: string,
  paths: ReadonlyArray<string>,
): Promise<void> {
  if (paths.length === 0) {
    return;
  }

  await getAdminClient().storage.from(bucket).remove([...paths]);
}
