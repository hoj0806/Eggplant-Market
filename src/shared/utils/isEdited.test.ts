import { isEdited } from './isEdited';

const CREATED = '2026-08-05T00:00:00.000Z';

describe('isEdited', function isEditedSuite() {
  it('만든 뒤 안 고쳤으면 두 값이 같다', function untouchedCase() {
    expect(isEdited(CREATED, CREATED)).toBe(false);
  });

  it('고쳐진 뒤에는 updated_at이 더 크다', function editedCase() {
    expect(isEdited(CREATED, '2026-08-05T00:01:00.000Z')).toBe(true);
  });

  // 표기가 달라도 같은 순간이면 수정이 아니다.
  it('같은 시각을 다른 모양으로 적어도 수정으로 보지 않는다', function formatCase() {
    expect(isEdited(CREATED, '2026-08-05T00:00:00+00:00')).toBe(false);
  });

  // 없는 칸을 아직 안 받아 온 화면에서 "수정됨"이 뜨면 안 된다.
  it('값이 없으면 수정으로 보지 않는다', function nullCase() {
    expect(isEdited(CREATED, null)).toBe(false);
  });

  it('읽을 수 없는 값이면 수정으로 보지 않는다', function invalidCase() {
    expect(isEdited(CREATED, '어제')).toBe(false);
  });
});
