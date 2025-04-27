import { useQuery } from "@tanstack/react-query";
import { getReceivedRequests } from "../../services/apiRequest";
import { useUser } from "../authentication/useUser";

export function useReceivedRequests() {
  const { user } = useUser();
  const currentUserId = user?.id;

  const { isPending: isLoading, data: receivedRequests } = useQuery({
    queryKey: ["receivedRequest"],
    queryFn: () => getReceivedRequests(currentUserId),
  });

  return {
    isLoading,
    receivedRequests,
  };
}
