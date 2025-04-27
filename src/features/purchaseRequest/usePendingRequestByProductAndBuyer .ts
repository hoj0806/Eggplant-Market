import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { getPendingRequestByProductAndBuyer } from "../../services/apiRequest";
import { useUser } from "../authentication/useUser";

export function usePendingRequestByProductAndBuyer() {
  const { productId } = useParams();
  const { user } = useUser();
  const buyerId = user?.id;

  const { isPending: isLoading, data: pendingRequests } = useQuery({
    queryKey: ["pendingPurchaseRequest", productId, buyerId],
    queryFn: () => getPendingRequestByProductAndBuyer(productId, buyerId),
  });

  const isPendingRequestExists = pendingRequests && pendingRequests.length > 0;

  return {
    isLoading,
    pendingRequests,
    isPendingRequestExists,
  };
}
