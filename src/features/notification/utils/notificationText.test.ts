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
    ...overrides,
  };
}

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

  // 아직 이 값을 넣는 트리거가 없지만 enum에는 있다. 닿았을 때 빈 줄이 되면 안 된다.
  it('댓글·찜 알림은 트리거가 생기기 전에도 게시물로 보낸다', function commentAndLikeCase() {
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
