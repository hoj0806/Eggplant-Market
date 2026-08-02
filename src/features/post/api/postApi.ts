import { supabase } from '../../../shared/lib/supabaseClient';
import type { TradePlace } from '../../place/types';
import type { Region } from '../../region/types';
import type { PostDetail, PostSeller, PostStatus, PostSummary } from '../types';

const POST_IMAGE_BUCKET = 'post-images';

// 한 줄 리터럴이어야 한다. 문자열을 +로 이으면 리터럴 타입을 잃어
// supabase-js가 select 결과를 GenericStringError로 추론한다.
const POST_SUMMARY_COLUMNS =
  'id, title, price, status, thumbnail_url, dong_name, like_count, view_count, bumped_at';
// profiles는 seller_id 말고도 likes·recently_viewed를 통해 posts와 이어져 있어서
// 관계를 FK 이름(posts_seller_id_fkey)으로 짚어 줘야 한다. 안 그러면 PGRST201로 거절당한다.
const POST_DETAIL_COLUMNS =
  'id, title, description, price, status, category_id, dong_name, trade_location_text, trade_location_lat, trade_location_lng, view_count, like_count, created_at, seller:profiles!posts_seller_id_fkey (id, nickname, avatar_url, manner_temp), category:categories (id, name), images:post_images (url, sort_order)';

const DEFAULT_IMAGE_EXTENSION = 'jpg';
const SAFE_EXTENSION_PATTERN = /^[a-zA-Z0-9]{1,5}$/;

export const NEIGHBORHOOD_POSTS_LIMIT = 20;

type PostSummaryRow = {
  id: number;
  title: string;
  price: number;
  status: PostStatus;
  thumbnail_url: string | null;
  dong_name: string | null;
  like_count: number;
  view_count: number;
  bumped_at: string;
};

type PostDetailRow = {
  id: number;
  title: string;
  description: string;
  price: number;
  status: PostStatus;
  category_id: number | null;
  dong_name: string | null;
  trade_location_text: string | null;
  trade_location_lat: number | null;
  trade_location_lng: number | null;
  view_count: number;
  like_count: number;
  created_at: string;
  seller: {
    id: string;
    nickname: string;
    avatar_url: string | null;
    manner_temp: number | string;
  };
  category: { id: number; name: string } | null;
  images: Array<{ url: string; sort_order: number }>;
};

export type CreatePostInput = {
  sellerId: string;
  title: string;
  description: string;
  price: number;
  categoryId: number;
  imageFiles: File[];
  /** 선택 사항. 고르지 않았으면 null. */
  tradePlace: TradePlace | null;
  /** 작성자의 동네. 이 글이 어느 동네 글인지의 기준이다. */
  region: Region;
};

type UploadedImage = {
  path: string;
  url: string;
};

/** POINT의 인자 순서는 (경도, 위도)다. 0003에서 profiles에 쓴 방식과 같다. */
function toPointLiteral(lat: number, lng: number): string {
  return `SRID=4326;POINT(${lng} ${lat})`;
}

function toFileExtension(file: File): string {
  const candidate = file.name.split('.').pop();
  if (candidate !== undefined && SAFE_EXTENSION_PATTERN.test(candidate)) {
    return candidate.toLowerCase();
  }
  return DEFAULT_IMAGE_EXTENSION;
}

function toSeller(row: PostDetailRow['seller']): PostSeller {
  return {
    id: row.id,
    nickname: row.nickname,
    avatarUrl: row.avatar_url,
    // numeric 컬럼은 정밀도 손실을 막으려고 문자열로 오기도 한다.
    mannerTemp: Number(row.manner_temp),
  };
}

/**
 * 거래희망장소는 세 값이 모두 있어야 의미가 있다.
 * 이름만 있고 좌표가 없으면 지도에 찍을 수 없어 없는 것으로 본다.
 */
function toTradePlace(row: PostDetailRow): TradePlace | null {
  if (
    row.trade_location_text === null ||
    row.trade_location_lat === null ||
    row.trade_location_lng === null
  ) {
    return null;
  }

  return {
    // 카카오 장소 id는 저장하지 않는다. 화면 key로만 쓰던 값이라 게시물 id로 대신한다.
    id: String(row.id),
    name: row.trade_location_text,
    addressName: '',
    coords: { lat: row.trade_location_lat, lng: row.trade_location_lng },
  };
}

/** 정렬은 서버에 맡기지 않고 여기서 한다 — 중첩 select의 정렬 옵션은 버전마다 이름이 다르다. */
function toImageUrls(images: PostDetailRow['images']): string[] {
  return [...images]
    .sort(function bySortOrder(left, right): number {
      return left.sort_order - right.sort_order;
    })
    .map(function toUrl(image): string {
      return image.url;
    });
}

function toPostDetail(row: PostDetailRow, isLiked: boolean): PostDetail {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    price: row.price,
    status: row.status,
    categoryId: row.category_id,
    categoryName: row.category?.name ?? null,
    dongName: row.dong_name,
    tradePlace: toTradePlace(row),
    images: toImageUrls(row.images),
    viewCount: row.view_count,
    likeCount: row.like_count,
    isLiked,
    createdAt: row.created_at,
    seller: toSeller(row.seller),
  };
}

function toPostSummary(row: PostSummaryRow): PostSummary {
  return {
    id: row.id,
    title: row.title,
    price: row.price,
    status: row.status,
    thumbnailUrl: row.thumbnail_url,
    dongName: row.dong_name,
    likeCount: row.like_count,
    viewCount: row.view_count,
    bumpedAt: row.bumped_at,
  };
}

