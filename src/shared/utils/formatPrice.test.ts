import { formatPrice } from './formatPrice';

describe('formatPrice', function formatPriceSuite() {
  it('0원은 나눔으로 표시한다', function zeroCase() {
    expect(formatPrice(0)).toBe('나눔');
  });

  it('천 단위 구분과 원 단위를 붙인다', function normalCase() {
    expect(formatPrice(15000)).toBe('15,000원');
  });
});
