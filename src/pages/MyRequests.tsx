import { useState } from "react";
import { useAcceptRequest } from "../features/purchaseRequest/useAcceptRequest";
import { useCompleteRequest } from "../features/purchaseRequest/useCompleteRequest";
import { useCancelRequest } from "../features/purchaseRequest/useCancelRequest";
import { useReceivedRequests } from "../features/purchaseRequest/useReceivedRequest";
import { useSentRequests } from "../features/purchaseRequest/useSentRequest";
import styled from "styled-components";

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

const RequestCard = styled.div`
  background-color: #fff;
  padding: 1.5rem;
  margin-bottom: 1rem;
  border-radius: 8px;
  box-shadow: 0 1px 5px rgba(0, 0, 0, 0.1);
`;

const RequestActions = styled.div`
  display: flex;
  gap: 1rem;
  margin-top: 1rem;
`;

const ActionButton = styled.button`
  padding: 0.5rem 1rem;
  background-color: #007bff;
  color: #fff;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  transition: background-color 0.3s;

  &:hover {
    background-color: #0056b3;
  }

  &:disabled {
    background-color: #ccc;
    cursor: not-allowed;
  }
`;

// 받은 요청에서 삭제 기능 추가하기
const MyRequests = () => {
  const [activeTab, setActiveTab] = useState<"sent" | "received">("sent");

  const { isLoading, sentRequests } = useSentRequests();
  const { isLoading: isLoading2, receivedRequests } = useReceivedRequests();
  const { cancelRequest, isCanceling } = useCancelRequest();
  const { acceptRequest, isAccepting } = useAcceptRequest();
  const { completeRequest, isCompleting } = useCompleteRequest();

  if (isLoading || isLoading2) return <div>로딩중입니다...</div>;

  const handleTabChange = (tab: "sent" | "received") => {
    setActiveTab(tab);
  };

  return (
    <div>
      {/* 탭 */}
      <TabContainer>
        <Tab
          isActive={activeTab === "sent"}
          onClick={() => handleTabChange("sent")}
        >
          내가 보낸 요청
        </Tab>
        <Tab
          isActive={activeTab === "received"}
          onClick={() => handleTabChange("received")}
        >
          내가 받은 요청
        </Tab>
      </TabContainer>

      {/* 탭 내용 */}
      {activeTab === "sent" && (
        <TabContent>
          <h1>내가 보낸 요청</h1>
          {sentRequests?.map((request) => (
            <RequestCard key={request.product_id}>
              <div>
                <strong>상품 ID:</strong> {request.product_id}
              </div>
              <RequestActions>
                <ActionButton
                  disabled={isCanceling}
                  onClick={() => {
                    cancelRequest({
                      product_id: request.product_id,
                      buyer_id: request.buyer_id,
                    });
                  }}
                >
                  요청 취소
                </ActionButton>
              </RequestActions>
            </RequestCard>
          ))}
        </TabContent>
      )}

      {activeTab === "received" && (
        <TabContent>
          <h1>내가 받은 요청</h1>
          {receivedRequests?.map((request) => (
            <RequestCard key={request.product_id}>
              <div>
                <strong>상품 ID:</strong> {request.product_id}
              </div>
              <RequestActions>
                {/* 상태가 "accepted"인 경우 */}
                {request.status === "accepted" ? (
                  <ActionButton
                    disabled={isCompleting}
                    onClick={() => {
                      completeRequest({
                        requestId: request.id,
                        productId: request.product_id,
                      });
                    }}
                  >
                    판매완료
                  </ActionButton>
                ) : (
                  <>
                    <ActionButton
                      disabled={isAccepting}
                      onClick={() =>
                        acceptRequest({
                          requestId: request.id,
                          productId: request.product_id,
                        })
                      }
                    >
                      요청 수락하기
                    </ActionButton>
                    <ActionButton disabled={isCanceling}>
                      요청 삭제하기
                    </ActionButton>
                  </>
                )}
              </RequestActions>
            </RequestCard>
          ))}
        </TabContent>
      )}
    </div>
  );
};

export default MyRequests;
