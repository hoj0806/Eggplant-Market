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
 * 무엇을 고아로 보는가
 * -------------------
 * **경로 둘째 칸(`user_id`)의 주인이 `auth.users`에 없는 파일.** 방이 있는지는 묻지 않는다 —
 * 방은 살아 있어도 주인이 없으면 그 사진은 아무도 못 읽는다(`chat_images_select`가
 * "그 방의 참여자"를 요구하는데 참여자 자리가 비었다).
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

async function main() {
  loadEnvLocal();

  const admin = createClient(requireEnv('VITE_SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const isGo = process.argv.includes('--go');
  const live = await fetchLiveUserIds(admin);
  const roomFolders = foldersOf(await listAll(admin, ''));

  console.log(`\n방 폴더 ${roomFolders.length}개 · 살아 있는 계정 ${live.size}개\n`);

  const orphans = [];

  for (const room of roomFolders) {
    for (const owner of foldersOf(await listAll(admin, room))) {
      if (live.has(owner)) {
        continue;
      }

      for (const file of filesOf(await listAll(admin, `${room}/${owner}`))) {
        orphans.push(`${room}/${owner}/${file}`);
      }
    }
  }

  if (orphans.length === 0) {
    console.log('고아 파일이 없다.\n');
    return;
  }

  console.log(`주인이 없는 파일 ${orphans.length}개:`);
  for (const path of orphans) {
    console.log(`  ${path}`);
  }

  if (!isGo) {
    console.log('\n찾기만 했다. 지우려면 --go를 붙인다.\n');
    return;
  }

  const { error } = await admin.storage.from(BUCKET).remove(orphans);

  if (error !== null) {
    console.error('\n지우지 못했다.');
    console.error(error);
    process.exit(1);
  }

  console.log(`\n${orphans.length}개를 지웠다.\n`);
}

await main();
