import { useState } from 'react';
import MyListLayout from './myListLayout';
import MyPostList from './myPostList';
import SellingStatusFilter from './sellingStatusFilter';
import { selectAuthUser, useAuthStore } from '../../auth/store/authStore';
import { useMyPostsQuery } from '../hooks/useMyPostsQuery';
import type { SellingStatusFilter as StatusFilter } from '../types';

const EMPTY_MESSAGE_BY_FILTER: Record<string, string> = {
  all: '아직 올린 물건이 없어요. 안 쓰는 물건을 팔아 보세요.',
  selling: '판매중인 물건이 없어요.',
  reserved: '예약중인 물건이 없어요.',
  sold: '거래완료한 물건이 없어요.',
};

/**
 * 판매관리 — 내가 올린 글.
 *
 * 상태를 바꾸는 일은 여기서 하지 않는다. 거래 상대를 고르는 절차(tradePartnerPicker)가 따라붙어
 * 목록 카드 안에 넣기에는 무겁고, 게시물 상세에 이미 그 자리(PostStatusControl)가 있다.
 * 카드를 누르면 그리로 간다.
 */
function SellingPostsPage() {
  const user = useAuthStore(selectAuthUser);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(null);

  const postsQuery = useMyPostsQuery('sales', user?.id ?? null, statusFilter);

  return (
    <MyListLayout title="판매관리">
      <SellingStatusFilter value={statusFilter} onChange={setStatusFilter} />

      <MyPostList
        kind="sales"
        query={postsQuery}
        emptyMessage={EMPTY_MESSAGE_BY_FILTER[statusFilter ?? 'all']}
      />
    </MyListLayout>
  );
}

export default SellingPostsPage;
