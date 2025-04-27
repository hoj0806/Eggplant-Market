import supabase, { supabaseUrl } from "../supabase";

export async function createProductPost(newPost) {
  const images = newPost.image;
  const imagePaths: string[] = [];

  for (const image of images) {
    const imageName = `${Date.now()}-${image.name}`.replace(/\//g, "");
    const { error: uploadError } = await supabase.storage
      .from("product-image")
      .upload(imageName, image);

    if (uploadError) {
      throw new Error(`이미지 업로드 실패: ${uploadError.message}`);
    }

    const publicUrl = `${supabaseUrl}/storage/v1/object/public/product-image/${imageName}`;
    imagePaths.push(publicUrl);
  }

  const { data, error } = await supabase
    .from("products")
    .insert([{ ...newPost, image: imagePaths }])
    .select()
    .maybeSingle();

  if (error) {
    throw new Error("게시물 생성에 실패했습니다!");
  }

  return data;
}

// 지역이름도 searchParams 조건으로 넣기
export async function getProducts(
  search?: string,
  category?: string,
  priceRange?: string
) {
  let query = supabase.from("products").select("*");

  if (search) {
    query = query.or(
      `productName.ilike.%${search}%,description.ilike.%${search}%,postTitle.ilike.%${search}%`
    );
  }

  if (category) {
    query = query.eq("category", category);
  }

  if (priceRange) {
    const [minStr, maxStr] = priceRange.split("_");
    const min = parseInt(minStr, 10);
    const max = parseInt(maxStr, 10);
    console.log(min, max);
    if (!isNaN(min)) {
      query = query.gte("price", min);
    }

    if (!isNaN(max)) {
      query = query.lte("price", max);
    }
  }

  const { data, error } = await query;

  if (error) {
    console.error(error);
    throw new Error("상품을 불러오는 데 실패했습니다.");
  }

  return data;
}

export async function getUserProducts(id: string) {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("sellerId", id);

  if (error) {
    throw new Error("상품 정보를 가져오는데 실패했습니다");
  }

  return data;
}
export async function getProduct(id) {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    throw new Error("상품 정보를 가져오는데 실패했습니다");
  }

  return data;
}

export async function deleteProduct(id) {
  const { data, error } = await supabase.from("products").delete().eq("id", id);

  if (error) {
    throw new Error("상품 삭제에 실패했습니다");
  }

  return data;
}
