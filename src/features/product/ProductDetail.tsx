import { Link, useParams } from "react-router-dom";
import { useProduct } from "./useProduct";
import { useDeleteProduct } from "./useDeleteProduct";
import styled from "styled-components";
import PostDescription from "./ProductDescription";
import UserOtherProducts from "../../ui/UserOtherProducts";
import { useCreateRequest } from "../purchaseRequest/useCreateRequest";
import { usePendingRequestByProductAndBuyer } from "../purchaseRequest/usePendingRequestByProductAndBuyer ";
import { useCancelRequest } from "../purchaseRequest/useCancelRequest";
import ImageSlider from "../../ui/ImageSlider";
import { useMyWishlists } from "../wishlist/useMyWishlists";
import { useAddToWishlist } from "../wishlist/useAddToWishlist";
import { useDeleteFromWishlist } from "../wishlist/useDeleteFromWishlist";

const LinkBox = styled.div`
  font-size: 1.4rem;
  display: flex;
  gap: 1rem;
  margin-top: 3.2rem;

  & p {
    font-weight: bold;
  }
`;

const MainContainer = styled.div``;

const ProductDetailBox = styled.div`
  display: flex;
  margin-top: 1.6rem;
  gap: 4rem;
`;

const ProductDetail = () => {
  const params = useParams();

  const { product, isLoading } = useProduct();
  const { deleteProduct, isDeleting } = useDeleteProduct();
  const { createRequest, isCreating } = useCreateRequest();
  const {
    pendingRequests,
    isPendingRequestExists,
    isLoading: isLoading2,
  } = usePendingRequestByProductAndBuyer();
  const { cancelRequest, isCanceling } = useCancelRequest();

  const { myWishlists, isLoading: isLoading3 } = useMyWishlists(
    params.productId
  );
  const { addWishlist, isAdding } = useAddToWishlist();

  const { deleteWishlist, isDeleting: isDeletingWish } =
    useDeleteFromWishlist();

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
      cancelRequest({ product_id, buyer_id });
    }
  };

  const handleAddWishlist = () => {
    addWishlist(product.id);
  };

  const handleDeleteWishlist = () => {
    deleteWishlist(product.id);
  };
  if (isLoading || isLoading2 || isLoading3)
    return <p>상품정보를 불러오고 있습니다...</p>;

  console.log(myWishlists);
  return (
    <>
      <MainContainer>
        <LinkBox>
          <Link to='/'>홈</Link>
          <p>{product.postTitle}</p>
        </LinkBox>
        <ProductDetailBox>
          <ImageSlider images={JSON.parse(product.image)} />
          <PostDescription />
        </ProductDetailBox>
        {myWishlists && myWishlists.length === 0 ? (
          <button onClick={handleAddWishlist} disabled={isAdding}>
            찜하기
          </button>
        ) : (
          <button disabled={isDeletingWish} onClick={handleDeleteWishlist}>
            찜 취소
          </button>
        )}
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
