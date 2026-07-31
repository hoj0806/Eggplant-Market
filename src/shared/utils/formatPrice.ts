// 가격을 한국어 표기로 변환한다. 0원은 '나눔'으로 표시.
export function formatPrice(price: number): string {
  if (price === 0) {
    return '나눔';
  }
  return price.toLocaleString('ko-KR') + '원';
}
