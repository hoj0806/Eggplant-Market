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
  const params = useParams();

  const handleDeleteProduct = () => {
    deleteProduct(params.productId);
  };

  const handleRequest = () => {
    createRequest({ productId: product.id });
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
        <button onClick={handleRequest} disabled={isCreating}>
          구매요청 하기
        </button>
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
