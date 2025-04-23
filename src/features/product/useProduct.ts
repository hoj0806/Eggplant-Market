import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { getProduct } from "../../services/apiProducts";

export function useProduct() {
  const { productId } = useParams();

  const { isLoading, data: product } = useQuery({
    queryKey: ["product", productId],
    queryFn: () => getProduct(productId),
  });

  return {
    isLoading,
    product,
  };
}
