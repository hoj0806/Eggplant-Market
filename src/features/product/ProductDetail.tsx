import { Link, useParams } from "react-router-dom";
import { useProduct } from "./useProduct";
import { useDeleteProduct } from "./useDeleteProduct";
import styled from "styled-components";
import DetailImageContainer from "../../ui/DetailImageContainer";
import PostDescription from "./ProductDescription";
import UserOtherProducts from "../../ui/UserOtherProducts";

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

  const params = useParams();

  const handleDeleteProduct = () => {
    deleteProduct(params.productId);
  };

  console.log(product);
  if (isLoading) return <p>상품정보를 불러오고 있습니다...</p>;

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
        <button disabled={isDeleting} onClick={handleDeleteProduct}>
          {isDeleting ? "삭제중입니다..." : "글 삭제하기"}
        </button>
      </MainContainer>
      <UserOtherProducts
        nickname={product.sellerNickname}
        id={product.sellerId}
      />
    </>
  );
};

export default ProductDetail;
