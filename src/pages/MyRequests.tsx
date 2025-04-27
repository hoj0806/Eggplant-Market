import { useSentRequests } from "../features/purchaseRequest/useSentRequest";

const MyRequests = () => {
  const { isLoading, sentRequests } = useSentRequests();

  if (isLoading) return <div>로딩중입니다...</div>;
  console.log(sentRequests);
  return <div>내 요청 페이지 입니다.</div>;
};

export default MyRequests;
