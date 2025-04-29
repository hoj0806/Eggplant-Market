import supabase from "../supabase";

export async function getAllWishlists() {
  const { data, error } = await supabase.from("wishlists").select("*");

  if (error) {
    console.error("찜 목록을 불러오는 중 오류가 발생했습니다:", error);
    throw error;
  }

  return data;
}

export async function getMyWishList(user_id: string, product_id?: string) {
  let query = supabase.from("wishlists").select("*").eq("user_id", user_id);

  if (product_id) {
    query = query.eq("product_id", product_id);
  }

  const { data, error } = await query;

  if (error) {
    console.error("찜 목록을 불러오는 중 오류가 발생했습니다:", error);
    throw error;
  }

  return data;
}
