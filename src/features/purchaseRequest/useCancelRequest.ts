import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cancelRequest as cancelRequestApi } from "../../services/apiRequest";
import { useParams } from "react-router-dom";
import { useUser } from "../authentication/useUser";

export function useCancelRequest() {
  const queryClient = useQueryClient();
  const params = useParams();
  const { user } = useUser();
  const { mutate: cancelRequest, isPending: isCanceling } = useMutation({
    mutationFn: cancelRequestApi,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["request", params.productId, user?.id],
      });
      queryClient.invalidateQueries({
        queryKey: ["request", params.productId],
      });
    },
  });

  return { cancelRequest, isCanceling };
}
