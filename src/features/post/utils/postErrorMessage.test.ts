import { toPostActionErrorMessage, toPostErrorMessage } from './postErrorMessage';

describe('toPostErrorMessage', function postErrorMessageSuite() {
  it('용량 초과를 사진 용량 안내로 바꾼다', function payloadCase() {
    expect(toPostErrorMessage({ message: 'The object exceeded the maximum allowed size' })).toBe(
      '사진 용량이 너무 큽니다. 5MB 이하로 올려 주세요.',
    );
  });

  it('FK 위반을 카테고리 안내로 바꾼다', function foreignKeyCase() {
    expect(
      toPostErrorMessage({ code: '23503', message: 'insert or update violates foreign key' }),
    ).toBe('선택한 카테고리를 찾을 수 없습니다. 카테고리를 다시 골라 주세요.');
  });

  it('RLS 거부를 권한 안내로 바꾼다', function rlsCase() {
    expect(toPostErrorMessage({ message: 'new row violates row-level security policy' })).toBe(
      '권한이 없습니다. 다시 로그인해 주세요.',
    );
  });

  it('모르는 오류는 기본 문구로 돌려준다', function fallbackCase() {
    expect(toPostErrorMessage(new Error('무언가 이상함'))).toBe(
      '게시물을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.',
    );
  });
});

describe('toPostActionErrorMessage', function postActionErrorMessageSuite() {
  // 0010 bump_post는 거절 사유를 한국어 문구로 구분해 돌려준다. 그 말이 곧 사용자에게 할 말이다.
  it('RPC가 직접 쓴 한국어 문구는 그대로 보여준다', function rpcMessageCase() {
    expect(
      toPostActionErrorMessage({
        code: 'P0001',
        message: '끌어올리기는 24시간에 한 번만 할 수 있습니다.',
      }),
    ).toBe('끌어올리기는 24시간에 한 번만 할 수 있습니다.');
  });

  // errcode만 보고 패턴에 태우면 42501이 "권한이 없습니다"로 뭉개져 이유를 알 수 없다.
  it('권한 오류라도 서버 문구가 더 구체적이면 그쪽을 쓴다', function specificCase() {
    expect(
      toPostActionErrorMessage({
        code: '42501',
        message: '내가 올린 글만 끌어올릴 수 있습니다.',
      }),
    ).toBe('내가 올린 글만 끌어올릴 수 있습니다.');
  });

  it('영어 오류는 지금까지처럼 패턴으로 옮긴다', function englishCase() {
    expect(toPostActionErrorMessage({ message: 'Failed to fetch' })).toBe(
      '네트워크 연결을 확인해 주세요.',
    );
  });

  it('message가 없어도 기본 문구로 버틴다', function emptyCase() {
    expect(toPostActionErrorMessage(null)).toBe(
      '게시물을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.',
    );
  });
});
