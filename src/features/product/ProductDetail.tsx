import { Link, useParams } from "react-router-dom";
import { useProduct } from "./useProduct";
import { useDeleteProduct } from "./useDeleteProduct";
import styled from "styled-components";
import DetailImageContainer from "../../ui/DetailImageContainer";
import PostDescription from "./ProductDescription";
import UserOtherProducts from "../../ui/UserOtherProducts";
import { useCreateRequest } from "../purchaseRequest/useCreateRequest";
import {
  usePendingRequestByProductAndBuyer,
  useRequests,
} from "../purchaseRequest/usePendingRequestByProductAndBuyer ";
import { useDeleteRequest } from "../purchaseRequest/useDeleteRequest";

const MainContainer = styled.div`
  padding-top: 2rem;
  background-color: yellow;
  display: flex;
  gap: 1rem;
  flex-direction: column;
`;

const ProductDetailBox = styled.div`
  display: flex;
  gap: 4rem;
`;
const DetailLinkBox = styled.div`
  font-size: 1.4rem;
  display: flex;
  gap: 1rem;
`;
const ProductDetail = () => {
  const { product, isLoading } = useProduct();
  const { deleteProduct, isDeleting } = useDeleteProduct();
  const { createRequest, isCreating } = useCreateRequest();
  const {
    pendingRequests,
    isPendingRequestExists,
    isLoading: isLoading2,
  } = usePendingRequestByProductAndBuyer();
  const { deleteRequestMutation, isDeleting: isDeletingRequest } =
    useDeleteRequest();

  const params = useParams();

  const handleDeleteProduct = () => {
    deleteProduct(params.productId);
  };

  const handleRequest = () => {
    createRequest({ productId: product.id, sellerId: product.sellerId });
  };

  const handleCancelRequest = () => {
    if (pendingRequests && pendingRequests.length > 0) {
      console.log(pendingRequests[0]);
      const { product_id, buyer_id } = pendingRequests[0];
      console.log(product_id, buyer_id);
      deleteRequestMutation({ product_id, buyer_id });
    }
  };

  if (isLoading || isLoading2) return <p>상품정보를 불러오고 있습니다...</p>;

  console.log(isPendingRequestExists);
  return (
    <>
      <MainContainer>
        <DetailLinkBox>
          <Link to='/'>홈</Link>
          <p>{product.postTitle}</p>
        </DetailLinkBox>
        <ProductDetailBox>
          <DetailImageContainer images={product.image} />
          <PostDescription />
        </ProductDetailBox>
        {isPendingRequestExists ? (
          <button
            onClick={handleCancelRequest}
            disabled={isCreating || isDeleting}
          >
            요청 취소하기
          </button>
        ) : (
          <button onClick={handleRequest} disabled={isCreating}>
            구매요청 하기
          </button>
        )}
        <button disabled={isDeleting} onClick={handleDeleteProduct}>
          {isDeleting ? "삭제중입니다..." : "글 삭제하기"}
        </button>
      </MainContainer>
      <UserOtherProducts
        nickname={product?.sellerNickname}
        id={product?.sellerId}
      />
    </>
  );
};

export default ProductDetail;
