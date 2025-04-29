import { useQuery } from "@tanstack/react-query";
import { getAllWishlists } from "../../services/apiWishlist";

export function useAllWishlists() {
  const { isPending: isLoading, data: wishlists } = useQuery({
    queryKey: ["wishlists"],
    queryFn: getAllWishlists,
  });

  return {
    wishlists,
    isLoading,
  };
}
