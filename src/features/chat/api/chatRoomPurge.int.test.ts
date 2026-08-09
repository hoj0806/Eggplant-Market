import { getAdminClient } from '../../../shared/testUtils/integration/supabaseAdminClient';
import {
  createFixture,
  createTestChatRoom,
  createTestPost,
  createTestUser,
} from '../../../shared/testUtils/integration/fixtures';
import type { Fixture, FixtureUser } from '../../../shared/testUtils/integration/fixtures';
import {
  objectExists,
  removeObjects,
  uploadObject,
} from '../../../shared/testUtils/integration/storageFixtures';

/**
 * 뒷정리 경로 ⑤ — 채팅방 **나가기**(양쪽이 다 나가면 방을 지운다).
 *
 * 0031이 순서를 이렇게 잡았다.
 *
 * ```
 * leave_chat_room  → 나가기 + "이제 지울 수 있는가"
 * (지울 수 있으면) 클라이언트가 그 방 폴더를 비운다   ← 파일 먼저
 * purge_chat_room  → 알림 정리 + 방 삭제              ← 행 나중
 * ```
 *
 * 반대로 하면 `chat_images_select`가 막혀 **목록조차 못 읽는다.** 그 전제 셋을 확인한다.
 *
 *   1. 방 행을 지우면 메시지가 **따라 사라진다**(cascade)
 *   2. 방 행이 사라져도 **사진 파일은 남는다** — 그래서 파일을 먼저 치워야 한다
 *   3. **알림에는 cascade가 없다** — 그래서 `purge_chat_room`이 직접 지운다
 *
 * 3번은 0031이 "실제로 남는 것을 확인했다"고 손으로 적어 둔 관찰이다. 여기서 테스트가 된다.
 *
 * ── 못 재는 것 ────────────────────────────────────────────────────────
 * **`leave_chat_room`·`purge_chat_room`은 부를 수 없다.** 둘 다 `security definer`인데
 * `auth.uid()`가 참여자인지 직접 확인하고, 테스트는 세션을 만들 수 없다(Email 프로바이더를
 * 껐다). 서비스 키로 불러도 `auth.uid()`는 null이라 `insufficient_privilege`로 막힌다.
 * **"양쪽이 다 나갔는가"라는 판정(`private.is_chat_room_purgeable`)은 화면에서 사람이
 * 밟아야 한다.** 여기서 재는 것은 그 판정이 참일 때 뒤따르는 일들이다.
 */

const REGION = {
  code: '1123011000',
  dong: '서울 동대문구 이문동',
  lat: 37.6004,
  lng: 127.0664,
};

let fixture: Fixture;
let seller: FixtureUser;
let buyer: FixtureUser;
let roomId: number;
let messageId: number;
let imagePath: string;

const CHAT_BUCKET = 'chat-images';

async function newUser(nickname: string): Promise<FixtureUser> {
  return createTestUser(fixture, {
    nickname,
    regionCode: REGION.code,
    dongName: REGION.dong,
    lat: REGION.lat,
    lng: REGION.lng,
  });
}

beforeAll(async function seed() {
  const admin = getAdminClient();

  fixture = createFixture();
  seller = await newUser('나가기판매자');
  buyer = await newUser('나가기구매자');

  const postId = await createTestPost(fixture, {
    sellerId: seller.id,
    title: '나가기 테스트 글',
    regionCode: REGION.code,
    dongName: REGION.dong,
    lat: REGION.lat,
    lng: REGION.lng,
  });
  roomId = await createTestChatRoom({ postId, buyerId: buyer.id, sellerId: seller.id });

  const message = await admin
    .from('messages')
    .insert({ room_id: roomId, sender_id: buyer.id, content: '안녕하세요' })
    .select('id')
    .single();

  if (message.error !== null) {
    throw message.error;
  }
  messageId = (message.data as { id: number }).id;

  // 알림은 **직접 넣지 않는다.** 말이 오면 트리거가 상대에게 하나 만든다(0008).
  // 손으로 넣으면 트리거가 만든 것과 둘이 되어, 무엇이 남았는지가 흐려진다.

  imagePath = `${roomId}/${buyer.id}/${Date.now()}.png`;
  await uploadObject(CHAT_BUCKET, imagePath);
});

afterAll(async function cleanup() {
  await removeObjects(CHAT_BUCKET, [imagePath]);
  await fixture.cleanup();
});

describe('채팅방 나가기 뒷정리 (실제 DB + 저장소)', function chatRoomPurgeSuite() {
  it('방이 살아 있는 동안에만 사진 목록을 읽을 수 있다', async function listableWhileRoomExists() {
    // `listChatRoomImagePaths`가 방 삭제 **전에** 불려야 하는 이유.
    expect(await objectExists(CHAT_BUCKET, imagePath)).toBe(true);
  });

  it('참여자가 아니면 purge_chat_room이 막는다', async function purgeRejectsNonParticipant() {
    // 서비스 키로 불러도 `auth.uid()`는 null이다. 여기가 테스트의 벽이자,
    // 동시에 **남의 방을 못 지운다**는 확인이기도 하다.
    const { error } = await getAdminClient().rpc('purge_chat_room', { p_room_id: roomId });

    expect(error).not.toBeNull();
    expect(error?.message).toContain('참여 중인 채팅방이 아닙니다');
  });

  it('방 행을 지우면 메시지가 따라 사라진다', async function cascadeRemovesMessages() {
    const admin = getAdminClient();
    const { error } = await admin.from('chat_rooms').delete().eq('id', roomId);
    expect(error).toBeNull();

    const messages = await admin.from('messages').select('id').eq('id', messageId);

    expect(messages.data).toEqual([]);
  });

  it('알림은 따라 사라지지 않는다 — purge_chat_room이 직접 지우는 이유', async function notificationsSurvive() {
    // payload가 jsonb라 FK가 걸릴 자리가 없다. 방도 메시지도 사라졌는데 알림만 남아
    // **눌러도 갈 곳이 없는** 상태가 된다. 0031이 손으로 확인해 둔 것을 여기서 굳힌다.
    const { data } = await getAdminClient()
      .from('notifications')
      .select('payload')
      .eq('user_id', seller.id)
      .eq('type', 'chat');

    expect(data).toHaveLength(1);
    expect((data as Array<{ payload: { room_id: number } }>)[0].payload.room_id).toBe(roomId);
  });

  it('방 행이 사라져도 사진 파일은 남는다', async function fileSurvivesRoomDeletion() {
    // 그래서 순서가 **파일 먼저, 행 나중**이다. 뒤집으면 목록조차 못 읽는다.
    expect(await objectExists(CHAT_BUCKET, imagePath)).toBe(true);
  });
});
