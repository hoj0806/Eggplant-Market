import {
  computeTargetSize,
  downscaleImage,
  IMAGE_QUALITY,
  MAX_IMAGE_EDGE,
  shouldDownscale,
  toDownscaledName,
} from './downscaleImage';

function makeFile(name: string, type: string, bytes: number): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

/** 캔버스가 없는 jsdom을 대신한다. 실제로 그리지 않고 "몇 픽셀로 그렸는지"만 기록한다. */
function makeDownscaler(options: {
  width: number;
  height: number;
  outputBytes?: number;
  drawReturnsNull?: boolean;
  decodeThrows?: boolean;
}) {
  const calls: Array<{ width: number; height: number; quality: number }> = [];
  let closed = false;

  const downscaler = {
    async decode() {
      if (options.decodeThrows === true) {
        throw new Error('decode 실패');
      }

      return {
        width: options.width,
        height: options.height,
        close() {
          closed = true;
        },
      };
    },
    async draw(_source: unknown, width: number, height: number, quality: number) {
      calls.push({ width, height, quality });

      if (options.drawReturnsNull === true) {
        return null;
      }

      return new Blob([new Uint8Array(options.outputBytes ?? 1000)], { type: 'image/jpeg' });
    },
  };

  return {
    downscaler,
    calls,
    wasClosed() {
      return closed;
    },
  };
}

describe('computeTargetSize', function computeTargetSizeSuite() {
  it('긴 변을 상한에 맞추고 비율을 지킨다', function keepsRatio() {
    expect(computeTargetSize(4000, 3000)).toEqual({ width: 1600, height: 1200 });
    expect(computeTargetSize(3000, 4000)).toEqual({ width: 1200, height: 1600 });
  });

  it('상한보다 작으면 그대로 둔다 — 키우지 않는다', function neverUpscales() {
    expect(computeTargetSize(800, 600)).toEqual({ width: 800, height: 600 });
    expect(computeTargetSize(MAX_IMAGE_EDGE, 900)).toEqual({
      width: MAX_IMAGE_EDGE,
      height: 900,
    });
  });

  it('아주 납작한 사진도 최소 1px은 남는다', function keepsAtLeastOnePixel() {
    // 20000 × 3을 줄이면 높이가 0.24px이 된다. 0을 넘기면 캔버스가 그리지 못한다.
    expect(computeTargetSize(20000, 3)).toEqual({ width: 1600, height: 1 });
  });

  it('크기를 모르면(0) 손대지 않는다', function handlesZero() {
    expect(computeTargetSize(0, 0)).toEqual({ width: 0, height: 0 });
  });
});

describe('shouldDownscale', function shouldDownscaleSuite() {
  it('긴 변이 상한을 넘으면 줄인다', function largeIsDownscaled() {
    expect(shouldDownscale('image/jpeg', 4000, 3000)).toBe(true);
  });

  it('상한 이하면 그냥 둔다', function smallIsKept() {
    expect(shouldDownscale('image/jpeg', 1200, 900)).toBe(false);
    expect(shouldDownscale('image/jpeg', MAX_IMAGE_EDGE, MAX_IMAGE_EDGE)).toBe(false);
  });

  it('GIF는 크기와 상관없이 건드리지 않는다', function gifIsUntouched() {
    // 캔버스에 그리면 움직이는 그림이 첫 장면으로 납작해진다.
    expect(shouldDownscale('image/gif', 4000, 3000)).toBe(false);
  });
});

describe('toDownscaledName', function toDownscaledNameSuite() {
  it('확장자를 jpg로 바꾼다', function replacesExtension() {
    expect(toDownscaledName('사진.png')).toBe('사진.jpg');
    expect(toDownscaledName('IMG_0001.HEIC')).toBe('IMG_0001.jpg');
  });

  it('점이 여럿이면 마지막 것만 바꾼다', function handlesMultipleDots() {
    expect(toDownscaledName('my.photo.v2.png')).toBe('my.photo.v2.jpg');
  });

  it('확장자가 없으면 붙인다', function addsExtension() {
    expect(toDownscaledName('사진')).toBe('사진.jpg');
  });
});

describe('downscaleImage', function downscaleImageSuite() {
  it('큰 사진을 줄이고 jpeg로 바꾼다', function downscalesLargePhoto() {
    const original = makeFile('IMG_0001.png', 'image/png', 5_000_000);
    const stub = makeDownscaler({ width: 4000, height: 3000, outputBytes: 300_000 });

    return downscaleImage(original, stub.downscaler).then(function assertResult(result) {
      expect(result).not.toBe(original);
      expect(result.type).toBe('image/jpeg');
      expect(result.name).toBe('IMG_0001.jpg');
      expect(result.size).toBe(300_000);
      expect(stub.calls).toEqual([{ width: 1600, height: 1200, quality: IMAGE_QUALITY }]);
    });
  });

  it('이미 작은 사진은 원본 그대로 돌려준다', async function keepsSmallPhoto() {
    const original = makeFile('작은사진.jpg', 'image/jpeg', 80_000);
    const stub = makeDownscaler({ width: 1000, height: 800 });

    const result = await downscaleImage(original, stub.downscaler);

    expect(result).toBe(original);
    expect(stub.calls).toEqual([]);
  });

  it('GIF는 원본 그대로 둔다', async function keepsGif() {
    const original = makeFile('움직임.gif', 'image/gif', 3_000_000);
    const stub = makeDownscaler({ width: 4000, height: 3000 });

    const result = await downscaleImage(original, stub.downscaler);

    expect(result).toBe(original);
    expect(stub.calls).toEqual([]);
  });

  it('줄였는데 더 커지면 원본을 쓴다', async function keepsOriginalWhenBigger() {
    // 이미 잘 압축된 JPEG를 다시 인코딩하면 실제로 커지는 일이 있다.
    const original = makeFile('압축된.jpg', 'image/jpeg', 200_000);
    const stub = makeDownscaler({ width: 4000, height: 3000, outputBytes: 250_000 });

    const result = await downscaleImage(original, stub.downscaler);

    expect(result).toBe(original);
  });

  it('그리기가 실패해도 업로드를 막지 않는다', async function fallsBackWhenDrawFails() {
    const original = makeFile('사진.jpg', 'image/jpeg', 5_000_000);
    const stub = makeDownscaler({ width: 4000, height: 3000, drawReturnsNull: true });

    const result = await downscaleImage(original, stub.downscaler);

    expect(result).toBe(original);
  });

  it('읽기가 실패해도 예외를 던지지 않는다', async function fallsBackWhenDecodeFails() {
    // 최적화 때문에 글을 못 올리는 일이 있으면 안 된다.
    const original = makeFile('깨진파일.jpg', 'image/jpeg', 5_000_000);
    const stub = makeDownscaler({ width: 0, height: 0, decodeThrows: true });

    const result = await downscaleImage(original, stub.downscaler);

    expect(result).toBe(original);
  });

  it('다 쓴 비트맵을 닫는다 — 안 닫으면 메모리가 남는다', async function closesBitmap() {
    const original = makeFile('사진.jpg', 'image/jpeg', 5_000_000);
    const stub = makeDownscaler({ width: 4000, height: 3000, outputBytes: 300_000 });

    await downscaleImage(original, stub.downscaler);

    expect(stub.wasClosed()).toBe(true);
  });
});
