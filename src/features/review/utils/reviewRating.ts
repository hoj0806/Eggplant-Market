import { Frown, Meh, Smile, type LucideIcon } from 'lucide-react';
import type { ReviewRating } from '../types';

/** 화면에 놓이는 순서. 좋은 쪽을 앞에 둔다 — 대부분의 거래가 그쪽이다. */
export const REVIEW_RATING_ORDER: ReadonlyArray<ReviewRating> = ['good', 'normal', 'bad'];

export const REVIEW_RATING_LABEL: Record<ReviewRating, string> = {
  good: '좋아요',
  normal: '보통이에요',
  bad: '별로예요',
};

/**
 * 프로필의 받은 후기 옆에 붙는 표식. 글자만으로는 훑을 때 눈에 걸리지 않는다.
 *
 * 이모지(`😊 😐 😞`)에서 아이콘으로 바꿨다. 표정 이모지는 기기마다 인상이 크게 달라
 * **같은 "보통이에요"가 애플에서는 무표정, 안드로이드에서는 뾰로통하게** 보였다.
 * 남의 평가를 옮겨 적는 자리라 그 차이가 뜻을 바꾼다.
 */
export const REVIEW_RATING_ICON: Record<ReviewRating, LucideIcon> = {
  good: Smile,
  normal: Meh,
  bad: Frown,
};

/**
 * 고를 수 있는 매너 태그.
 *
 * 평가에 따라 다른 목록을 준다. "좋아요"를 고르고 "약속을 안 지켜요"를 붙이는 후기는
 * 읽는 사람이 해석할 수 없고, 매너온도는 이미 평가 쪽만 보고 오르내리기 때문이다.
 * 보통도 좋은 쪽 목록을 쓴다 — 나쁜 태그가 필요할 만한 거래면 평가부터 "별로예요"다.
 *
 * 서버는 이 목록을 모른다(0013은 개수와 길이만 본다). comment가 어차피 자유 문구라
 * 태그만 값으로 잠가 봐야 막는 것이 없어서, 고르는 편의를 위한 목록으로 화면에 뒀다.
 */
const POSITIVE_MANNER_TAGS: ReadonlyArray<string> = [
  '시간 약속을 잘 지켜요',
  '친절하고 매너가 좋아요',
  '상품 상태가 설명한 그대로예요',
  '응답이 빨라요',
  '좋은 가격에 나눔해 주셨어요',
];

const NEGATIVE_MANNER_TAGS: ReadonlyArray<string> = [
  '약속 시간을 안 지켜요',
  '연락이 잘 안돼요',
  '상품 상태가 설명과 달라요',
  '무리하게 가격을 깎아요',
  '거래 약속을 취소했어요',
];

export function toMannerTagOptions(rating: ReviewRating): ReadonlyArray<string> {
  return rating === 'bad' ? NEGATIVE_MANNER_TAGS : POSITIVE_MANNER_TAGS;
}

/** 한 후기에 붙일 수 있는 태그 수. 0013의 reviews_manner_tags_bounded와 같은 값이다. */
export const MAX_MANNER_TAGS = 5;

/**
 * 태그 하나를 켜고 끈다.
 *
 * 이미 고른 태그를 다시 누르면 빠진다. 개수가 찼을 때는 **아무 일도 일어나지 않는다** —
 * 가장 오래된 것을 밀어내면 방금 누른 것 말고 다른 태그가 조용히 사라진다.
 */
export function toggleMannerTag(tags: ReadonlyArray<string>, tag: string): string[] {
  if (tags.includes(tag)) {
    return tags.filter(function keepOthers(current: string): boolean {
      return current !== tag;
    });
  }

  if (tags.length >= MAX_MANNER_TAGS) {
    return [...tags];
  }

  return [...tags, tag];
}
