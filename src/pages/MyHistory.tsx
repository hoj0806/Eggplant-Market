import { useState } from "react";
import styled from "styled-components";
import { usePurchaseHistory } from "../features/purchaseRequest/usePurchaseHistory";
import { useSaleHistory } from "../features/purchaseRequest/useSaleHistory";
import { useDeleteSaleHistory } from "../features/purchaseRequest/useDeleteSaleHistory";
import { useDeletePurchaseHistory } from "../features/purchaseRequest/useDeletePurchaseHistory";

// Styled Components (기존 스타일 재사용)
const TabContainer = styled.div`
  display: flex;
  gap: 2rem;
  margin-bottom: 2rem;
  border-bottom: 2px solid #f0f0f0;
`;

const Tab = styled.div<{ isActive: boolean }>`
  padding: 1rem 2rem;
  cursor: pointer;
  font-weight: bold;
  border-bottom: ${({ isActive }) => (isActive ? "2px solid #007bff" : "none")};
  color: ${({ isActive }) => (isActive ? "#007bff" : "#333")};
  transition: color 0.3s, border-color 0.3s;

  &:hover {
    color: #007bff;
  }
`;

const TabContent = styled.div`
  padding: 2rem;
  background-color: #f9f9f9;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
`;

const HistoryCard = styled.div`
  background-color: #fff;
  padding: 1.5rem;
  margin-bottom: 1rem;
  border-radius: 8px;
  box-shadow: 0 1px 5px rgba(0, 0, 0, 0.1);
`;
const ActionButton = styled.button`
  padding: 0.5rem 1rem;
  background-color: #e74c3c;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  transition: background-color 0.3s;

  &:hover {
    background-color: #c0392b;
  }

  &:disabled {
    background-color: #ccc;
    cursor: not-allowed;
  }
`;

const MyHistory = () => {
  const [activeTab, setActiveTab] = useState<"sale" | "purchase">("sale");

  // get purchase hook
  const { saleHistory, isLoading } = useSaleHistory();
  const { purchaseHistory, isLoading: isLoading2 } = usePurchaseHistory();

  // delete purchase hook
  const { deleteSaleHistory, isDeleting: isDeletingSale } =
    useDeleteSaleHistory();
  const { deletePurchaseHistory, isDeleting: isDeletingPurchase } =
    useDeletePurchaseHistory();

  const handleDeleteSale = (requestId: string) => {
    deleteSaleHistory(requestId); // 삭제 요청
  };

  const handleDeletePurchase = (requestId: string) => {
    console.log(requestId);
    deletePurchaseHistory(requestId); // 삭제 요청
  };

  if (isLoading || isLoading2) return <div>로딩중...</div>;

  return (
    <div>
      <TabContainer>
        <Tab
          isActive={activeTab === "sale"}
          onClick={() => setActiveTab("sale")}
        >
          내가 판매한 물품
        </Tab>
        <Tab
          isActive={activeTab === "purchase"}
          onClick={() => setActiveTab("purchase")}
        >
          내가 구매한 물품
        </Tab>
      </TabContainer>

      {activeTab === "sale" && (
        <TabContent>
          <h2>판매 기록</h2>
          {saleHistory?.length === 0 && <div>판매한 물품이 없습니다.</div>}
          {saleHistory?.map((item) => (
            <HistoryCard key={item.id}>
              <div>
                <strong>상품 ID:</strong> {item.product_id}
              </div>
              <div>
                <strong>구매자 ID:</strong> {item.buyer_id}
              </div>
              <div>
                <strong>상태:</strong> {item.status}
              </div>
              <ActionButton
                onClick={() => handleDeleteSale(item.id)} // 삭제 버튼 클릭 시 삭제 함수 호출
                disabled={isDeletingSale}
              >
                {isDeletingSale ? "삭제 중..." : "삭제"}
              </ActionButton>
            </HistoryCard>
          ))}
        </TabContent>
      )}

      {activeTab === "purchase" && (
        <TabContent>
          <h2>구매 기록</h2>
          {purchaseHistory?.length === 0 && <div>구매한 물품이 없습니다.</div>}
          {purchaseHistory?.map((item) => (
            <HistoryCard key={item.id}>
              <div>
                <strong>상품 ID:</strong> {item.product_id}
              </div>
              <div>
                <strong>판매자 ID:</strong> {item.seller_id}
              </div>
              <div>
                <strong>상태:</strong> {item.status}
              </div>
              <ActionButton
                onClick={() => handleDeletePurchase(item.id)} // 삭제 버튼 클릭 시 삭제 함수 호출
                disabled={isDeletingPurchase}
              >
                {isDeletingPurchase ? "삭제 중..." : "삭제"}
              </ActionButton>
            </HistoryCard>
          ))}
        </TabContent>
      )}
    </div>
  );
};

export default MyHistory;
