import { getCurrentCoords } from './getCurrentCoords';
import { toRegionErrorCode } from './regionErrors';

const PERMISSION_DENIED_CODE = 1;
const POSITION_UNAVAILABLE_CODE = 2;
const TIMEOUT_CODE = 3;

type GetCurrentPositionMock = jest.Mock<void, [PositionCallback, PositionErrorCallback?]>;

function stubGeolocation(getCurrentPosition: GetCurrentPositionMock | undefined): void {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: getCurrentPosition === undefined ? undefined : { getCurrentPosition },
  });
}

function stubSecureContext(isSecureContext: boolean): void {
  Object.defineProperty(window, 'isSecureContext', {
    configurable: true,
    value: isSecureContext,
  });
}

function createSuccessMock(lat: number, lng: number): GetCurrentPositionMock {
  return jest.fn(function succeed(onSuccess: PositionCallback): void {
    onSuccess({ coords: { latitude: lat, longitude: lng } } as GeolocationPosition);
  });
}

function createFailureMock(code: number): GetCurrentPositionMock {
  return jest.fn(function fail(
    _onSuccess: PositionCallback,
    onError?: PositionErrorCallback,
  ): void {
    onError?.({ code } as GeolocationPositionError);
  });
}

/** 던져진 오류에서 코드만 꺼낸다. 실패하지 않으면 테스트를 실패시킨다. */
async function catchErrorCode(promise: Promise<unknown>): Promise<string | null> {
  try {
    await promise;
  } catch (error: unknown) {
    return toRegionErrorCode(error);
  }

  throw new Error('실패할 것으로 기대한 호출이 성공했다.');
}

describe('getCurrentCoords', function getCurrentCoordsSuite() {
  beforeEach(function resetEnvironment() {
    stubSecureContext(true);
    stubGeolocation(createSuccessMock(37.6379, 127.0146));
  });

  it('현재 좌표를 돌려준다', async function successCase() {
    await expect(getCurrentCoords()).resolves.toEqual({ lat: 37.6379, lng: 127.0146 });
  });

  it('보안 컨텍스트가 아니면 권한 거부와 구분해서 알린다', async function insecureCase() {
    stubSecureContext(false);

    expect(await catchErrorCode(getCurrentCoords())).toBe('insecure_origin');
  });

  it('geolocation을 지원하지 않으면 그렇게 알린다', async function unsupportedCase() {
    stubGeolocation(undefined);

    expect(await catchErrorCode(getCurrentCoords())).toBe('geolocation_unsupported');
  });

  it('권한 거부를 구분한다', async function deniedCase() {
    stubGeolocation(createFailureMock(PERMISSION_DENIED_CODE));

    expect(await catchErrorCode(getCurrentCoords())).toBe('geolocation_denied');
  });

  it('위치 확인 불가를 구분한다', async function unavailableCase() {
    stubGeolocation(createFailureMock(POSITION_UNAVAILABLE_CODE));

    expect(await catchErrorCode(getCurrentCoords())).toBe('geolocation_unavailable');
  });

  it('시간 초과를 구분한다', async function timeoutCase() {
    stubGeolocation(createFailureMock(TIMEOUT_CODE));

    expect(await catchErrorCode(getCurrentCoords())).toBe('geolocation_timeout');
  });
});
