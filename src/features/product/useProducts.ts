import { useQuery } from "@tanstack/react-query";
import { getProducts } from "../../services/apiProducts";

export function useProducts(
  searchTerm?: string,
  categoryTerm?: string,
  priceRange?: string
) {
  const { isPending, data: products } = useQuery({
    queryKey: ["products", searchTerm, categoryTerm, priceRange],
    queryFn: () => getProducts(searchTerm, categoryTerm, priceRange),
  });

  return {
    isPending,
    products,
  };
}
