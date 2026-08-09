import {
  LIST_PAGE_SIZE,
  MAX_SWEPT_ROOM_FOLDERS,
  REMOVE_BATCH_SIZE,
  type StorageEntry,
  listAllEntries,
  mapWithLimit,
  pickFileNames,
  pickFolderNames,
  planSweepFolders,
  sweepOrphanChatImages,
  toBatches,
} from './chatImageSweep';

/**
 * Edge Function은 Deno에서 돌아 Jest가 못 읽는다. 그래서 **어느 폴더를 훑고 무엇을 지울지**를
 * 저장소 접근에서 떼어 냈고(`ListPage`·`RemovePaths`), 여기서 가짜를 끼워 확인한다.
 *
 * 실제 저장소가 정말 그렇게 동작하는지는 `chatImageSweep.int.test.ts`가 본다 —
 * **여기는 판단을, 저기는 저장소를** 검증한다.
 */

const USER = 'user-11111111';
const OTHER_USER = 'user-22222222';

function folder(name: string): StorageEntry {
  // storage.list는 폴더를 `id: null`로 돌려준다.
  return { name, id: null };
}

function file(name: string): StorageEntry {
  return { name, id: `id-${name}` };
}

/** 경로 → 그 안의 항목. 없는 경로는 빈 배열이다(실제 storage와 같다). */
function fakeStorage(tree: Record<string, StorageEntry[]>) {
  const listed: string[] = [];

  async function listPage(prefix: string, offset: number, limit: number) {
    listed.push(prefix);
    return (tree[prefix] ?? []).slice(offset, offset + limit);
  }

  return { listPage, listed };
}

describe('폴더와 파일 가르기', function pickSuite() {
  const entries = [folder('12'), file('a.png'), folder('34'), file('b.png')];

  it('폴더만 고른다', function picksFolders() {
    expect(pickFolderNames(entries)).toEqual(['12', '34']);
  });

  it('파일만 고른다', function picksFiles() {
    expect(pickFileNames(entries)).toEqual(['a.png', 'b.png']);
  });
});

describe('훑을 방 고르기', function planSuite() {
  it('방 기록으로 이미 훑은 방은 뺀다', function skipsKnownRooms() {
    // 같은 폴더를 두 번 볼 이유가 없다.
    expect(planSweepFolders(['10', '11', '12'], [11])).toEqual(['10', '12']);
  });

  it('숫자가 아닌 폴더는 뺀다', function skipsNonRoomFolders() {
    // 경로 첫 칸은 언제나 방 번호다(0008). 아니면 우리가 만든 것이 아니다.
    expect(planSweepFolders(['10', '.emptyFolderPlaceholder', 'tmp'], [])).toEqual(['10']);
  });

  it('상한을 넘으면 자른다', function stopsAtLimit() {
    const many = Array.from({ length: 5 }, function toName(_unused, index: number): string {
      return String(index);
    });

    expect(planSweepFolders(many, [], 3)).toEqual(['0', '1', '2']);
  });

  it('기본 상한이 정해져 있다', function hasDefaultLimit() {
    // 상한이 없으면 방이 늘어날수록 탈퇴가 느려지다 함수 실행 시간에 걸려 통째로 실패한다.
    const many = Array.from(
      { length: MAX_SWEPT_ROOM_FOLDERS + 10 },
      function toName(_unused, index: number): string {
        return String(index);
      },
    );

    expect(planSweepFolders(many, [])).toHaveLength(MAX_SWEPT_ROOM_FOLDERS);
  });

  it('방 기록이 비어 있어도 훑는다', function sweepsWithoutRoomRecords() {
    // 이 버그의 핵심이다. 남의 탈퇴에 방이 먼저 사라지면 방 기록이 빈 배열로 온다.
    expect(planSweepFolders(['159'], [])).toEqual(['159']);
  });
});

describe('페이지 넘기며 읽기', function listAllSuite() {
  it('한 쪽이 가득 차면 다음 쪽을 더 읽는다', async function readsEveryPage() {
    const full = Array.from({ length: LIST_PAGE_SIZE }, function toFile(_unused, index: number) {
      return file(`f${index}.png`);
    });
    const storage = fakeStorage({ '1/user': [...full, file('last.png')] });

    const entries = await listAllEntries(storage.listPage, '1/user');

    expect(entries).toHaveLength(LIST_PAGE_SIZE + 1);
  });

  it('덜 찬 쪽에서 멈춘다', async function stopsOnPartialPage() {
    const storage = fakeStorage({ '1/user': [file('only.png')] });

    await listAllEntries(storage.listPage, '1/user');

    // 한 번만 물어본다. 덜 찼으면 더 없다.
    expect(storage.listed).toEqual(['1/user']);
  });
});

