import supabase from "../supabase";

interface RequestData {
  productId: string;
}

export async function createRequest({ productId }: RequestData) {
  const { data, error } = await supabase
    .from("purchase_requests")
    .insert([{ product_id: productId }]);

  if (error) {
    console.error("구매 요청 생성 중 오류가 발생했습니다:", error);
    throw error;
  }

  return data;
}

export async function getPendingRequestByProductAndBuyer(
  productId: string,
  buyerId: string
) {
  const { data, error } = await supabase
    .from("purchase_requests")
    .select("*")
    .eq("product_id", productId)
    .eq("buyer_id", buyerId);

  if (error) {
    throw new Error(`요청을 가져오는 데 실패했습니다: ${error.message}`);
  }

  return data;
}
