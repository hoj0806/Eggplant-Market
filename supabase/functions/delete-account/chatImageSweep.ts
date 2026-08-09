// 탈퇴한 사람의 채팅 사진을 **방 기록 없이도** 찾아 지운다.
//
// ── 왜 필요한가 ────────────────────────────────────────────────────────
// `chat-images`의 경로는 `{room_id}/{user_id}/…`다(0008). 지울 경로를 아는 유일한 근거가
// `chat_rooms` 행인데, **그 행이 남의 탈퇴에 딸려 먼저 사라진다.**
//
//   탈퇴 ②  방 주인이 사라짐 → chat_rooms 행이 cascade로 삭제
//   탈퇴 ③  사진 올린 본인
//             fetchRoomIds() → 방이 이미 없어 빈 배열
//             → `{방번호}/{본인}` 경로를 훑지 못함 → 파일이 남는다
//
// **자기 사진인데도** 못 지운다. 그래서 방 기록 대신 **버킷을 훑어** 같은 것을 찾는다.
//
// ── 왜 Deno 파일에서 떼어 냈는가 ───────────────────────────────────────
// `index.ts`는 Deno 런타임과 `npm:` 지정자에 묶여 있어 Jest가 못 읽는다. 그런데
// "어느 폴더를 훑을지"는 순수 계산이라 **테스트할 수 있어야 하는 부분**이다.
// 그래서 저장소 접근을 함수 둘로 받는다(`ListPage`·`RemovePaths`) — Deno는 진짜
// 클라이언트를, 테스트는 가짜를 끼운다. 클라이언트 타입에 기대지 않으므로 양쪽이 같이 쓴다.

/** storage.list의 기본 상한이 100이다. 그 이상은 offset으로 넘긴다. */
export const LIST_PAGE_SIZE = 100;

/**
 * 버킷 훑기가 들여다볼 방 폴더의 최대 수.
 *
 * 방 하나에 list 호출 하나가 든다. 상한이 없으면 방이 늘어날수록 탈퇴가 느려지다가
 * 함수 실행 시간에 걸려 통째로 실패한다. **뒷정리가 못 끝나도 탈퇴 자체는 성공해야 하므로**
 * 넘으면 조용히 멈춘다 — 남는 파일은 아무도 못 읽는 쓰레기라 다음에 치워도 된다.
 */
export const MAX_SWEPT_ROOM_FOLDERS = 500;

/** `remove`에 한 번에 넘길 경로 수. 너무 길면 요청이 거부된다. */
export const REMOVE_BATCH_SIZE = 100;

/** 동시에 던질 list 요청 수. 순차로 돌리면 방 500개가 그대로 500번의 왕복이 된다. */
export const LIST_CONCURRENCY = 8;

/** storage.list가 돌려주는 것 중 이 모듈이 쓰는 만큼만. 폴더는 `id`가 null로 온다. */
export type StorageEntry = {
  name: string;
  id: string | null;
};

export type ListPage = (
  prefix: string,
  offset: number,
  limit: number,
) => Promise<ReadonlyArray<StorageEntry>>;

export type RemovePaths = (paths: ReadonlyArray<string>) => Promise<void>;

/** 한 폴더를 끝까지 넘기며 읽는다. 못 읽으면 거기서 멈춘다 — 뒷정리라서 그렇다. */
export async function listAllEntries(
  listPage: ListPage,
  prefix: string,
): Promise<StorageEntry[]> {
  const entries: StorageEntry[] = [];
  let offset = 0;

  for (;;) {
    const page = await listPage(prefix, offset, LIST_PAGE_SIZE);

    entries.push(...page);

    if (page.length < LIST_PAGE_SIZE) {
      return entries;
    }
    offset += LIST_PAGE_SIZE;
  }
}