describe('동시 실행 제한', function mapWithLimitSuite() {
  it('순서를 지켜 돌려준다', async function keepsOrder() {
    const doubled = await mapWithLimit([1, 2, 3, 4], 2, async function double(value: number) {
      return value * 2;
    });

    expect(doubled).toEqual([2, 4, 6, 8]);
  });

  it('한 번에 정해진 수만 돌린다', async function respectsLimit() {
    let running = 0;
    let peak = 0;

    await mapWithLimit([1, 2, 3, 4, 5, 6], 2, async function track() {
      running += 1;
      peak = Math.max(peak, running);
      await Promise.resolve();
      running -= 1;
      return null;
    });

    expect(peak).toBeLessThanOrEqual(2);
  });

  it('빈 목록이면 아무것도 안 돌린다', async function handlesEmpty() {
    const run = jest.fn();

    expect(await mapWithLimit([], 4, run)).toEqual([]);
    expect(run).not.toHaveBeenCalled();
  });
});

describe('묶어 지우기', function batchSuite() {
  it('상한만큼 잘라 나눈다', function splitsIntoBatches() {
    expect(toBatches([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('빈 목록은 묶음이 없다', function handlesEmpty() {
    expect(toBatches([], 10)).toEqual([]);
  });
});

describe('고아 채팅 사진 훑기', function sweepSuite() {
  it('방 기록이 없어도 내 사진을 찾아 지운다', async function findsOrphanWithoutRoomRecord() {
    // backlog.md §1-3의 그 상황. 방 159는 남의 탈퇴에 이미 사라졌다.
    const storage = fakeStorage({
      '': [folder('159')],
      '159/user-11111111': [file('photo.png')],
    });
    const removed: string[][] = [];

    const paths = await sweepOrphanChatImages(
      storage.listPage,
      async function remove(batch) {
        removed.push([...batch]);
      },
      USER,
      [],
    );

    expect(paths).toEqual(['159/user-11111111/photo.png']);
    expect(removed).toEqual([['159/user-11111111/photo.png']]);
  });

  it('남이 올린 사진은 건드리지 않는다', async function leavesOtherUsersFiles() {
    // 같은 방에 상대의 폴더가 함께 있다. 경로에 내 id가 들어가므로 서로 닿지 않는다.
    const storage = fakeStorage({
      '': [folder('159')],
      '159/user-11111111': [file('mine.png')],
      '159/user-22222222': [file('theirs.png')],
    });

    const paths = await sweepOrphanChatImages(
      storage.listPage,
      async function remove() {},
      USER,
      [],
    );

    expect(paths).toEqual(['159/user-11111111/mine.png']);
    expect(storage.listed).not.toContain(`159/${OTHER_USER}`);
  });

  it('방 기록으로 이미 훑은 방은 다시 안 본다', async function skipsAlreadySweptRooms() {
    const storage = fakeStorage({
      '': [folder('10'), folder('11')],
      '10/user-11111111': [file('a.png')],
      '11/user-11111111': [file('b.png')],
    });

    const paths = await sweepOrphanChatImages(
      storage.listPage,
      async function remove() {},
      USER,
      [10],
    );

    expect(paths).toEqual(['11/user-11111111/b.png']);
    expect(storage.listed).not.toContain('10/user-11111111');
  });

  it('지울 것이 없으면 삭제를 안 부른다', async function skipsEmptyRemoval() {
    const storage = fakeStorage({ '': [folder('10')] });
    const remove = jest.fn();

    expect(
      await sweepOrphanChatImages(storage.listPage, remove, USER, []),
    ).toEqual([]);
    expect(remove).not.toHaveBeenCalled();
  });

  it('많으면 나눠 지운다', async function removesInBatches() {
    const files = Array.from(
      { length: REMOVE_BATCH_SIZE + 1 },
      function toFile(_unused, index: number) {
        return file(`f${index}.png`);
      },
    );
    const storage = fakeStorage({ '': [folder('7')], '7/user-11111111': files });
    const sizes: number[] = [];

    await sweepOrphanChatImages(
      storage.listPage,
      async function remove(batch) {
        sizes.push(batch.length);
      },
      USER,
      [],
    );

    expect(sizes).toEqual([REMOVE_BATCH_SIZE, 1]);
  });

  it('버킷이 비어 있으면 조용히 끝난다', async function handlesEmptyBucket() {
    const storage = fakeStorage({});

    expect(await sweepOrphanChatImages(storage.listPage, async function remove() {}, USER, []))
      .toEqual([]);
  });
});
