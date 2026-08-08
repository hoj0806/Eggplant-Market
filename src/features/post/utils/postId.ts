/**
 * 주소의 :postId를 숫자로 바꾼다. 숫자가 아니면 없는 글로 본다.
 *
 * 상세와 수정 화면이 같은 판단을 해야 해서 여기로 꺼냈다.
 * `Number('12abc')`는 NaN, `Number('')`는 0이라 둘 다 걸러진다.
 */
export function toPostId(raw: string | undefined): number | null {
  if (raw === undefined) {
    return null;
  }

  const parsed = Number(raw);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}