export function pickFolderNames(entries: ReadonlyArray<StorageEntry>): string[] {
  return entries
    .filter(function isFolder(entry: StorageEntry): boolean {
      return entry.id === null;
    })
    .map(function toName(entry: StorageEntry): string {
      return entry.name;
    });
}

export function pickFileNames(entries: ReadonlyArray<StorageEntry>): string[] {
  return entries
    .filter(function isFile(entry: StorageEntry): boolean {
      return entry.id !== null;
    })
    .map(function toName(entry: StorageEntry): string {
      return entry.name;
    });
}

/**
 * 훑을 방 폴더를 고른다.
 *
 * - **이미 방 기록으로 훑은 방은 뺀다.** 같은 폴더를 두 번 볼 이유가 없다.
 * - **숫자가 아닌 폴더도 뺀다.** 경로 첫 칸은 언제나 방 번호다(0008). 숫자가 아니면
 *   우리가 만든 것이 아니므로 상한을 거기에 쓰지 않는다.
 * - 상한을 넘으면 자른다.
 */
export function planSweepFolders(
  folderNames: ReadonlyArray<string>,
  knownRoomIds: ReadonlyArray<number>,
  limit: number = MAX_SWEPT_ROOM_FOLDERS,
): string[] {
  const alreadySwept = new Set(
    knownRoomIds.map(function toKey(roomId: number): string {
      return String(roomId);
    }),
  );

  return folderNames
    .filter(function isUnvisitedRoomFolder(name: string): boolean {
      return /^\d+$/.test(name) && !alreadySwept.has(name);
    })
    .slice(0, limit);
}

/** 앞에서부터 `limit`개씩 동시에 돌린다. 순서는 지켜서 돌려준다. */
export async function mapWithLimit<Item, Result>(
  items: ReadonlyArray<Item>,
  limit: number,
  run: (item: Item) => Promise<Result>,
): Promise<Result[]> {
  const results: Result[] = new Array<Result>(items.length);
  let next = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const index = next;
      next += 1;

      if (index >= items.length) {
        return;
      }
      results[index] = await run(items[index]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, function startWorker(): Promise<void> {
      return worker();
    }),
  );

  return results;
}

export function toBatches<Item>(items: ReadonlyArray<Item>, size: number): Item[][] {
  const batches: Item[][] = [];

  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}

/**
 * 버킷을 훑어 `{방}/{내id}/…`를 지운다. **지운 경로를 돌려준다.**
 *
 * 방 기록으로 훑는 기존 길을 대신하는 것이 아니라 **못 찾은 나머지를 줍는 두 번째 그물**이다.
 * 그쪽이 훨씬 싸고 대부분의 탈퇴는 방이 살아 있는 상태에서 일어나므로, 먼저 그 길로 훑고
 * 여기서는 `knownRoomIds`를 건너뛴다.
 *
 * 정책은 손댈 것이 없다 — `chat_images_delete`에 **방이 없으면 삭제 허용** 조항이
 * 이미 있다(0032). 게다가 여기서 부르는 것은 service_role이라 정책을 지나간다.
 */
export async function sweepOrphanChatImages(
  listPage: ListPage,
  removePaths: RemovePaths,
  userId: string,
  knownRoomIds: ReadonlyArray<number>,
): Promise<string[]> {
  const rootEntries = await listAllEntries(listPage, '');
  const folders = planSweepFolders(pickFolderNames(rootEntries), knownRoomIds);

  const perFolder = await mapWithLimit(
    folders,
    LIST_CONCURRENCY,
    async function collectPaths(folder: string): Promise<string[]> {
      const prefix = `${folder}/${userId}`;
      const entries = await listAllEntries(listPage, prefix);

      return pickFileNames(entries).map(function toPath(name: string): string {
        return `${prefix}/${name}`;
      });
    },
  );

  const paths = perFolder.flat();

  for (const batch of toBatches(paths, REMOVE_BATCH_SIZE)) {
    await removePaths(batch);
  }

  return paths;
}
