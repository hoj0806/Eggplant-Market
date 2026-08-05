import { toNotificationView } from './notificationText';
import type { AppNotification, NotificationType } from '../types';

const VIEWER_ID = 'viewer-1';

function makeNotification(overrides: Partial<AppNotification> & { type: NotificationType }): AppNotification {
  return {
    id: 1,
    isRead: false,
    createdAt: '2026-08-05T00:00:00.000Z',
    actorId: 'actor-1',
    actorNickname: '가지팔이',
    actorAvatarUrl: null,
    roomId: null,
    postId: null,
    postTitle: null,
    preview: null,
    offerAmount: null,
    isFirst: false,
    ...overrides,
  };
}

describe('toNotificationView — 첫 후기', function firstReviewSuite() {
  // 지금까지는 온도만 조용히 올랐다. 첫 후기만 주어를 바꿔 그 사실을 알린다(0021).
  it('첫 후기는 상대가 아니라 나에게 생긴 일을 말한다', function firstReviewCase() {
    const view = toNotificationView(
      makeNotification({ type: 'review', isFirst: true, preview: '친절하세요' }),
      VIEWER_ID,
    );

    expect(view.title).toBe('🎉 첫 거래후기를 받았어요');
    expect(view.body).toBe('매너온도가 올랐어요. 프로필에서 확인해 보세요');
    expect(view.to).toBe(`/users/${VIEWER_ID}`);
  });

  it('두 번째부터는 지금까지와 같다', function laterReviewCase() {
    const view = toNotificationView(
      makeNotification({ type: 'review', isFirst: false, preview: '친절하세요' }),
      VIEWER_ID,
    );

    expect(view.title).toBe('가지팔이님이 거래후기를 남겼어요');
    expect(view.body).toBe('친절하세요');
  });

  // 서버가 다른 네 타입에는 false로 세워 내려준다. 표를 잘못 읽어 축하가 새면 안 된다.
  it('후기가 아닌 알림은 첫 후기 문구를 쓰지 않는다', function otherTypeCase() {
    const view = toNotificationView(
      makeNotification({ type: 'chat', roomId: 9, preview: '아직 있나요?', isFirst: true }),
      VIEWER_ID,
    );

    expect(view.title).toBe('가지팔이님이 메시지를 보냈어요');
  });
});

describe('toNotificationView', function notificationTextSuite() {
  it('채팅 알림은 보낸 사람과 내용을 보여주고 그 방으로 보낸다', function chatCase() {
    const view = toNotificationView(
      makeNotification({ type: 'chat', roomId: 9, preview: '아직 있나요?' }),
      VIEWER_ID,
    );

    expect(view.title).toBe('가지팔이님이 메시지를 보냈어요');
    expect(view.body).toBe('아직 있나요?');
    expect(view.to).toBe('/chats/9');
  });

  // 금액이 제목에 있어야 알림만 보고도 판단이 선다. 열어 봐야 아는 알림은 알림이 아니다.
  it('가격 제안 알림은 금액을 제목에 적는다', function priceOfferCase() {
    const view = toNotificationView(
      makeNotification({
        type: 'price_offer',
        roomId: 9,
        offerAmount: 35000,
        postTitle: '아이패드',
      }),
      VIEWER_ID,
    );

    expect(view.title).toBe('가지팔이님이 35,000원을 제안했어요');
    expect(view.body).toBe('아이패드');
    expect(view.to).toBe('/chats/9');
  });

  it('금액을 알 수 없는 가격 제안도 문장이 깨지지 않는다', function priceOfferWithoutAmountCase() {
    const view = toNotificationView(
      makeNotification({ type: 'price_offer', roomId: 9 }),
      VIEWER_ID,
    );

    expect(view.title).toBe('가지팔이님이 가격을 제안했어요');
  });

  // 받은 후기는 내 프로필에 쌓인다. 후기 한 건만 여는 화면이 없어서 viewerId가 필요하다.
  it('후기 알림은 내 프로필로 보낸다', function reviewCase() {
    const view = toNotificationView(
      makeNotification({ type: 'review', postId: 7, postTitle: '아이패드', preview: '친절해요' }),
      VIEWER_ID,
    );

    expect(view.title).toBe('가지팔이님이 거래후기를 남겼어요');
    expect(view.body).toBe('친절해요');
    expect(view.to).toBe(`/users/${VIEWER_ID}`);
  });

  it('한 줄 후기가 없으면 어떤 거래였는지를 대신 보여준다', function reviewWithoutCommentCase() {
    const view = toNotificationView(
      makeNotification({ type: 'review', postId: 7, postTitle: '아이패드' }),
      VIEWER_ID,
    );

    expect(view.body).toBe('아이패드');
  });

  // 0018로 실제로 오기 시작했다. 문장은 그 전에 써 둔 것을 그대로 쓴다.
  it('댓글·찜 알림은 게시물로 보낸다', function commentAndLikeCase() {
    const comment = toNotificationView(
      makeNotification({ type: 'comment', postId: 7, preview: '아직 있나요?' }),
      VIEWER_ID,
    );
    const like = toNotificationView(
      makeNotification({ type: 'like', postId: 7, postTitle: '아이패드' }),
      VIEWER_ID,
    );

    expect(comment.title).toBe('가지팔이님이 댓글을 남겼어요');
    expect(comment.to).toBe('/posts/7');
    expect(like.title).toBe('가지팔이님이 관심을 표시했어요');
    expect(like.to).toBe('/posts/7');
  });

  // 0018의 fetch_notifications는 댓글이 지워지면 preview를 null로 준다(알림 줄은 남는다).
  // 후기와 같은 자리 — 빈 줄 대신 어떤 글이었는지라도 보인다.
  it('댓글이 지워졌으면 글 제목을 대신 보여준다', function deletedCommentCase() {
    const view = toNotificationView(
      makeNotification({ type: 'comment', postId: 7, postTitle: '아이패드', preview: null }),
      VIEWER_ID,
    );

    expect(view.body).toBe('아이패드');
  });

  // 찜은 서버가 미리보기를 주지 않는다. 글 제목이 본문 자리를 맡는다.
  it('찜 알림의 본문은 글 제목이다', function likeBodyCase() {
    const view = toNotificationView(
      makeNotification({ type: 'like', postId: 7, postTitle: '아이패드', preview: null }),
      VIEWER_ID,
    );

    expect(view.body).toBe('아이패드');
  });

  // 프로필은 cascade로 사라져도 알림 행은 남는다. "님이 메시지를 보냈어요"가 되면 안 된다.
  it('보낸 사람이 사라졌어도 문장이 완성된다', function missingActorCase() {
    const view = toNotificationView(
      makeNotification({ type: 'chat', roomId: 9, actorId: null, actorNickname: null }),
      VIEWER_ID,
    );

    expect(view.title).toBe('알 수 없는 이웃님이 메시지를 보냈어요');
  });

  // 눌러도 아무 일이 없는 링크를 남겨 두면 "눌렀는데 왜 안 가지"가 된다.
  it('가리키던 방이 사라졌으면 갈 곳을 주지 않는다', function missingTargetCase() {
    const view = toNotificationView(makeNotification({ type: 'chat', roomId: null }), VIEWER_ID);

    expect(view.to).toBeNull();
  });
});
