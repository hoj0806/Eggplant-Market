import { toChatErrorMessage } from './chatErrorMessage';

describe('toChatErrorMessage', function toChatErrorMessageSuite() {
  it('자기 게시물에 채팅을 걸면 그 이유를 알려 준다', function selfChat() {
    expect(toChatErrorMessage({ message: '내 게시물에는 채팅을 걸 수 없습니다.' })).toBe(
      '내가 올린 상품에는 채팅을 걸 수 없습니다.',
    );
  });

  it('거래완료를 되돌리려 하면 그 이유를 알려 준다', function revertSold() {
    expect(toChatErrorMessage({ message: '거래완료된 게시물의 상태는 되돌릴 수 없습니다.' })).toBe(
      '거래완료된 상품의 상태는 되돌릴 수 없습니다.',
    );
  });

  it('RLS 거부는 권한 문제로 안내한다', function rlsDenied() {
    expect(toChatErrorMessage({ code: '42501', message: 'permission denied' })).toBe(
      '권한이 없습니다. 다시 로그인해 주세요.',
    );
  });

  it('사진 용량 초과를 구분해 알려 준다', function tooLarge() {
    expect(toChatErrorMessage({ message: 'Payload too large' })).toBe(
      '사진 용량이 너무 큽니다. 5MB 이하로 보내 주세요.',
    );
  });

  it('네트워크 실패를 구분해 알려 준다', function offline() {
    expect(toChatErrorMessage(new TypeError('Failed to fetch'))).toBe(
      '네트워크 연결을 확인해 주세요.',
    );
  });

  it('알 수 없는 실패는 기본 문구로 돌려준다', function unknown() {
    expect(toChatErrorMessage({})).toBe('메시지를 보내지 못했습니다. 잠시 후 다시 시도해 주세요.');
  });

  it('메시지 수정 거부는 문구가 늘어나도 잡힌다', function guardMessage() {
    // 0027이 한 번(`읽음 표시만` → `읽음 표시와 제안 답변만`), 0029가 또 한 번
    // (`…, 삭제만`) 늘렸다. 서버 문구를 그대로 넣어, 다음에 또 늘어나면 여기서 먼저 깨지게 한다.
    expect(
      toChatErrorMessage({ message: '메시지는 읽음 표시와 제안 답변만 바꿀 수 있습니다.' }),
    ).toBe('이미 보낸 메시지는 고칠 수 없습니다.');
    expect(
      toChatErrorMessage({ message: '메시지는 읽음 표시와 제안 답변, 삭제만 할 수 있습니다.' }),
    ).toBe('이미 보낸 메시지는 고칠 수 없습니다.');
  });

  it('삭제 규칙 위반은 0029의 서버 문구를 그대로 옮겨 준다', function deleteRules() {
    expect(toChatErrorMessage(new Error('이미 지운 메시지입니다.'))).toBe('이미 지운 메시지입니다.');
    expect(toChatErrorMessage({ message: '지운 메시지는 되돌릴 수 없습니다.' })).toBe(
      '지운 메시지는 되돌릴 수 없습니다.',
    );
    expect(toChatErrorMessage({ message: '내가 보낸 메시지만 지울 수 있습니다.' })).toBe(
      '내가 보낸 메시지만 지울 수 있습니다.',
    );
    expect(
      toChatErrorMessage({ message: '가격 제안은 지울 수 없습니다. 답변 대기 중이면 취소할 수 있습니다.' }),
    ).toBe('가격 제안은 지울 수 없습니다. 답변 대기 중이면 취소할 수 있습니다.');
  });

  it('남의 방을 나가려 하면 42501에 묻히지 않는다', function leaveOthersRoom() {
    // 0030의 leave_chat_room은 insufficient_privilege(42501)로 던진다. 코드만 보면
    // "다시 로그인해 주세요"가 되는데, 다시 로그인해도 남의 방은 나갈 수 없다.
    expect(
      toChatErrorMessage({ code: '42501', message: '참여 중인 채팅방이 아닙니다.' }),
    ).toBe('참여 중인 채팅방이 아닙니다.');
  });

  it('답이 끝난 제안을 다시 건드리면 그렇게 알려 준다', function answeredOffer() {
    expect(toChatErrorMessage({ message: '이미 답이 끝난 제안은 바꿀 수 없습니다.' })).toBe(
      '이미 답변이 끝난 제안입니다.',
    );
  });

  it('취소가 밀린 것과 답변이 밀린 것을 다르게 말한다', function cancelConflict() {
    // 같은 "이미 늦었다"지만 다음에 할 일이 다르다 — 취소 실패는 상대가 답했다는 뜻이다.
    expect(toChatErrorMessage(new Error('이미 답한 제안입니다.'))).toBe(
      '이미 답변이 끝난 제안입니다.',
    );
    expect(toChatErrorMessage(new Error('상대가 먼저 답해 취소할 수 없습니다.'))).toBe(
      '상대가 먼저 답해 취소할 수 없습니다.',
    );
  });

  it('남의 제안을 대신 무르려 하면 서버 문구를 옮겨 준다', function wrongDirection() {
    expect(toChatErrorMessage({ message: '받은 제안은 수락하거나 거절할 수 있습니다.' })).toBe(
      '받은 제안은 수락하거나 거절할 수 있습니다.',
    );
    expect(toChatErrorMessage({ message: '보낸 제안은 취소만 할 수 있습니다.' })).toBe(
      '보낸 제안은 취소만 할 수 있습니다.',
    );
  });
});
