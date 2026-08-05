import {
  COMMENT_MAX_LENGTH,
  hasCommentFieldError,
  validateCommentContent,
  validateCommentValues,
} from './validateCommentInput';

describe('validateCommentContent', function validateCommentContentSuite() {
  it('내용이 있으면 통과한다', function passesCase() {
    expect(validateCommentContent('이거 아직 있나요?')).toBeUndefined();
  });

  it('빈 값은 막는다', function emptyCase() {
    expect(validateCommentContent('')).toBe('댓글을 입력해 주세요.');
  });

  // 0017의 comments_content_bounded가 btrim으로 보는 것과 같은 이유다.
  // 통과시키면 화면에 왜 있는지 모르는 빈 줄이 남는다.
  it('공백만 있는 값도 막는다', function whitespaceCase() {
    expect(validateCommentContent('   \n  ')).toBe('댓글을 입력해 주세요.');
  });

  it('한도를 넘으면 막는다', function tooLongCase() {
    expect(validateCommentContent('가'.repeat(COMMENT_MAX_LENGTH + 1))).toBe(
      '댓글은 1000자 이하여야 합니다.',
    );
  });

  it('한도와 같은 길이는 통과한다', function boundaryCase() {
    expect(validateCommentContent('가'.repeat(COMMENT_MAX_LENGTH))).toBeUndefined();
  });

  // 길이는 걷어내기 전 값으로 잰다 — 저장되는 것이 원문이기 때문이다.
  it('앞뒤 공백까지 합쳐 한도를 넘으면 막는다', function rawLengthCase() {
    expect(validateCommentContent(' '.repeat(5) + '가'.repeat(COMMENT_MAX_LENGTH))).toBe(
      '댓글은 1000자 이하여야 합니다.',
    );
  });
});

describe('validateCommentValues', function validateCommentValuesSuite() {
  it('통과하면 빈 객체다', function noErrorCase() {
    const errors = validateCommentValues('네고 가능한가요?');

    expect(errors).toEqual({});
    expect(hasCommentFieldError(errors)).toBe(false);
  });

  it('막히면 content에 이유가 담긴다', function errorCase() {
    const errors = validateCommentValues('');

    expect(errors.content).toBe('댓글을 입력해 주세요.');
    expect(hasCommentFieldError(errors)).toBe(true);
  });
});
