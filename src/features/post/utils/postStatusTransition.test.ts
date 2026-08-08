import {
  canChangePostStatus,
  needsTradePartner,
  toTradePartnerPrompt,
  toTradePartnerSkipLabel,
} from './postStatusTransition';
import type { PostStatus } from '../types';

const ALL_STATUSES: ReadonlyArray<PostStatus> = ['selling', 'reserved', 'sold'];

describe('canChangePostStatus', function canChangePostStatusSuite() {
  it('판매중과 예약중은 서로 오갈 수 있다', function sellingAndReserved() {
    expect(canChangePostStatus('selling', 'reserved')).toBe(true);
    expect(canChangePostStatus('reserved', 'selling')).toBe(true);
  });

  it('판매중·예약중에서 거래완료로 갈 수 있다', function toSold() {
    expect(canChangePostStatus('selling', 'sold')).toBe(true);
    expect(canChangePostStatus('reserved', 'sold')).toBe(true);
  });

  it('거래완료에서는 어디로도 갈 수 없다', function soldIsFinal() {
    for (const target of ALL_STATUSES) {
      expect(canChangePostStatus('sold', target)).toBe(false);
    }
  });

  it('같은 상태로는 바꾸지 않는다', function sameStatus() {
    for (const status of ALL_STATUSES) {
      expect(canChangePostStatus(status, status)).toBe(false);
    }
  });
});

describe('needsTradePartner', function needsTradePartnerSuite() {
  it('예약중과 거래완료는 상대를 묻는다', function asksPartner() {
    expect(needsTradePartner('reserved')).toBe(true);
    expect(needsTradePartner('sold')).toBe(true);
  });

  it('판매중으로 되돌릴 때는 묻지 않는다', function noPartner() {
    expect(needsTradePartner('selling')).toBe(false);
  });
});

describe('상대를 고르는 화면의 문구', function tradePartnerTextSuite() {
  it('거래완료와 예약중의 질문이 다르다', function differentPrompt() {
    expect(toTradePartnerPrompt('sold')).toBe('누구와 거래하셨나요?');
    expect(toTradePartnerPrompt('reserved')).toBe('예약자를 선택해 주세요');
  });

  it('건너뛰기 문구도 다르다', function differentSkipLabel() {
    expect(toTradePartnerSkipLabel('sold')).toBe('거래한 이웃을 찾을 수 없어요');
    expect(toTradePartnerSkipLabel('reserved')).toBe('아직 정하지 않았어요');
  });
});
