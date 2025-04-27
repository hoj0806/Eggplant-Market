import { useQuery } from "@tanstack/react-query";
import { getSentRequests } from "../../services/apiRequest";
import { useUser } from "../authentication/useUser";

export function useSentRequests() {
  const { user } = useUser();
  const buyerId = user?.id;

  const { isPending: isLoading, data: sentRequests } = useQuery({
    queryKey: ["sentRequest"],
    queryFn: () => getSentRequests(buyerId),
  });

  return {
    isLoading,
    sentRequests,
  };
}
