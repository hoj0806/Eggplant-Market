// 회원탈퇴 — 이 프로젝트의 첫 Edge Function.
//
// 브라우저에서는 사용자를 지울 수 없다. `auth.admin.deleteUser`가 service_role 키를 요구하는데
// 그 키는 클라이언트에 둘 수 없기 때문이다. 그래서 여기서만 그 키를 쓴다.
//
// 지우는 사람은 **요청에 실린 토큰이 정한다.** 몸통에서 id를 받으면 남의 id를 적어 보내는 길이
// 열린다. 그래서 클라이언트가 부를 때 아무 인자도 넘기지 않는다(accountApi.deleteAccount).
//
// DB는 손대지 않는다. 0001의 FK가 모두 `on delete cascade`라 auth.users 한 행이 사라지면
// profiles → posts·chat_rooms·messages·reviews·notifications·blocks·reports까지 따라 지워진다.
// **스토리지만 따라오지 않는다** — 버킷의 파일은 DB 행이 아니라 아무 참조도 없이 남는다.
// 그 뒷정리가 이 함수가 하는 나머지 일이다.
//
// 배포: supabase functions deploy delete-account
//   (SUPABASE_URL·SUPABASE_ANON_KEY·SUPABASE_SERVICE_ROLE_KEY는 런타임이 자동으로 넣어 준다)

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

const CORS_HEADERS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
};

/** 경로 첫 칸이 사용자 id인 버킷들. `{user_id}/…` 하나만 훑으면 된다. */
const USER_PREFIXED_BUCKETS: ReadonlyArray<string> = ['avatars', 'post-images'];

/** 채팅 사진만 `{room_id}/{user_id}/…`라 방 번호를 먼저 알아내야 한다(0008). */
const CHAT_IMAGE_BUCKET = 'chat-images';

/** storage.list의 기본 상한이 100이다. 그 이상은 offset으로 넘긴다. */
const LIST_PAGE_SIZE = 100;

type ChatRoomRow = {
  id: number;
};

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'content-type': 'application/json' },
  });
}

/**
 * 한 폴더 안의 파일 경로를 모두 모은다.
 *
 * 폴더는 `id`가 null로 온다. 우리 경로는 어느 버킷에서든 여기서 한 겹 더 들어가지 않으므로
 * 걸러내기만 하면 된다. 목록을 못 읽어도 조용히 넘어간다 — 뒷정리라서 그렇다.
 */
async function listFilePaths(
  client: SupabaseClient,
  bucket: string,
  prefix: string,
): Promise<string[]> {
  const paths: string[] = [];
  let offset = 0;

  for (;;) {
    const { data, error } = await client.storage
      .from(bucket)
      .list(prefix, { limit: LIST_PAGE_SIZE, offset });

    if (error !== null || data === null) {
      break;
    }

    for (const entry of data) {
      if (entry.id === null) {
        continue;
      }
      paths.push(`${prefix}/${entry.name}`);
    }

    if (data.length < LIST_PAGE_SIZE) {
      break;
    }
    offset += LIST_PAGE_SIZE;
  }

  return paths;
}

/** 내가 사고팔던 방 번호. 행이 살아 있는 동안에만 알 수 있어 삭제 전에 읽어 둔다. */
async function fetchRoomIds(client: SupabaseClient, userId: string): Promise<number[]> {
  const { data, error } = await client
    .from('chat_rooms')
    .select('id')
    .or(`buyer_id.eq.${userId},seller_id.eq.${userId}`);

  if (error !== null || data === null) {
    return [];
  }

  return (data as ChatRoomRow[]).map(function toId(row: ChatRoomRow): number {
    return row.id;
  });
}

/** 버킷 하나를 비운다. 실패해도 던지지 않는다 — 계정은 이미 지워졌고 남는 것은 파일뿐이다. */
async function removeFiles(
  client: SupabaseClient,
  bucket: string,
  paths: string[],
): Promise<void> {
  if (paths.length === 0) {
    return;
  }

  await client.storage.from(bucket).remove(paths);
}

async function removeUserFiles(
  client: SupabaseClient,
  userId: string,
  roomIds: number[],
): Promise<void> {
  for (const bucket of USER_PREFIXED_BUCKETS) {
    const paths = await listFilePaths(client, bucket, userId);
    await removeFiles(client, bucket, paths);
  }

  // 방을 통째로 비우지 않는다. 같은 방에 상대가 올린 사진이 함께 들어 있다.
  for (const roomId of roomIds) {
    const paths = await listFilePaths(client, CHAT_IMAGE_BUCKET, `${roomId}/${userId}`);
    await removeFiles(client, CHAT_IMAGE_BUCKET, paths);
  }
}

Deno.serve(async function handleDeleteAccount(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const authorization = request.headers.get('Authorization');
  if (authorization === null) {
    return jsonResponse({ error: '로그인이 필요합니다.' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (
    supabaseUrl === undefined ||
    anonKey === undefined ||
    serviceRoleKey === undefined
  ) {
    return jsonResponse({ error: '서버 설정이 올바르지 않습니다.' }, 500);
  }

  // 클라이언트를 둘 만든다. 앞의 것은 "누가 보냈는가"만 판단하고(anon 키 + 그 사람의 토큰),
  // 뒤의 것만 지운다. 하나로 합치면 service_role 권한으로 신원을 확인하는 셈이라
  // 토큰이 잘못돼도 통과하는 길이 생길 수 있다.
  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });

  const { data: userData, error: userError } = await caller.auth.getUser();
  if (userError !== null || userData.user === null) {
    return jsonResponse({ error: '로그인이 만료되었습니다. 다시 로그인해 주세요.' }, 401);
  }

  const userId = userData.user.id;
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const roomIds = await fetchRoomIds(admin, userId);

  // 순서가 중요하다. 파일을 먼저 지우면 삭제가 실패했을 때 사진만 사라진 계정이 남는다.
  // 계정을 먼저 지우면 실패 시 남는 것은 아무도 안 보는 파일뿐이다.
  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError !== null) {
    return jsonResponse({ error: deleteError.message }, 500);
  }

  await removeUserFiles(admin, userId, roomIds);

  return jsonResponse({ ok: true }, 200);
});
