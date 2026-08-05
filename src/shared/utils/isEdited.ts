/**
 * 만든 뒤 고쳐진 적이 있는가.
 *
 * 게시물과 댓글이 같은 규칙을 쓴다(0020). 둘 다 `updated_at`이 `not null default now()`라
 * 만든 직후에는 `created_at`과 **같은 값**이고 — 같은 insert 문의 두 default라 같은 `now()`다 —
 * 고쳐질 때만 커진다.
 *
 * 서버가 이미 "무엇이 수정인가"를 정해 두었으므로(게시물은 내용 칸들, 댓글은 content가
 * 실제로 달라질 때) 여기서는 두 값을 비교하기만 한다. 화면마다 다시 판단하지 않는다.
 *
 * 문자열을 그대로 비교하지 않고 시각으로 바꾼다. 같은 순간이라도 서버가 주는 표기가
 * 늘 같은 모양이라는 보장이 없다(`+00:00`과 `Z`, 소수점 자릿수).
 */
export function isEdited(createdAt: string, updatedAt: string | null): boolean {
  if (updatedAt === null) {
    return false;
  }

  const created = new Date(createdAt).getTime();
  const updated = new Date(updatedAt).getTime();

  if (Number.isNaN(created) || Number.isNaN(updated)) {
    return false;
  }

  return updated > created;
}
