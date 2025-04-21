import { useMutation } from "@tanstack/react-query";
import { login as loginApi } from "../../services/apiAuth";
export function useLogin() {
  const { mutate: login, isPending } = useMutation({
    mutationFn: loginApi,
  });

  return {
    login,
    isPending,
  };
}
