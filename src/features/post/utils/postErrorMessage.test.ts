import { toPostErrorMessage } from './postErrorMessage';

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
