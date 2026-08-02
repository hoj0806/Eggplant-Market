import '@testing-library/jest-dom';
import { TextDecoder, TextEncoder } from 'node:util';

// jsdom에는 TextEncoder/TextDecoder가 없다. react-router v7이 로드 시점에 이걸 쓴다.
if (globalThis.TextEncoder === undefined) {
  Object.assign(globalThis, { TextEncoder, TextDecoder });
}

// jsdom에는 URL.createObjectURL도 없다. 사진 미리보기(프로필·상품)가 이걸 쓴다.
// 목록의 key로도 쓰이므로 호출마다 다른 값을 돌려줘야 한다.
if (typeof URL.createObjectURL !== 'function') {
  let objectUrlCount = 0;

  URL.createObjectURL = function createObjectURL(): string {
    objectUrlCount += 1;
    return `blob:test/${objectUrlCount}`;
  };
  URL.revokeObjectURL = function revokeObjectURL(): void {
    // 해제할 실제 자원이 없다. 호출만 받아 준다.
  };
}
