import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getAdminClient } from '../../../src/shared/testUtils/integration/supabaseAdminClient';
import {
  type StorageEntry,
  sweepOrphanChatImages,
} from './chatImageSweep';

/**
 * **통합 테스트에서 스토리지를 처음 만지는 자리다.**
 *
 * `chatImageSweep.test.ts`가 "어느 폴더를 훑고 무엇을 지울지"라는 **판단**을 가짜로 확인한다면,
 * 여기서는 **진짜 저장소가 정말 그렇게 생겼는지**를 본다. 훑기가 기대는 성질이 셋인데
 * 전부 Supabase Storage의 동작이라 코드만 봐서는 알 수 없다.
 *
 *   1. 최상위를 `list('')` 하면 방 폴더가 `id: null`로 온다
 *   2. `{방}/{내id}`를 list하면 내 파일만 온다 — 남의 폴더에 안 닿는다
 *   3. 방 행이 없어도 위 둘이 그대로 된다  ← **이 버그의 핵심**
 *
 * 방 행이 없는 상황을 만들려고 **존재하지 않는 방 번호**로 파일을 올린다.
 * 실제로는 남의 탈퇴에 방이 cascade로 사라져 같은 상태가 된다(backlog.md §1-3).
 *
 * 확인에 서비스 키를 쓴다. 다른 통합 테스트는 "안 보여야 할 것이 안 보인다"를 보려고
 * 익명 클라이언트로 확인하지만, 여기서 재는 것은 정책이 아니라 **뒷정리가 파일을 지웠는가**다.
 * 게다가 `chat_images_select`가 방 행을 요구해 **고아 파일은 원래 아무도 못 읽는다** —
 * 익명으로는 지워졌는지조차 확인할 수 없다.
 */

const BUCKET = 'chat-images';
const PIXEL = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// **UUID여야 한다.** 경로 두 번째 칸은 `auth.uid()`이고(0008), `chat_rooms`의
// `buyer_id`·`seller_id`도 uuid다 — 아무 문자열이나 쓰면 아래 방 조회가 타입 오류로 죽는다.
const OWNER = randomUUID();
const BYSTANDER = randomUUID();

/** 진짜로 없는 방 번호. `chat_rooms`는 작은 수를 쓰므로 부딪히지 않는다. */
const ORPHAN_ROOM_ID = 900_000_000 + Math.floor(Math.random() * 1_000_000);

const admin: SupabaseClient = getAdminClient();

function listPage(prefix: string, offset: number, limit: number): Promise<StorageEntry[]> {
  return admin.storage
    .from(BUCKET)
    .list(prefix, { limit, offset })
    .then(function toEntries({ data, error }): StorageEntry[] {
      if (error !== null || data === null) {
        return [];
      }
      return data as StorageEntry[];
    });
}

async function removePaths(paths: ReadonlyArray<string>): Promise<void> {
  await admin.storage.from(BUCKET).remove([...paths]);
}

async function upload(path: string): Promise<void> {
  const { error } = await admin.storage
    .from(BUCKET)
    .upload(path, PIXEL, { contentType: 'image/png', upsert: true });

  if (error !== null) {
    throw new Error(`씨앗 업로드 실패 (${path}): ${error.message}`);
  }
}

async function exists(path: string): Promise<boolean> {
  const slash = path.lastIndexOf('/');
  const entries = await listPage(path.slice(0, slash), 0, 100);

  return entries.some(function hasName(entry: StorageEntry): boolean {
    return entry.name === path.slice(slash + 1);
  });
}

const ownerPath = `${ORPHAN_ROOM_ID}/${OWNER}/photo.png`;
const bystanderPath = `${ORPHAN_ROOM_ID}/${BYSTANDER}/photo.png`;

describe('고아 채팅 사진 훑기 (실제 저장소)', function orphanSweepSuite() {
  beforeAll(async function seed() {
    await upload(ownerPath);
    await upload(bystanderPath);
  });

  afterAll(async function cleanup() {
    // 심은 것만 치운다. 훑기가 이미 지웠으면 두 번 지워도 탈이 없다.
    await removePaths([ownerPath, bystanderPath]);
  });

  it('방 행이 정말 없다', async function roomRowIsAbsent() {
    // 이 전제가 깨지면 아래 검증이 다른 상황을 재게 된다.
    const { data } = await admin.from('chat_rooms').select('id').eq('id', ORPHAN_ROOM_ID);

    expect(data).toEqual([]);
  });

  it('방 기록으로는 못 찾는다 — 고치기 전의 그 자리', async function roomRecordFindsNothing() {
    // `fetchRoomIds`가 하는 일과 같다. 방이 없으니 빈 배열이고, 훑을 경로를 못 만든다.
    const { data } = await admin
      .from('chat_rooms')
      .select('id')
      .or(`buyer_id.eq.${OWNER},seller_id.eq.${OWNER}`);

    expect(data).toEqual([]);
  });

  it('버킷 최상위에 방 폴더가 보인다', async function rootListsRoomFolder() {
    // 훑기가 기대는 첫 번째 성질. 폴더는 `id: null`로 온다.
    const entries = await listPage('', 0, 100);
    const found = entries.find(function byName(entry: StorageEntry): boolean {
      return entry.name === String(ORPHAN_ROOM_ID);
    });

    expect(found).toBeDefined();
    expect(found?.id).toBeNull();
  });

  it('훑으면 내 사진을 찾아 지운다', async function sweepRemovesOwnFile() {
    expect(await exists(ownerPath)).toBe(true);

    const removed = await sweepOrphanChatImages(listPage, removePaths, OWNER, []);

    expect(removed).toContain(ownerPath);
    expect(await exists(ownerPath)).toBe(false);
  });

  it('같은 방의 남의 사진은 남는다', async function sweepLeavesOtherUserFile() {
    // 방을 통째로 비우지 않는다. 상대가 올린 사진은 그 사람이 탈퇴할 때 지워진다.
    expect(await exists(bystanderPath)).toBe(true);
  });
});
