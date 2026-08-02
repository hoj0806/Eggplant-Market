import '@testing-library/jest-dom';
import { TextDecoder, TextEncoder } from 'node:util';

// jsdom에는 TextEncoder/TextDecoder가 없다. react-router v7이 로드 시점에 이걸 쓴다.
if (globalThis.TextEncoder === undefined) {
  Object.assign(globalThis, { TextEncoder, TextDecoder });
}
