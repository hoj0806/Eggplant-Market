/**
 * 사진 용량 상한을 재는 자리.
 *
 * **상한이 하나가 아니라 둘이다.**
 *
 * | 언제 | 무엇에 걸리나 | 왜 |
 * |---|---|---|
 * | 고를 때 | **원본** | 디코드 메모리. 픽셀을 통째로 펼치므로 너무 큰 사진은 탭을 죽인다 |
 * | 올리기 직전 | **줄인 뒤의 파일** | 버킷의 `file_size_limit`. 넘으면 서버가 거절한다 |
 *
 * 나누기 전에는 원본에 버킷 상한을 걸고 있었다. 그래서 **줄이면 500kB가 될 폰 사진을
 * 줄여 보지도 않고 거절**했다(게시물 실측: 4MB → 483kB).
 *
 * 저장 상한은 버킷마다 다르므로(게시물·채팅 5MB · 프로필 2MB) 각 기능이 자기 값을 갖고,
 * **원본 상한과 재는 방법만 여기서 함께 쓴다.** 셋이 각자 재면 한쪽만 고쳐지는 날이 온다.
 */

/**
 * 고르는 순간의 상한. 원본에 걸린다.
 *
 * 버킷 용량과는 관계가 없다 — 재는 것은 **디코드가 감당할 크기**다.
 * 8000×6000이면 RGBA로 192MB가 펼쳐져 낮은 사양 기기에서 탭이 죽는다.
 * 12MB는 48MP 폰 사진까지 감당하는 선이다.
 *
 * **이 값을 올려도 저장 용량의 최악은 안 커진다** — 줄인 뒤 버킷 상한을 다시 재기 때문이다.
 */
export const MAX_IMAGE_SOURCE_BYTES = 12 * 1024 * 1024;

export function toMegabyteText(bytes: number): string {
  return `${Math.round(bytes / 1024 / 1024)}MB`;
}

/** 상한을 넘는 첫 파일. 없으면 null. */
export function findOversizedImage(
  files: ReadonlyArray<File>,
  limitBytes: number,
): File | null {
  return (
    files.find(function isTooLarge(file: File): boolean {
      return file.size > limitBytes;
    }) ?? null
  );
}

/**
 * 고를 때 원본이 너무 크지 않은가. 넘으면 문구를 준다.
 *
 * 여기를 통과해도 **줄인 뒤** 저장 상한에 걸릴 수 있다(GIF처럼 줄일 수 없는 것).
 * 그쪽은 `findOversizedImage`로 각 기능이 자기 버킷 값과 함께 잰다.
 */
export function validateSourceImageSize(files: ReadonlyArray<File>): string | undefined {
  if (findOversizedImage(files, MAX_IMAGE_SOURCE_BYTES) === null) {
    return undefined;
  }

  return `사진 한 장의 용량은 ${toMegabyteText(MAX_IMAGE_SOURCE_BYTES)} 이하여야 합니다.`;
}
