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

export async function getSentRequests(currentUserId: string) {
  const { data, error } = await supabase
    .from("purchase_requests")
    .select("*")
    .eq("buyer_id", currentUserId);

  if (error) {
    throw new Error(`요청을 가져오는 데 실패했습니다: ${error.message}`);
  }

  return data;
}

export async function getReceivedRequests(currentUserId: string) {
  const { data, error } = await supabase
    .from("purchase_requests")
    .select(
      `
          *,
          product:product_id (
            sellerId
          )
        `
    )
    .eq("product.sellerId", currentUserId);

  if (error) {
    throw new Error(`받은 요청을 가져오는 데 실패했습니다: ${error.message}`);
  }

  return data;
}
export async function deleteRequest({
  product_id,
  buyer_id,
}: {
  product_id: string;
  buyer_id: string;
}) {
  const { data, error } = await supabase
    .from("purchase_requests")
    .delete()
    .eq("buyer_id", buyer_id)
    .eq("product_id", product_id);

  if (error) {
    console.error("요청 삭제 중 오류가 발생했습니다:", error);
    throw error;
  }

  return data; // 삭제된 데이터 반환
}
