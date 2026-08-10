import { fetchPostCommentPage } from './commentApi';
import { supabase } from '../../../shared/testUtils/integration/supabaseTestClient';
import {
  createFixture,
  createTestComment,
  createTestPost,
  createTestUser,
} from '../../../shared/testUtils/integration/fixtures';
import type { Fixture } from '../../../shared/testUtils/integration/fixtures';
import { buildCommentTree } from '../utils/buildCommentTree';
import type { PostComment } from '../types';

/**
 * 비밀 댓글의 공개 범위 — **가장 새면 안 되는 자리다.**
 *
 * `comments_select`(0033)는 게시물 판매자와 **실타래를 연 사람**만 통과시킨다.
 * 이 테스트는 로그인하지 않으므로 둘 중 어느 쪽도 아니다 → 한 줄도 오면 안 된다.
 * "비밀 댓글입니다" 같은 자리 표시도 남기지 않기로 한 결정까지 함께 본다 —
 * 자리가 남으면 그것이 곧 "여기 비밀 댓글이 있다"는 신호가 되기 때문이다.
 *
 * 데이터를 직접 심는다. 남이 만든 글에 기대면 화면에서 글 하나 지우는 순간 깨진다.
 * 심는 것은 서비스 키, **확인은 언제나 익명 클라이언트**다 — 확인까지 서비스 키로 하면
 * 정책이 꺼져서 검증하려던 규칙이 사라진다.
 */

const REGION = {
  code: '1123011000',
  dong: '서울 동대문구 이문동',
  lat: 37.6004,
  lng: 127.0664,
};

let fixture: Fixture;
let postId: number;
let publicCount: number;

beforeAll(async function seed() {
  fixture = createFixture();

  const seller = await createTestUser(fixture, {
    nickname: '판매자',
    regionCode: REGION.code,
    dongName: REGION.dong,
    lat: REGION.lat,
    lng: REGION.lng,
  });
  const buyer = await createTestUser(fixture, {
    nickname: '구매자',
    regionCode: REGION.code,
    dongName: REGION.dong,
    lat: REGION.lat,
    lng: REGION.lng,
  });

  postId = await createTestPost(fixture, {
    sellerId: seller.id,
    title: '비밀 댓글 확인용',
    regionCode: REGION.code,
    dongName: REGION.dong,
    lat: REGION.lat,
    lng: REGION.lng,
  });

  // 공개 실타래 — 1단 + 답글
  const openThread = await createTestComment({
    postId,
    authorId: buyer.id,
    content: '아직 판매하시나요?',
  });
  await createTestComment({
    postId,
    authorId: seller.id,
    parentId: openThread,
    content: '네 있습니다!',
  });

  // 비밀 실타래 — 1단 + 답글. 답글은 is_secret을 넘기지 않는다.
  // 부모를 따라가는지(0033의 inherit_comment_secret)까지 여기서 함께 본다.
  const secretThread = await createTestComment({
    postId,
    authorId: buyer.id,
    content: '5만원에 가능할까요?',
    isSecret: true,
  });
  await createTestComment({
    postId,
    authorId: seller.id,
    parentId: secretThread,
    content: '5만 5천원까지 됩니다.',
  });

  publicCount = 2;
}, 60000);

afterAll(async function clean() {
  await fixture.cleanup();
}, 60000);

describe('비밀 댓글', function secretComments() {
  it('로그인하지 않으면 한 줄도 오지 않는다', async function noneForAnonymous() {
    const comments = await fetchPostCommentPage(postId, null);
    const secret = comments.filter(function isSecret(comment: PostComment) {
      return comment.isSecret;
    });

    expect(secret).toEqual([]);
    expect(comments.length).toBe(publicCount);
  });

  it('자리 표시조차 남기지 않는다', async function noPlaceholder() {
    const comments = await fetchPostCommentPage(postId, null);
    const contents = comments.map(function toContent(comment: PostComment) {
      return comment.content;
    });

    // 비밀 실타래의 내용이 어떤 형태로도 새지 않아야 한다.
    expect(contents.join(' ')).not.toContain('5만원');
    expect(contents.join(' ')).not.toContain('5만 5천원');
  });

  it('답글은 부모의 비밀을 물려받아 함께 가려진다', async function replyInheritsSecret() {
    const comments = await fetchPostCommentPage(postId, null);

    // 답글에 is_secret을 넘기지 않았는데도 익명에게 안 왔다면 트리거가 받아 적은 것이다.
    expect(comments.length).toBe(publicCount);
  });

  it('카드의 댓글 수는 공개 댓글만 센다', async function countExcludesSecret() {
    const { data, error } = await supabase
      .from('posts')
      .select('comment_count')
      .eq('id', postId)
      .single();

    if (error !== null) {
      throw error;
    }

    // 전부 세면 4다. 2가 나와야 "보는 사람마다 다를 수 없는" 값이 가장 적게 보는 쪽에 맞춘 것이다.
    expect((data as { comment_count: number }).comment_count).toBe(publicCount);
  });
});

describe('댓글 트리', function commentTree() {
  it('답글이 부모 아래로 접히고 잃어버린 줄이 없다', async function twoLevels() {
    const comments = await fetchPostCommentPage(postId, null);
    const tree = buildCommentTree(comments);

    for (const node of tree) {
      expect(node.comment.parentId).toBeNull();

      for (const reply of node.replies) {
        expect(reply.parentId).toBe(node.comment.id);
      }
    }

    const flattened = tree.reduce(function countNode(total: number, node) {
      return total + 1 + node.replies.length;
    }, 0);
    expect(flattened).toBe(comments.length);
  });

  it('오래된 댓글이 위로 온다', async function oldestFirst() {
    const comments = await fetchPostCommentPage(postId, null);
    const createdAt = comments.map(function toCreatedAt(comment: PostComment) {
      return comment.createdAt;
    });

    expect(createdAt).toEqual([...createdAt].sort());
  });
});