/**
 * 사진을 스토리지에 올리고 경로·공개 URL을 돌려준다.
 * 경로 첫 칸은 반드시 사용자 id — storage RLS가 본인 폴더만 쓰도록 막고 있다.
 *
 * 순서대로 올린다. 병렬로 올리면 실패했을 때 어디까지 올라갔는지 추적하기 번거롭고,
 * 사진 열 장 남짓이라 체감 차이도 크지 않다.
 */
async function uploadPostImages(sellerId: string, files: File[]): Promise<UploadedImage[]> {
  const uploaded: UploadedImage[] = [];
  const stamp = Date.now();

  for (const [index, file] of files.entries()) {
    const path = `${sellerId}/${stamp}-${index}.${toFileExtension(file)}`;

    const { error } = await supabase.storage
      .from(POST_IMAGE_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: true });

    if (error !== null) {
      await removeUploadedImages(uploaded);
      throw error;
    }

    const { data } = supabase.storage.from(POST_IMAGE_BUCKET).getPublicUrl(path);
    uploaded.push({ path, url: data.publicUrl });
  }

  return uploaded;
}

/** 뒷정리다. 여기서 또 실패해도 원래 오류를 덮지 않도록 조용히 넘어간다. */
async function removeUploadedImages(uploaded: UploadedImage[]): Promise<void> {
  if (uploaded.length === 0) {
    return;
  }

  const paths = uploaded.map(function toPath(image): string {
    return image.path;
  });

  await supabase.storage.from(POST_IMAGE_BUCKET).remove(paths);
}

/** 게시물 본문 한 행. 목록·검색의 기준이 되는 동네 정보를 여기서 함께 박아 넣는다. */
async function insertPostRow(input: CreatePostInput, thumbnailUrl: string): Promise<number> {
  const { data, error } = await supabase
    .from('posts')
    .insert({
      seller_id: input.sellerId,
      title: input.title,
      description: input.description,
      price: input.price,
      category_id: input.categoryId,
      thumbnail_url: thumbnailUrl,
      region_code: input.region.code,
      dong_name: input.region.fullName,
      location: toPointLiteral(input.region.coords.lat, input.region.coords.lng),
      ...(input.tradePlace === null
        ? {}
        : {
            trade_location_text: input.tradePlace.name,
            trade_location: toPointLiteral(
              input.tradePlace.coords.lat,
              input.tradePlace.coords.lng,
            ),
          }),
    })
    .select('id')
    .single();

  if (error !== null) {
    throw error;
  }

  return (data as { id: number }).id;
}

async function insertPostImages(postId: number, uploaded: UploadedImage[]): Promise<void> {
  const rows = uploaded.map(function toRow(image, index) {
    return { post_id: postId, url: image.url, sort_order: index };
  });

  const { error } = await supabase.from('post_images').insert(rows);

  if (error !== null) {
    throw error;
  }
}

/**
 * 게시물 등록. 사진 업로드 → 본문 → 사진 행 순서로 세 번 쓴다.
 *
 * Postgres 트랜잭션으로 묶을 수 없는 구간(스토리지)이 있어 중간에 실패하면 직접 되돌린다.
 * 되돌리지 않으면 아무도 못 보는 사진 파일이나, 사진 없는 게시물이 남는다.
 * 첫 장이 목록 썸네일이다.
 */
export async function createPost(input: CreatePostInput): Promise<number> {
  const uploaded = await uploadPostImages(input.sellerId, input.imageFiles);

  let postId: number;
  try {
    postId = await insertPostRow(input, uploaded[0].url);
  } catch (error) {
    await removeUploadedImages(uploaded);
    throw error;
  }

  try {
    await insertPostImages(postId, uploaded);
  } catch (error) {
    await supabase.from('posts').delete().eq('id', postId);
    await removeUploadedImages(uploaded);
    throw error;
  }

  return postId;
}

/** 로그인한 사용자가 이 글을 찜했는지. 비로그인은 요청하지 않는다. */
async function fetchIsLiked(postId: number, viewerId: string | null): Promise<boolean> {
  if (viewerId === null) {
    return false;
  }

  const { data, error } = await supabase
    .from('likes')
    .select('post_id')
    .eq('post_id', postId)
    .eq('user_id', viewerId)
    .maybeSingle();

  if (error !== null) {
    throw error;
  }

  return data !== null;
}

export async function fetchPostDetail(
  postId: number,
  viewerId: string | null,
): Promise<PostDetail> {
  const { data, error } = await supabase
    .from('posts')
    .select(POST_DETAIL_COLUMNS)
    .eq('id', postId)
    .single();

  if (error !== null) {
    throw error;
  }

  const isLiked = await fetchIsLiked(postId, viewerId);

  return toPostDetail(data as unknown as PostDetailRow, isLiked);
}

/**
 * 내 동네 최신 글 목록.
 *
 * 기준은 법정동 코드가 같은지다. 반경(profiles.search_radius_m)과 nearby_posts RPC를 쓰는
 * 거리 기반 검색은 필터·무한스크롤과 함께 붙인다.
 */
export async function fetchNeighborhoodPosts(regionCode: string): Promise<PostSummary[]> {
  const { data, error } = await supabase
    .from('posts')
    .select(POST_SUMMARY_COLUMNS)
    .eq('region_code', regionCode)
    .order('bumped_at', { ascending: false })
    .limit(NEIGHBORHOOD_POSTS_LIMIT);

  if (error !== null) {
    throw error;
  }

  return (data as PostSummaryRow[]).map(toPostSummary);
}

/**
 * 조회수 +1.
 * 본인 글 제외는 RPC 안에서 막는다(0005 참고). 여기서는 호출만 한다.
 */
export async function incrementViewCount(postId: number): Promise<void> {
  const { error } = await supabase.rpc('increment_view_count', { p_post_id: postId });

  if (error !== null) {
    throw error;
  }
}
