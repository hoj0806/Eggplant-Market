import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cancelRequest as cancelRequestApi } from "../../services/apiRequest";

export function useCancelRequest() {
  const queryClient = useQueryClient();

  const { mutate: cancelRequest, isPending: isCanceling } = useMutation({
    mutationFn: cancelRequestApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sentRequest"] });
    },
  });

  return { cancelRequest, isCanceling };
}
