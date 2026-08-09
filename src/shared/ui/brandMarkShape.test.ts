import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  BRAND_FRUIT_COLOR,
  BRAND_FRUIT_PATH,
  BRAND_LEAF_COLOR,
  BRAND_LEAF_PATH,
  BRAND_MARK_VIEW_BOX_FAVICON,
  BRAND_STEM_PATH,
  BRAND_STEM_WIDTH_FAVICON,
} from './brandMarkShape';

/**
 * 파비콘은 정적 파일이라 `brandMarkShape.ts`를 import할 수 없다 — 값을 옮겨 적은 사본이다.
 * 사본은 언젠가 어긋나므로, **어긋나는 순간 여기서 깨지게** 해 둔다.
 *
 * .ico는 내용을 못 비교한다(바이너리다). 대신 **있는지와 진짜 ICO인지**만 본다.
 * 실제 그림이 맞는지는 `scripts/generateFavicon.py`가 favicon.svg에서 만들어 보장한다.
 */

const PROJECT_ROOT = resolve(__dirname, '../../..');

function readText(relativePath: string) {
  return readFileSync(resolve(PROJECT_ROOT, relativePath), 'utf-8');
}

describe('파비콘', function faviconSuite() {
  const faviconSvg = readText('public/favicon.svg');
  const indexHtml = readText('index.html');

  describe('favicon.svg는 화면의 표식과 같은 가지를 그린다', function shapeSuite() {
    it('열매 경로와 색이 같다', function fruitMatches() {
      expect(faviconSvg).toContain(`d="${BRAND_FRUIT_PATH}"`);
      expect(faviconSvg).toContain(`fill="${BRAND_FRUIT_COLOR}"`);
    });

    it('꼭지 경로와 색이 같다', function leafMatches() {
      expect(faviconSvg).toContain(`d="${BRAND_LEAF_PATH}"`);
      expect(faviconSvg).toContain(`fill="${BRAND_LEAF_COLOR}"`);
    });

    it('줄기 경로가 같고, 굵기만 파비콘용으로 키웠다', function stemMatches() {
      expect(faviconSvg).toContain(`d="${BRAND_STEM_PATH}"`);
      expect(faviconSvg).toContain(`stroke-width="${BRAND_STEM_WIDTH_FAVICON}"`);
      expect(faviconSvg).toContain(`stroke="${BRAND_LEAF_COLOR}"`);
    });

    it('뷰박스는 도형에 바짝 붙인 파비콘용 값이다', function viewBoxMatches() {
      expect(faviconSvg).toContain(`viewBox="${BRAND_MARK_VIEW_BOX_FAVICON}"`);
    });

    it('xmlns가 있다', function hasNamespace() {
      // 파일로 직접 열릴 때 필요하다. 없으면 브라우저가 XML로 읽고 아무것도 안 그린다.
      expect(faviconSvg).toContain('xmlns="http://www.w3.org/2000/svg"');
    });
  });

  describe('favicon.ico', function icoSuite() {
    const bytes = readFileSync(resolve(PROJECT_ROOT, 'public/favicon.ico'));

    it('ICO 머리말을 갖는다', function hasIcoHeader() {
      // reserved=0, type=1(아이콘). 이게 아니면 브라우저가 그림으로 안 본다.
      expect(bytes.readUInt16LE(0)).toBe(0);
      expect(bytes.readUInt16LE(2)).toBe(1);
    });

    it('16·32·48 세 벌을 담는다', function hasThreeSizes() {
      const count = bytes.readUInt16LE(4);
      expect(count).toBe(3);

      const widths: number[] = [];
      for (let index = 0; index < count; index += 1) {
        widths.push(bytes.readUInt8(6 + index * 16));
      }
      expect(widths).toEqual([16, 32, 48]);
    });

    it('각 벌이 파일 안에 온전히 들어 있다', function entriesFitInFile() {
      const count = bytes.readUInt16LE(4);

      for (let index = 0; index < count; index += 1) {
        const entry = 6 + index * 16;
        const size = bytes.readUInt32LE(entry + 8);
        const offset = bytes.readUInt32LE(entry + 12);

        expect(size).toBeGreaterThan(0);
        expect(offset + size).toBeLessThanOrEqual(bytes.length);
      }
    });
  });

  describe('index.html', function linkSuite() {
    it('svg와 ico를 모두 건다', function linksBoth() {
      expect(indexHtml).toContain('href="/favicon.svg"');
      expect(indexHtml).toContain('href="/favicon.ico"');
      expect(indexHtml).toContain('type="image/svg+xml"');
    });

    it('ico를 svg보다 먼저 적는다', function icoComesFirst() {
      // 브라우저는 읽을 수 있는 것 중 뒤에 온 것을 고른다. 순서가 곧 우선순위다.
      expect(indexHtml.indexOf('href="/favicon.ico"')).toBeLessThan(
        indexHtml.indexOf('href="/favicon.svg"'),
      );
    });
  });
});
