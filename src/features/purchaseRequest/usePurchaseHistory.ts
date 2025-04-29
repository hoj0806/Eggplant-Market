import { useQuery } from "@tanstack/react-query";
import { useUser } from "../authentication/useUser";
import { getMyPurchaseHistory } from "../../services/apiRequest";

export function usePurchaseHistory() {
  const { user } = useUser();

  const {
    data: purchaseHistory,
    error,
    isLoading,
  } = useQuery({
    queryKey: ["purchaseHistory", user?.id],
    queryFn: () => getMyPurchaseHistory(user!.id),
  });

  return { purchaseHistory, error, isLoading };
}
