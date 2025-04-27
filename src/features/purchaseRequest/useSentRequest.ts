import { useQuery } from "@tanstack/react-query";
import { getSentRequests } from "../../services/apiRequest";
import { useUser } from "../authentication/useUser";

export function useSentRequests() {
  const { user } = useUser();
  const currentUserId = user?.id;

  const { isPending: isLoading, data: sentRequests } = useQuery({
    queryKey: ["sentRequest"],
    queryFn: () => getSentRequests(currentUserId),
  });

  return {
    isLoading,
    sentRequests,
  };
}
