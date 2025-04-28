import { useMutation } from "@tanstack/react-query";
import { acceptRequest as acceptRequestApi } from "../../services/apiRequest";

export function useAcceptRequest() {
  const { mutate: acceptRequest, isPending: isAccepting } = useMutation({
    mutationFn: (data) => acceptRequestApi(data),
  });

  return {
    acceptRequest,
    isAccepting,
  };
}
