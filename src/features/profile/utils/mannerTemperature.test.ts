import { MAX_MANNER_TEMP, toTemperatureRatio, toTemperatureText } from './mannerTemperature';

describe('toTemperatureText', function textSuite() {
  it('기본값 36.5°가 그대로 읽힌다', function keepsDefault() {
    expect(toTemperatureText(36.5)).toBe('36.5°C');
  });

  it('정수도 소수 한 자리로 적는다', function padsInteger() {
    expect(toTemperatureText(37)).toBe('37.0°C');
  });
});

describe('toTemperatureRatio', function ratioSuite() {
  it('눈금 끝에서 1이 된다', function fullAtMax() {
    expect(toTemperatureRatio(MAX_MANNER_TEMP)).toBe(1);
  });

  it('눈금을 넘겨도 1을 넘지 않는다', function clampsHigh() {
    expect(toTemperatureRatio(120)).toBe(1);
  });

  it('음수는 0으로 눕힌다', function clampsLow() {
    expect(toTemperatureRatio(-5)).toBe(0);
  });

  it('숫자가 아니면 0이다', function handlesNaN() {
    expect(toTemperatureRatio(Number.NaN)).toBe(0);
  });
});
