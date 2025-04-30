import { useParams } from "react-router-dom";
import useAllRequests from "../features/purchaseRequest/useAllRequests";

const PostView = () => {
  const params = useParams();
  const { request, isLoading } = useAllRequests({
    productId: params.productId,
  });

  if (isLoading) return <div>123</div>;

  console.log(request);
  return (
    <>
      <div>예약 수 : {request?.length}</div>
      <div>조회수</div>
    </>
  );
};

export default PostView;
