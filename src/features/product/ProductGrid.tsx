import { useNavigate, useSearchParams } from "react-router-dom";
import { useProducts } from "./useProducts";
import styled from "styled-components";
import ReservedStatusBadge from "../../ui/reservedStatusBadge";

const StyledGrid = styled.div`
  display: grid;
  flex: 1;
  grid-template-columns: repeat(4, 1fr);
  gap: 2rem;
  row-gap: 4rem;
`;

const ProductCard = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  cursor: pointer;
  overflow: hidden;
  width: 23.15rem; /* 이거 넣어야 일관성 유지돼 */

  &:hover img {
    transform: scale(1.05); /* 카드에 hover할 때 이미지 확대 */
  }
`;

const ProductImage = styled.div`
  width: 100%;
  height: 23.15rem;
  overflow: hidden;
  border-radius: 2rem;
  position: relative;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.3s ease;
    display: block;
  }
`;

const ProductInfo = styled.div``;

const ProductTitle = styled.h3`
  font-size: 1.6rem;
  font-weight: 500;
  margin-bottom: 0.6rem;
  color: #222;
`;

const ProductPrice = styled.p`
  font-weight: bold;
  font-size: 1.6rem;
`;

const ProductGrid = () => {
  const [searchParams] = useSearchParams();
  const searchTerm = searchParams.get("search") || "";
  const categoryTerm = searchParams.get("category") || "";
  const priceRangeTerm = searchParams.get("price") || "";

  const navigate = useNavigate();
  const { products, isPending } = useProducts(
    searchTerm,
    categoryTerm,
    priceRangeTerm
  );

  if (isPending) return <div>게시물을 가져오는 중입니다...</div>;

  return (
    <StyledGrid>
      {products?.map((product) => {
        let imageArray: string[] = [];
        try {
          imageArray = JSON.parse(product.image);
        } catch (err) {
          console.error("이미지 파싱 에러", err);
        }

        return (
          <ProductCard
            key={product.id}
            onClick={() => navigate(`/product/${product.id}`)}
          >
            {imageArray.length > 0 && (
              <ProductImage>
                {product.status === "reserved" && (
                  <ReservedStatusBadge>예약중</ReservedStatusBadge>
                )}
                {product.status === "soldOut" && (
                  <ReservedStatusBadge>판매완료</ReservedStatusBadge>
                )}
                <img src={imageArray[0]} alt={product.title} />
              </ProductImage>
            )}
            <ProductInfo>
              <ProductTitle>{product.postTitle}</ProductTitle>
              <ProductPrice>{product.price?.toLocaleString()}원</ProductPrice>
            </ProductInfo>
          </ProductCard>
        );
      })}
    </StyledGrid>
  );
};

export default ProductGrid;
