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
});
