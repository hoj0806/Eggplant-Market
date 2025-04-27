import { useDeleteRequest } from "../features/purchaseRequest/useDeleteRequest";
import { useReceivedRequests } from "../features/purchaseRequest/useReceivedRequest";
import { useSentRequests } from "../features/purchaseRequest/useSentRequest";

const MyRequests = () => {
  const { isLoading, sentRequests } = useSentRequests();
  const { isLoading: isLoading2, receivedRequests } = useReceivedRequests();
  const { deleteRequestMutation, isDeleting: isDeletingRequest } =
    useDeleteRequest();

  if (isLoading || isLoading2) return <div>로딩중입니다...</div>;
  console.log(sentRequests);

  console.log(receivedRequests);
  return (
    <div>
      <div>
        <h1>내가 보낸 요청</h1>
        {sentRequests?.map((request) => {
          return (
            <>
              <div>{request.product_id}</div>
              <button
                disabled={isDeletingRequest}
                onClick={() => {
                  deleteRequestMutation({
                    product_id: request.product_id,
                    buyer_id: request.buyer_id,
                  });
                }}
              >
                요청 취소
              </button>
            </>
          );
        })}
      </div>

      <div>
        <h1>내가 받은 요청</h1>
        {receivedRequests?.map((request) => {
          return (
            <>
              <div>{request.product_id}</div>
              <button disabled={isDeletingRequest}>요청 취소하기</button>
              <button disabled={isDeletingRequest}>요청 수락하기</button>
              <button disabled={isDeletingRequest}>요청 삭제하기</button>
            </>
          );
        })}
      </div>
    </div>
  );
};

export default MyRequests;
