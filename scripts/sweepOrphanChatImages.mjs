/**
 * 주인이 사라진 채팅 사진을 찾아 지운다.
 *
 * `npm run sweep:chat-images`          찾기만 한다(기본)
 * `npm run sweep:chat-images -- --go`  진짜 지운다
 *
 * 왜 필요한가
 * ----------
 * `chat-images`의 경로는 `{room_id}/{user_id}/…`다(0008). 탈퇴할 때 Edge Function이
 * 치우지만 **끊길 수 있다** — 함수 실행 시간에 걸리거나, 상한(500폴더)을 넘거나,
 * 무엇보다 **그 코드가 배포되지 않은 채로 탈퇴가 일어날 수 있다**(2026-08-10에 실제로 그랬다).
 *
 * 그렇게 남은 파일은 **누구도 지울 수 없다.** 주인이 이미 없으니 그 사람의 탈퇴가 다시
 * 일어날 일이 없고, 방도 사라져 정책이 볼 근거도 없다. 사람이 와서 치워야 한다.
 *
 * 무엇을 고아로 보는가 — 규칙 둘
 * -----------------------------
 * 판정 기준은 하나다: **아무도 못 읽는 파일인가.** `chat_images_select`(0008)가 읽기를 허락하는
 * 조건이 "그 방이 있고 내가 그 방 참여자일 것"이라, 그 조건이 영영 참이 될 수 없으면 쓰레기다.
 * 그렇게 되는 길이 둘이다.
 *
 *   ① 주인 없음 — 경로 둘째 칸(`user_id`)이 `auth.users`에 없다.
 *                 참여자 자리가 비었으니 방이 살아 있어도 못 읽는다.
 *   ② 방 없음   — 경로 첫 칸(`room_id`)이 `chat_rooms`에 없다.
 *                 **주인이 살아 있어도** 볼 근거가 되는 행이 없다.
 *
 * **②가 "상대가 올린 사진" 자리다.** A가 탈퇴하면 방이 cascade로 사라지는데, 그 방에 B가 올린
 * 사진은 B가 멀쩡히 살아 있어 ①에 안 걸린다. B가 탈퇴할 때 훑기가 줍기는 하지만
 * **B가 영영 탈퇴하지 않으면 영영 남는다.** 그래서 규칙을 하나 더 둔다.
 *
 * 방 번호는 다시 쓰이지 않는다(`bigint generated always as identity`). 지금 없는 방이
 * 나중에 되살아나는 일이 없으므로 ②는 되돌아볼 여지가 없는 판정이다.
 *
 * **기본이 찾기만 하는 것**인 이유는 되돌릴 수 없어서다. 목록을 눈으로 보고 `--go`를 붙인다.
 */

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const BUCKET = 'chat-images';
const LIST_PAGE_SIZE = 100;

function loadEnvLocal() {
  let raw = '';

  try {
    raw = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
  } catch {
    return;
  }

  for (const line of raw.split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);

    if (match !== null && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  }
}

function requireEnv(name) {
  const value = process.env[name];

  if (value === undefined || value === '') {
    console.error(`${name}가 필요하다. .env.local에 있어야 한다.`);
    process.exit(1);
  }

  return value;
}

/** 한 폴더를 끝까지 넘기며 읽는다. 못 읽으면 거기서 멈춘다 — 뒷정리라서 그렇다. */
async function listAll(admin, prefix) {
  const entries = [];
  let offset = 0;

  for (;;) {
    const { data, error } = await admin.storage
      .from(BUCKET)
      .list(prefix, { limit: LIST_PAGE_SIZE, offset });

    if (error !== null || data === null) {
      return entries;
    }

    entries.push(...data);

    if (data.length < LIST_PAGE_SIZE) {
      return entries;
    }
    offset += LIST_PAGE_SIZE;
  }
}

function foldersOf(entries) {
  return entries
    .filter(function isFolder(entry) {
      return entry.id === null;
    })
    .map(function toName(entry) {
      return entry.name;
    });
}

function filesOf(entries) {
  return entries
    .filter(function isFile(entry) {
      return entry.id !== null;
    })
    .map(function toName(entry) {
      return entry.name;
    });
}

/**
 * 살아 있는 사용자 id 집합.
 *
 * 한 번에 받아 두고 메모리에서 판단한다. 파일마다 물어보면 왕복이 파일 수만큼 든다.
 */
async function fetchLiveUserIds(admin) {
  const live = new Set();
  let page = 1;

  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });

    if (error !== null) {
      console.error('사용자 목록을 읽지 못했다.');
      console.error(error);
      process.exit(1);
    }

    for (const user of data.users) {
      live.add(user.id);
    }

    if (data.users.length < 200) {
      return live;
    }
    page += 1;
  }
}

/** 살아 있는 방 번호 집합. 서비스 키라 RLS를 지나간다. */
async function fetchLiveRoomIds(admin) {
  const { data, error } = await admin.from('chat_rooms').select('id');

  if (error !== null) {
    console.error('채팅방 목록을 읽지 못했다.');
    console.error(error);
    process.exit(1);
  }

  return new Set(
    data.map(function toKey(row) {
      return String(row.id);
    }),
  );
}

async function main() {
  loadEnvLocal();

  const admin = createClient(requireEnv('VITE_SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const isGo = process.argv.includes('--go');
  const liveUsers = await fetchLiveUserIds(admin);
  const liveRooms = await fetchLiveRoomIds(admin);
  const roomFolders = foldersOf(await listAll(admin, ''));

  console.log(
    `\n방 폴더 ${roomFolders.length}개 · 살아 있는 방 ${liveRooms.size}개 · 계정 ${liveUsers.size}개\n`,
  );

  /** `{ path, reason }`. 왜 지우는지를 함께 들고 다녀야 찾기만 했을 때 눈으로 판단할 수 있다. */
  const orphans = [];

  for (const room of roomFolders) {
    // ② 방이 없으면 그 폴더는 통째로 쓰레기다. 누구 것인지 물을 필요도 없다.
    const isDeadRoom = !liveRooms.has(room);

    for (const owner of foldersOf(await listAll(admin, room))) {
      // ① 주인 없음.
      const isDeadOwner = !liveUsers.has(owner);

      if (!isDeadRoom && !isDeadOwner) {
        continue;
      }

      const reason = isDeadRoom ? '방 없음' : '주인 없음';

      for (const file of filesOf(await listAll(admin, `${room}/${owner}`))) {
        orphans.push({ path: `${room}/${owner}/${file}`, reason });
      }
    }
  }

  if (orphans.length === 0) {
    console.log('아무도 못 읽는 파일이 없다.\n');
    return;
  }

  console.log(`아무도 못 읽는 파일 ${orphans.length}개:`);
  for (const orphan of orphans) {
    console.log(`  [${orphan.reason}] ${orphan.path}`);
  }

  if (!isGo) {
    console.log('\n찾기만 했다. 지우려면 --go를 붙인다.\n');
    return;
  }

  const paths = orphans.map(function toPath(orphan) {
    return orphan.path;
  });
  const { error } = await admin.storage.from(BUCKET).remove(paths);

  if (error !== null) {
    console.error('\n지우지 못했다.');
    console.error(error);
    process.exit(1);
  }

  console.log(`\n${paths.length}개를 지웠다.\n`);
}

await main();
