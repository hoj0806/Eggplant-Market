import { useQuery } from "@tanstack/react-query";
import { getProducts } from "../../services/apiProducts";

export function useProducts(searchTerm?: string, categoryTerm?: string) {
  const { isPending, data: products } = useQuery({
    queryKey: ["products", searchTerm, categoryTerm], // 검색어가 queryKey에 포함되어야 캐시가 구분됩니다
    queryFn: () => getProducts(searchTerm, categoryTerm),
  });

  return {
    isPending,
    products,
  };
}
