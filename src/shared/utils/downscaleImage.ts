/**
 * 업로드 전에 사진을 줄인다.
 *
 * **왜 필요한가.** 폰 카메라 사진은 한 장에 3~5MB고 긴 변이 4000px을 넘는다. 그것을 그대로
 * 올리면 세 번 손해다 — 올리는 사람의 데이터, 저장 용량, 그리고 **그 뒤로 그 사진을 보는
 * 모든 사람의 데이터**다. 마지막이 가장 크다. 홈 목록은 카드를 스무 개 그리는데, 각 칸이
 * 화면에서 96px짜리 썸네일이면서 4000px 원본을 통째로 내려받고 있었다.
 *
 * 줄이는 일을 **서버가 아니라 여기서** 한다. Supabase의 이미지 변환은 유료 플랜 기능이고,
 * 무료 플랜에서 같은 일을 하려면 Edge Function이 원본을 받아 다시 저장해야 하는데 그러면
 * 올리는 사람의 데이터는 여전히 원본만큼 든다. 브라우저에서 줄이면 그 비용까지 사라진다.
 */

/** 긴 변의 상한. 상세 화면 캐러셀이 쓰는 폭(≈800px)의 두 배 — 고해상도 화면까지 감당한다. */
export const MAX_IMAGE_EDGE = 1600;

/** JPEG 품질. 0.8 아래로는 하늘·피부 같은 완만한 면에서 띠가 보이기 시작한다. */
export const IMAGE_QUALITY = 0.8;

/**
 * 줄인 뒤의 크기. 비율을 지키고, **원본보다 키우지 않는다.**
 *
 * 작은 사진을 1600px로 늘리면 용량만 커지고 화질은 그대로다 — 최적화가 아니라 낭비가 된다.
 */
export function computeTargetSize(
  width: number,
  height: number,
  maxEdge: number = MAX_IMAGE_EDGE,
): { width: number; height: number } {
  const longestEdge = Math.max(width, height);

  if (longestEdge <= maxEdge || longestEdge === 0) {
    return { width, height };
  }

  const ratio = maxEdge / longestEdge;

  // 반올림하면 1px이 남거나 모자라는데, 캔버스는 정수만 받는다.
  // 최소 1px은 보장한다 — 0을 넘기면 캔버스가 그리지 못한다.
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

/**
 * 줄일 필요가 있는가.
 *
 * **GIF는 손대지 않는다.** 캔버스에 그리면 움직이는 그림이 첫 장면 하나로 납작해진다.
 * 줄여서 얻는 것보다 잃는 것이 크다.
 */
export function shouldDownscale(type: string, width: number, height: number): boolean {
  if (type === 'image/gif') {
    return false;
  }

  return Math.max(width, height) > MAX_IMAGE_EDGE;
}

/** 줄인 파일의 이름. 확장자가 바뀌므로 이름도 따라 바꾼다. */
export function toDownscaledName(name: string): string {
  const dot = name.lastIndexOf('.');
  const base = dot === -1 ? name : name.slice(0, dot);

  return `${base}.jpg`;
}

type Downscaler = {
  decode(file: File): Promise<{ width: number; height: number; close?(): void }>;
  draw(
    source: unknown,
    width: number,
    height: number,
    quality: number,
  ): Promise<Blob | null>;
};

/**
 * 브라우저 API를 만지는 유일한 자리. 테스트는 이 경계를 갈아끼워 확인한다
 * (jsdom에는 캔버스가 없어 실제 그리기를 돌릴 수 없다 — `kakaoMapLoader`와 같은 구조다).
 */
const browserDownscaler: Downscaler = {
  async decode(file: File) {
    return createImageBitmap(file);
  },
  async draw(source: unknown, width: number, height: number, quality: number) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');

    if (context === null) {
      return null;
    }

    // 투명한 PNG를 JPEG로 바꾸면 투명한 자리가 검게 남는다. 흰색을 먼저 깔아 둔다.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(source as CanvasImageSource, 0, 0, width, height);

    return new Promise<Blob | null>(function toBlob(resolve) {
      canvas.toBlob(resolve, 'image/jpeg', quality);
    });
  },
};

/**
 * 사진 한 장을 줄인다.
 *
 * **실패하면 원본을 돌려준다.** 이 함수는 최적화일 뿐이라, 여기서 예외를 던지면
 * "사진을 줄이지 못해서 글을 못 올리는" 일이 생긴다. 그건 고치려던 것보다 나쁘다.
 */
export async function downscaleImage(
  file: File,
  downscaler: Downscaler = browserDownscaler,
): Promise<File> {
  try {
    const bitmap = await downscaler.decode(file);

    try {
      if (!shouldDownscale(file.type, bitmap.width, bitmap.height)) {
        return file;
      }

      const target = computeTargetSize(bitmap.width, bitmap.height);
      const blob = await downscaler.draw(bitmap, target.width, target.height, IMAGE_QUALITY);

      if (blob === null) {
        return file;
      }

      // 줄였는데 더 커지는 일이 있다. 이미 잘 압축된 JPEG를 다시 인코딩할 때다.
      // 그때는 원본이 낫다.
      if (blob.size >= file.size) {
        return file;
      }

      return new File([blob], toDownscaledName(file.name), {
        type: 'image/jpeg',
        lastModified: Date.now(),
      });
    } finally {
      bitmap.close?.();
    }
  } catch {
    return file;
  }
}

/** 여러 장. 한 장이 실패해도 나머지는 그대로 간다(각 호출이 스스로 원본으로 물러난다). */
export async function downscaleImages(files: File[]): Promise<File[]> {
  return Promise.all(files.map(function toDownscaled(file: File) {
    return downscaleImage(file);
  }));
}
