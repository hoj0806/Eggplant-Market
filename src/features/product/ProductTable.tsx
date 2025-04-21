import { useNavigate } from "react-router-dom";
import { useProducts } from "./useProducts";

const ProductGrid = () => {
  const { products, isPending } = useProducts();
  const navigate = useNavigate();

  if (isPending) return <div>게시물을 가져오는 중입니다...</div>;

  return (
    <div>
      {products?.map((product) => {
        return (
          <div
            key={product.id}
            onClick={() => navigate(`/product/${product.id}`)}
          >
            {product.postTitle}
          </div>
        );
      })}
    </div>
  );
};

export default ProductGrid;
