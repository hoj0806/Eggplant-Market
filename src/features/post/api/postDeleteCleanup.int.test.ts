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
import { POST_IMAGE_BUCKET, toPostImagePaths } from '../utils/postImagePath';

/**
 * 뒷정리 경로 ④ — 게시물 **삭제**.
 *
 * `deletePost`의 순서가 이렇게 생긴 이유를 확인한다.
 *
 * ```ts
 * const urls = (await fetchPostImageRows(postId)).map(…);          // ① 먼저 읽고
 * const chatImagePaths = await listPostChatImagePaths(postId, …);  // ② 먼저 읽고
 * await supabase.from('posts').delete().eq('id', postId);          // ③ 지운 다음
 * await removePostImageFiles(urls);                                // ④ 파일을 치운다
 * await removeChatImages(chatImagePaths);
 * ```
 *
 * 이 순서가 옳으려면 **두 가지가 참이어야 한다.** 둘 다 DB와 스토리지의 성질이라
 * 코드만 봐서는 알 수 없고, 지금까지 한 번도 확인된 적이 없다.
 *
 *   1. 글을 지우면 `post_images`·`chat_rooms` 행이 **따라 사라진다** — 그래서 미리 읽어야 한다
 *   2. 행이 사라져도 **파일은 그대로 남는다** — 그래서 파일은 따로 지워야 한다
 *
 * 2번이 이 계층 전체가 존재하는 이유다. 만약 DB가 파일까지 치워 준다면 `deletePost`의
 * 뒷부분도, 회원탈퇴의 훑기도, 이 테스트도 전부 필요 없다.
 *
 * **`deletePost` 자체는 못 부른다.** 익명 클라이언트로는 RLS가 막고, 세션을 만들 수 없다
 * (Email 프로바이더를 껐다). 그래서 서비스 키로 **같은 순서를 그대로 밟는다.**
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
let postId: number;
let roomId: number;
let postImagePath: string;
let postImageUrl: string;
let chatImagePath: string;

const CHAT_BUCKET = 'chat-images';

beforeAll(async function seed() {
  fixture = createFixture();
  seller = await createTestUser(fixture, {
    nickname: '삭제판매자',
    regionCode: REGION.code,
    dongName: REGION.dong,
    lat: REGION.lat,
    lng: REGION.lng,
  });
  buyer = await createTestUser(fixture, {
    nickname: '삭제구매자',
    regionCode: REGION.code,
    dongName: REGION.dong,
    lat: REGION.lat,
    lng: REGION.lng,
  });

  postId = await createTestPost(fixture, {
    sellerId: seller.id,
    title: '지울 글',
    regionCode: REGION.code,
    dongName: REGION.dong,
    lat: REGION.lat,
    lng: REGION.lng,
  });
  roomId = await createTestChatRoom({ postId, buyerId: buyer.id, sellerId: seller.id });

  postImagePath = `${seller.id}/${Date.now()}-0.png`;
  postImageUrl = await uploadObject(POST_IMAGE_BUCKET, postImagePath);

  // 글에 딸린 사진 행. deletePost가 먼저 읽는 것이 이 행이다.
  const { error } = await getAdminClient()
    .from('post_images')
    .insert({ post_id: postId, url: postImageUrl, sort_order: 0 });

  if (error !== null) {
    throw error;
  }

  // 그 글의 채팅방에 오간 사진. 경로는 `{room_id}/{user_id}/…`(0008).
  chatImagePath = `${roomId}/${buyer.id}/${Date.now()}.png`;
  await uploadObject(CHAT_BUCKET, chatImagePath);
});

afterAll(async function cleanup() {
  await removeObjects(POST_IMAGE_BUCKET, [postImagePath]);
  await removeObjects(CHAT_BUCKET, [chatImagePath]);
  await fixture.cleanup();
});

describe('게시물 삭제 뒷정리 (실제 DB + 저장소)', function postDeleteSuite() {
  it('지우기 전에는 사진 행과 방을 읽을 수 있다', async function readableBeforeDelete() {
    // deletePost가 **삭제 전에** 경로를 챙기는 이유. 여기서만 읽을 수 있다.
    const admin = getAdminClient();
    const images = await admin.from('post_images').select('url').eq('post_id', postId);
    const rooms = await admin.from('chat_rooms').select('id').eq('post_id', postId);

    expect(images.data).toHaveLength(1);
    expect(rooms.data).toHaveLength(1);
  });

  it('글을 지우면 사진 행과 방이 따라 사라진다', async function cascadeRemovesRows() {
    const admin = getAdminClient();
    const { error } = await admin.from('posts').delete().eq('id', postId);
    expect(error).toBeNull();

    const images = await admin.from('post_images').select('url').eq('post_id', postId);
    const rooms = await admin.from('chat_rooms').select('id').eq('post_id', postId);

    expect(images.data).toEqual([]);
    expect(rooms.data).toEqual([]);
  });

  it('행이 사라져도 파일은 그대로 남는다 — 이 계층이 존재하는 이유', async function filesSurviveCascade() {
    // **DB는 스토리지를 안 건드린다.** 이것이 참이라 뒷정리 코드가 필요하다.
    expect(await objectExists(POST_IMAGE_BUCKET, postImagePath)).toBe(true);
    expect(await objectExists(CHAT_BUCKET, chatImagePath)).toBe(true);
  });

  it('미리 챙겨 둔 주소로 게시물 사진을 지운다', async function removesPostImages() {
    await removeObjects(POST_IMAGE_BUCKET, toPostImagePaths([postImageUrl]));

    expect(await objectExists(POST_IMAGE_BUCKET, postImagePath)).toBe(false);
  });

  it('미리 챙겨 둔 경로로 채팅 사진을 지운다', async function removesChatImages() {
    // 방이 이미 사라진 폴더다. `chat_images_delete`의 세 번째 조항이 여는 자리(0032).
    await removeObjects(CHAT_BUCKET, [chatImagePath]);

    expect(await objectExists(CHAT_BUCKET, chatImagePath)).toBe(false);
  });
});
