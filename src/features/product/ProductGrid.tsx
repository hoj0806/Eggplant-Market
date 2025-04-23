import { useNavigate, useSearchParams } from "react-router-dom";
import { useProducts } from "./useProducts";

const ProductGrid = () => {
  const [searchParams] = useSearchParams();
  const searchTerm = searchParams.get("search") || "";

  const navigate = useNavigate();
  const { products, isPending } = useProducts(searchTerm);

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
