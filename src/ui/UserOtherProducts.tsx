import React from "react";
import { useUserProducts } from "../features/product/useUserProducts";
import styled from "styled-components";
import OtherProduct from "../features/product/OtherProduct";
import { Link } from "react-router-dom";

const MainContainer = styled.div`
  h1 {
    font-size: 3.2rem;
  }

  ol {
    display: flex;
    gap: 2rem;
  }
`;
interface UserOtherProductsProps {
  nickname: string;
  id: string;
}

const UserOtherProducts: React.FC<UserOtherProductsProps> = ({
  nickname,
  id,
}) => {
  const { userProducts, isPending: isPending } = useUserProducts(id);

  if (isPending) return <div>로딩중...</div>;
  console.log(userProducts);
  return (
    <MainContainer>
      <div>
        <h1>{nickname} 의 판매물품</h1>
        <Link to={"/user/asdads"}>더 구경하기</Link>
      </div>

      <ol>
        {userProducts?.slice(0, 5).map((product) => {
          return (
            <OtherProduct
              key={product.id}
              title={product.postTitle}
              price={product.price}
              image={JSON.parse(product.image)[0]}
            />
          );
        })}
      </ol>
    </MainContainer>
  );
};

export default UserOtherProducts;
