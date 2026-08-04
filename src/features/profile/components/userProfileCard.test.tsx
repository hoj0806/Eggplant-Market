import { render, screen } from '@testing-library/react';
import UserProfileCard from './userProfileCard';
import type { UserProfile } from '../types';

function toProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'user-1',
    nickname: '가지이웃',
    avatarUrl: null,
    mannerTemp: 36.5,
    dongName: '서울특별시 강북구 수유동',
    createdAt: '2026-08-01T00:00:00.000Z',
    sellingCount: 3,
    soldCount: 2,
    reviewCount: 1,
    ...overrides,
  };
}

describe('UserProfileCard', function userProfileCardSuite() {
  it('매너온도를 소수 한 자리로 보여준다', function showsTemperature() {
    render(<UserProfileCard profile={toProfile()} />);

    expect(screen.getByText('36.5°C')).toBeInTheDocument();
  });

  it('판매중·거래완료·받은 후기 개수를 함께 보여준다', function showsCounts() {
    render(<UserProfileCard profile={toProfile()} />);

    expect(screen.getByText('판매중').nextSibling).toHaveTextContent('3');
    expect(screen.getByText('거래완료').nextSibling).toHaveTextContent('2');
    expect(screen.getByText('받은 후기').nextSibling).toHaveTextContent('1');
  });

  it('동네를 정하지 않은 사람도 그린다', function handlesMissingRegion() {
    render(<UserProfileCard profile={toProfile({ dongName: null })} />);

    expect(screen.getByText('동네 미설정')).toBeInTheDocument();
  });

  it('가입한 달까지만 적는다', function showsJoinedMonth() {
    render(<UserProfileCard profile={toProfile()} />);

    expect(screen.getByText('2026년 8월 가입')).toBeInTheDocument();
  });
});
