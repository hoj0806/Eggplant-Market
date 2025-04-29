import { useQuery } from "@tanstack/react-query";
import { useUser } from "../authentication/useUser";
import { getMySalesHistory } from "../../services/apiRequest";

export function useSaleHistory() {
  const { user } = useUser();

  const {
    data: saleHistory,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["saleHistory", user?.id], // user.id를 queryKey에 넣어줌
    queryFn: () => getMySalesHistory(user.id),
  });

  return { saleHistory, isLoading, error };
}
