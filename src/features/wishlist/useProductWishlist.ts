import { useQuery } from "@tanstack/react-query";
import { getProductWishlist } from "../../services/apiWishlist";

export function useProductWishlist(productId: string) {
  const { isPending: isLoading, data: wishlists } = useQuery({
    queryKey: ["wishlists", productId],
    queryFn: () => getProductWishlist(productId),
  });

  return {
    wishlists,
    isLoading,
  };
}
