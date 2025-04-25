import { useNavigate, useSearchParams } from "react-router-dom";
import { useProducts } from "./useProducts";
import styled from "styled-components";

const StyledGrid = styled.div`
  display: grid;
  flex: 1; /* 남은 공간 모두 차지 */
  grid-template-columns: repeat(4, 1fr);
  gap: 2rem;
  padding: 2rem;

  @media (max-width: 1024px) {
    grid-template-columns: repeat(2, 1fr);
  }

  @media (max-width: 600px) {
    grid-template-columns: 1fr;
  }
`;

const ProductCard = styled.div`
  cursor: pointer;
  border-radius: 1.2rem;
  overflow: hidden;
  background-color: #fff;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.05);
  transition: transform 0.2s;

  &:hover {
    transform: translateY(-4px);
  }
`;

const ProductImage = styled.img`
  width: 100%;
  height: 16rem;
  object-fit: cover;
`;

const ProductInfo = styled.div`
  padding: 1.2rem;
`;

const ProductTitle = styled.h3`
  font-size: 1.4rem;
  font-weight: 500;
  margin-bottom: 0.6rem;
  color: #222;
`;

const ProductPrice = styled.p`
  font-size: 1.3rem;
  font-weight: 600;
  color: #ff6f0f;
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
              <ProductImage src={imageArray[0]} alt={product.title} />
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
