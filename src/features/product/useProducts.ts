import { useQuery } from "@tanstack/react-query";
import { getProducts } from "../../services/apiProducts";

export function useProducts() {
  const { isPending, data: products } = useQuery({
    queryKey: ["products"],
    queryFn: getProducts,
  });

  return {
    isPending,
    products,
  };
}
