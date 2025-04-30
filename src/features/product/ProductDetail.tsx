import { Link, useParams } from "react-router-dom";
import { useProduct } from "./useProduct";
import { useDeleteProduct } from "./useDeleteProduct";
import styled from "styled-components";
import PostDescription from "./ProductDescription";
import UserOtherProducts from "../../ui/UserOtherProducts";
import { useCreateRequest } from "../purchaseRequest/useCreateRequest";
import { useCancelRequest } from "../purchaseRequest/useCancelRequest";
import ImageSlider from "../../ui/ImageSlider";
import { useMyWishlists } from "../wishlist/useMyWishlists";
import { useAddToWishlist } from "../wishlist/useAddToWishlist";
import { useDeleteFromWishlist } from "../wishlist/useDeleteFromWishlist";
import ProductControlButton from "../../ui/ProductControlButton";
import useRequest from "../purchaseRequest/useRequest";
import { useUser } from "../authentication/useUser";
import PostView from "../../ui/PostView";
import { useIncreaseProductViews } from "./useIncreaseProductViews";
import { useEffect } from "react";

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
  const { incrementViews } = useIncreaseProductViews();

  const params = useParams();

  const { user } = useUser();
  const { product, isLoading } = useProduct();
  const { deleteProduct, isDeleting } = useDeleteProduct();
  const { createRequest, isCreating } = useCreateRequest();

  const { cancelRequest, isCanceling } = useCancelRequest();

  const { myWishlists, isLoading: isLoading3 } = useMyWishlists(
    params.productId
  );
  const { addWishlist, isAdding } = useAddToWishlist();

  const { deleteWishlist, isDeleting: isDeletingWish } =
    useDeleteFromWishlist();
  const { request, isLoading: isLoadingRequest } = useRequest({
    productId: params.productId!,
    buyerId: user?.id ?? "",
  });

  const handleDeleteProduct = () => {
    deleteProduct(params.productId);
  };

  const handleRequest = () => {
    createRequest({ productId: product.id, sellerId: product.sellerId });
  };

  const handleCancelRequest = () => {
    cancelRequest({
      productId: product.id,
      buyerId: user?.id,
    });
  };

  const handleAddWishlist = () => {
    addWishlist(product.id);
  };

  const handleDeleteWishlist = () => {
    deleteWishlist(product.id);
  };

  useEffect(() => {
    if (params.productId) {
      incrementViews(Number(params.productId));
    }
  }, [params.productId, incrementViews]);

  if (isLoading || isLoading3 || isLoadingRequest)
    return <p>상품정보를 불러오고 있습니다...</p>;

  const isOwnerPost = user?.id === product.sellerId;
  console.log(product.views);
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
        <PostView view={product.views} />
        {isOwnerPost ? (
          <ProductControlButton
            onClick={handleDeleteProduct}
            disabled={isDeleting}
          >
            {isDeleting ? "삭제중입니다..." : "글 삭제하기"}
          </ProductControlButton>
        ) : (
          <>
            {myWishlists && myWishlists.length === 0 ? (
              <ProductControlButton
                onClick={handleAddWishlist}
                disabled={isAdding}
              >
                찜하기
              </ProductControlButton>
            ) : (
              <ProductControlButton
                disabled={isDeletingWish}
                onClick={handleDeleteWishlist}
              >
                찜 취소
              </ProductControlButton>
            )}
            {request[0]?.status === "pending" && (
              <ProductControlButton
                onClick={handleCancelRequest}
                disabled={isCanceling}
              >
                요청 취소하기
              </ProductControlButton>
            )}
            {request?.length === 0 && (
              <ProductControlButton
                onClick={handleRequest}
                disabled={isCreating}
              >
                구매요청 하기
              </ProductControlButton>
            )}
          </>
        )}
      </MainContainer>
      <UserOtherProducts
        nickname={product?.sellerNickname}
        id={product?.sellerId}
      />
    </>
  );
};

export default ProductDetail;
