import { useQuery } from "@tanstack/react-query";
import { getUserProducts } from "../../services/apiProducts";

export function useUserProducts(id: string) {
  const { isPending, data: userProducts } = useQuery({
    queryKey: ["userProduct", id],
    queryFn: () => getUserProducts(id),
    enabled: !!id,
  });

  return {
    isPending,
    userProducts,
  };
}
