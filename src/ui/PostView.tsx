import { useParams } from "react-router-dom";
import useAllRequests from "../features/purchaseRequest/useAllRequests";
import { useProductWishlist } from "../features/wishlist/useProductWishlist";

const PostView = () => {
  const params = useParams();
  const { request, isLoading } = useAllRequests({
    productId: params.productId,
  });

  const { wishlists, isLoading: isLoading2 } = useProductWishlist(
    params?.productId
  );
  if (isLoading || isLoading2) return <div>123</div>;

  console.log(request);
  return (
    <>
      <div>예약 수 : {request?.length}</div>
      <div>조회수 :</div>
      <div>찜 : {wishlists?.length}</div>
    </>
  );
};

export default PostView;
