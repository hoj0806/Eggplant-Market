/**
 * 네 계정이 **서로 얽힌** 데이터를 심는다.
 *
 * `npm run seed:story`            심는다 (온보딩을 마친 계정 넷을 자동으로 고른다)
 * `npm run seed:story -- <uuid> <uuid> <uuid> <uuid>`   순서를 직접 정한다
 * `npm run seed:story -- --clean` 심은 것만 치운다
 *
 * `seedDemo.mjs`와 무엇이 다른가
 * -----------------------------
 * 그쪽은 **로그인하는 계정이 하나뿐**일 때를 위한 도구다. 이웃을 가짜로 만들어
 * 그 주변에 사건을 심는다 — 가짜 계정으로는 화면에 들어갈 수 없으니 **한쪽에서 본 모습**만
 * 확인할 수 있다.
 *
 * 여기서는 **로그인할 수 있는 계정이 넷**이다. 그래서 판매자와 구매자 양쪽에서 같은 사건을
 * 열어 볼 수 있게 짰다 — 비밀 댓글은 **볼 수 있는 사람과 없는 사람**이 나뉘고, 채팅은
 * 양쪽 화면이 다르고, 후기는 준 사람과 받은 사람이 갈린다.
 *
 * 사진은 진짜를 받아 온다
 * ---------------------
 * 물건 사진이 색 사각형이면 목록·상세·격자가 실제로 어떻게 보이는지 알 수 없다.
 * loremflickr(Flickr의 CC 사진)에서 물건 이름으로 받아 스토리지에 올린다.
 * 사람 사진(프로필)은 pravatar에서 받는다. 받는 주소는 `lock`으로 고정해 **다시 심어도
 * 같은 사진**이 오게 했다 — 화면을 다시 볼 때 물건이 바뀌면 헷갈린다.
 *
 * 치우는 방법이 seedDemo와 다르다
 * -----------------------------
 * 그쪽은 제목에 `[데모]` 표를 붙여 찾는다. 여기서는 **제목이 진짜 같아야** 해서 표를 못 쓴다.
 * 대신 심은 id와 파일 경로를 `.seedStory.json`에 적어 두고 그것만 지운다.
 * 사람이 화면에서 만든 것은 목록에 없으니 건드리지 않는다.
 *
 * 알림은 심지 않는다 — 댓글·찜·메시지·후기를 심으면 트리거가 알아서 쌓는다(seedDemo와 같다).
 */

import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const MANIFEST_PATH = new URL('./.seedStory.json', import.meta.url);

const SERVICE_ROLE_ENV = 'SUPABASE_SERVICE_ROLE_KEY';
const URL_ENV = 'VITE_SUPABASE_URL';

const POST_IMAGE_BUCKET = 'post-images';
const CHAT_IMAGE_BUCKET = 'chat-images';
const AVATAR_BUCKET = 'avatars';

const MINUTE = 60 * 1000;

// ---------------------------------------------------------------------------
// 환경과 도구
// ---------------------------------------------------------------------------

function loadEnvLocal() {
  let raw = '';

  try {
    raw = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
  } catch {
    return;
  }

  for (const line of raw.split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);

    if (match !== null && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  }
}

function requireEnv(name) {
  const value = process.env[name];

  if (value === undefined || value === '') {
    console.error(`${name}가 필요하다. .env.local에 있어야 한다.`);
    process.exit(1);
  }

  return value;
}

function fail(message, error) {
  console.error(`\n실패: ${message}`);
  console.error(error);
  process.exit(1);
}

async function insertOne(admin, table, row, label) {
  const { data, error } = await admin.from(table).insert(row).select('id').single();

  if (error !== null) {
    fail(`${label} (${table})`, error);
  }

  return data.id;
}

async function insertMany(admin, table, rows, label) {
  if (rows.length === 0) {
    return;
  }

  const { error } = await admin.from(table).insert(rows);

  if (error !== null) {
    fail(`${label} (${table})`, error);
  }
}

function minutesAgo(minutes) {
  return new Date(Date.now() - minutes * MINUTE).toISOString();
}

function toPointLiteral(lat, lng) {
  return `SRID=4326;POINT(${lng} ${lat})`;
}

// ---------------------------------------------------------------------------
// 사진 — 받아서 올린다
//
// 실패하면 그 자리에서 세운다. 사진 없는 글이 섞이면 "이 글만 왜 회색이지"가 되는데,
// 그건 화면 버그와 구별되지 않는다.
// ---------------------------------------------------------------------------

async function download(url, label) {
  let response;

  try {
    response = await fetch(url, { redirect: 'follow' });
  } catch (error) {
    fail(`사진 받기 (${label})`, error);
  }

  if (!response.ok) {
    fail(`사진 받기 (${label})`, new Error(`${response.status} ${response.statusText}`));
  }

  return Buffer.from(await response.arrayBuffer());
}

/** 물건 사진. 이름과 자물쇠 번호를 주면 언제 돌려도 같은 사진이 온다. */
async function fetchProductPhoto(keyword, lock) {
  return download(
    `https://loremflickr.com/800/600/${encodeURIComponent(keyword)}?lock=${lock}`,
    `${keyword}#${lock}`,
  );
}

/** 사람 사진(프로필). */
async function fetchAvatarPhoto(index) {
  return download(`https://i.pravatar.cc/300?img=${index}`, `avatar#${index}`);
}

async function upload(admin, bucket, path, body, label) {
  const { error } = await admin.storage
    .from(bucket)
    .upload(path, body, { contentType: 'image/jpeg', upsert: true });

  if (error !== null) {
    fail(`${label} (${bucket}/${path})`, error);
  }

  return path;
}

function publicUrl(admin, bucket, path) {
  return admin.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

// ---------------------------------------------------------------------------
// 심을 이야기
//
// 사람은 A·B·C·D 네 자리로 적는다. 실제 계정은 실행할 때 붙인다 —
// 이야기가 특정 uuid에 매이면 계정을 다시 만들 때마다 이 파일을 고쳐야 한다.
// ---------------------------------------------------------------------------

const POSTS = [
  {
    key: 'ipad',
    owner: 'A',
    title: '아이패드 9세대 64GB 셀룰러',
    price: 240000,
    categoryId: 14,
    photos: [['ipad', 11], ['tablet', 12]],
    minutes: 35,
    views: 41,
    place: '석관동 우체국 앞',
    description:
      '작년에 인강용으로 샀는데 요즘 손이 잘 안 가서 정리합니다.\n액정 기스 없고 정품 케이스랑 충전기 같이 드려요. 배터리 성능 90% 넘습니다.\n직거래 선호하고 시간은 맞춰 드릴게요.',
  },
  {
    key: 'fridge',
    owner: 'A',
    title: '자취방 미니 냉장고 (85L)',
    price: 45000,
    categoryId: 19,
    photos: [['refrigerator', 21]],
    minutes: 260,
    views: 18,
    place: null,
    description:
      '이사하면서 큰 걸로 바꿔서 내놓습니다. 냉동칸 따로 있고 소음 거의 없어요.\n안쪽 청소 다 해뒀습니다. 무거워서 차 가져오셔야 해요.',
  },
  {
    key: 'microwave',
    owner: 'A',
    title: '전자레인지 20L (직거래만)',
    price: 25000,
    categoryId: 20,
    photos: [['microwave', 31]],
    minutes: 900,
    views: 27,
    place: '석관동 두산아파트 정문',
    description: '2년 정도 썼고 잘 돌아갑니다. 안쪽 냄새 없어요.\n무거워서 직거래만 가능합니다.',
  },
  {
    key: 'coffee',
    owner: 'A',
    title: '드립 커피 세트 나눔합니다',
    price: 0,
    categoryId: 20,
    photos: [['coffee-maker', 41]],
    minutes: 3000,
    views: 63,
    place: null,
    description:
      '드리퍼, 서버, 저울까지 한 세트입니다. 캡슐로 넘어가면서 안 쓰게 됐어요.\n필요하신 분 편하게 가져가세요. 커피는 계속 마셔야 하니까요.',
  },
  {
    key: 'bike',
    owner: 'B',
    title: '로드 자전거 (알루미늄 프레임)',
    price: 180000,
    categoryId: 53,
    photos: [['bicycle', 51], ['road-bike', 52]],
    minutes: 150,
    views: 88,
    place: '장위동 근린공원 입구',
    description:
      '작년 봄에 입문용으로 산 자전거입니다. 총 200km 정도 탔어요.\n체인 청소 최근에 했고 브레이크 패드도 갈았습니다. 헬멧이랑 자물쇠 같이 드려요.\n키 165~175 정도면 잘 맞습니다.',
  },
  {
    key: 'keyboard',
    owner: 'B',
    title: '기계식 키보드 청축 87키',
    price: 68000,
    categoryId: 15,
    photos: [['mechanical-keyboard', 61], ['keyboard', 62]],
    minutes: 400,
    views: 52,
    place: null,
    description:
      '집에서만 쓰던 키보드입니다. 키캡 따로 사서 바꿔 끼웠고 원래 키캡도 같이 드려요.\n청축이라 소리가 큽니다. 사무실에서 쓰실 거면 비추천이에요.',
  },
  {
    key: 'desk',
    owner: 'B',
    title: '접이식 원목 책상 120cm',
    price: 30000,
    categoryId: 24,
    photos: [['wooden-desk', 71]],
    minutes: 5000,
    views: 34,
    place: null,
    description: '상판 튼튼하고 흔들림 없습니다. 접으면 얇아져서 세워둘 수 있어요.\n작은 생활기스는 있습니다.',
  },
  {
    key: 'switch',
    owner: 'C',
    title: '닌텐도 스위치 OLED 화이트',
    price: 290000,
    categoryId: 17,
    photos: [['nintendo-switch', 81], ['game-console', 82]],
    minutes: 120,
    views: 132,
    place: '이문동 초록마을 앞',
    description:
      '작년 겨울에 사서 젤다만 하고 거의 안 했습니다.\n독, 조이콘, 충전기 다 있고 액정 필름 붙여둔 상태예요. 박스 있습니다.\n네고는 정중히 사양할게요.',
  },
  {
    key: 'earbuds',
    owner: 'C',
    title: '무선 이어폰 (거의 새것)',
    price: 55000,
    categoryId: 18,
    photos: [['earbuds', 91]],
    minutes: 700,
    views: 46,
    place: null,
    description: '선물 받았는데 이미 쓰던 게 있어서 정리합니다.\n두세 번 껴봤고 이어팁 전부 미개봉이에요.',
  },
  {
    key: 'chair',
    owner: 'C',
    title: '캠핑 의자 두 개 세트',
    price: 20000,
    categoryId: 54,
    photos: [['camping-chair', 101]],
    minutes: 1800,
    views: 25,
    place: null,
    description: '캠핑 두 번 다녀오고 창고에 있었습니다. 수납 가방 있어요.\n두 개 묶어서 드립니다.',
  },
  {
    key: 'lamp',
    owner: 'D',
    title: '거실 스탠드 조명 (전구색)',
    price: 18000,
    categoryId: 26,
    photos: [['floor-lamp', 111]],
    minutes: 90,
    views: 37,
    place: '중화동 먹자골목 입구',
    description: '방 분위기용으로 쓰던 조명입니다. 밝기 3단계 조절돼요.\n전구 포함이고 흠집 없습니다.',
  },
  {
    key: 'candle',
    owner: 'D',
    title: '캔들 워머 새것 (박스 있음)',
    price: 22000,
    categoryId: 28,
    photos: [['candle', 121]],
    minutes: 1400,
    views: 29,
    place: null,
    description: '생일선물로 받았는데 향초를 잘 안 켜서요.\n한 번도 안 썼고 박스 그대로입니다.',
  },
  {
    key: 'toy',
    owner: 'D',
    title: '유아 원목 장난감 정리해요',
    price: 12000,
    categoryId: 38,
    photos: [['wooden-toy', 131]],
    minutes: 2600,
    views: 21,
    place: null,
    description: '아이가 커서 이제 안 갖고 놀아요. 소독해뒀습니다.\n부품 빠진 것 없고 원목이라 튼튼해요.',
  },
];

/**
 * 댓글 실타래.
 *
 * 비밀 댓글은 **판매자와 실타래를 연 사람**만 본다(0033). 그래서 세 사람이 걸린 글
 * 하나에 공개 실타래와 비밀 실타래를 함께 두었다 — 같은 글을 A로 보면 다 보이고
 * B로 보면 공개만 보인다. **네 계정이 있어야 확인되는 자리**다.
 */
const COMMENTS = [
  {
    post: 'ipad',
    author: 'B',
    minutes: 30,
    content: '혹시 직거래는 어디서 가능할까요?',
    replies: [{ author: 'A', minutes: 28, content: '석관동 우체국 앞에서 주로 뵙고 있어요. 시간은 맞춰드릴게요!' }],
  },
  {
    post: 'ipad',
    author: 'C',
    minutes: 22,
    content: '충전기도 같이 주시는 건가요?',
    replies: [{ author: 'A', minutes: 20, content: '네 정품 충전기랑 케이스까지 같이 드립니다.' }],
  },
  {
    post: 'ipad',
    author: 'D',
    minutes: 15,
    secret: true,
    content: '조심스럽게 여쭤보는데 22만원까지 조정 가능하실까요?',
    replies: [{ author: 'A', minutes: 12, secret: true, content: '음... 23만원까지는 생각해볼게요. 채팅 주세요!' }],
  },
  {
    post: 'switch',
    author: 'A',
    minutes: 110,
    content: '박스도 있다고 하셨는데 구성품 다 있는 거죠?',
    replies: [{ author: 'C', minutes: 108, content: '네 독이랑 조이콘 그립까지 처음 그대로 있습니다.' }],
  },
  {
    post: 'bike',
    author: 'D',
    minutes: 140,
    content: '키 168인데 탈 만할까요?',
    replies: [{ author: 'B', minutes: 138, content: '딱 맞으실 거예요. 안장 높이도 조절됩니다.' }],
  },
  {
    post: 'bike',
    author: 'A',
    minutes: 100,
    secret: true,
    content: '혹시 프레임에 사고 이력 있나요? 비밀로 여쭤봅니다.',
    replies: [{ author: 'B', minutes: 95, secret: true, content: '넘어진 적 없고 도색도 원래 그대로입니다. 확인하고 사셔도 돼요.' }],
  },
  {
    post: 'keyboard',
    author: 'D',
    minutes: 380,
    content: '소리 어느 정도인가요? 영상 있으면 좋겠어요.',
    replies: [],
  },
  {
    post: 'coffee',
    author: 'C',
    minutes: 2900,
    content: '나눔 감사합니다! 혹시 아직 남아있을까요?',
    replies: [{ author: 'A', minutes: 2880, content: '네 아직 있어요. 편한 시간 말씀해주세요.' }],
  },
];

/** 찜. `like_count`가 오르고 받는 사람에게 알림이 간다(0018). */
const LIKES = [
  { post: 'ipad', users: ['B', 'C', 'D'] },
  { post: 'switch', users: ['A', 'D'] },
  { post: 'bike', users: ['A', 'C'] },
  { post: 'keyboard', users: ['A'] },
  { post: 'lamp', users: ['B', 'C'] },
  { post: 'coffee', users: ['C', 'D'] },
  { post: 'earbuds', users: ['A'] },
];

/** 최근 본 글. `/my/recent`가 비어 있지 않게. */
const RECENT = {
  A: ['switch', 'earbuds', 'bike', 'lamp'],
  B: ['ipad', 'lamp', 'coffee'],
  C: ['ipad', 'keyboard', 'coffee', 'desk'],
  D: ['ipad', 'bike', 'keyboard'],
};

/**
 * 채팅.
 *
 * 다섯 방이 저마다 다른 상태를 맡는다 — 수락된 제안 · 답변을 기다리는 제안 · 물린 제안 ·
 * 지운 메시지 · 사진이 오간 방. 한 방에 다 넣으면 화면은 한 가지 모습만 보여준다.
 */
const CHATS = [
  {
    post: 'switch',
    buyer: 'A',
    messages: [
      { from: 'A', minutes: 118, text: '안녕하세요! 스위치 아직 판매하시나요?' },
      { from: 'C', minutes: 117, text: '네 아직 있습니다 :)' },
      { from: 'A', minutes: 116, text: '실물 사진 한 장만 더 볼 수 있을까요?' },
      { from: 'C', minutes: 114, photo: ['nintendo-switch', 83] },
      { from: 'C', minutes: 113, text: '이렇게 보관하고 있었어요. 상태 괜찮죠?' },
      { from: 'A', minutes: 110, text: '깔끔하네요! 혹시 28만원에 가능할까요?' },
      { from: 'A', minutes: 109, offer: 280000, status: 'accepted' },
      { from: 'C', minutes: 105, text: '좋아요 그렇게 하시죠. 오늘 저녁 7시 이문동 초록마을 앞 어떠세요?' },
      { from: 'A', minutes: 103, text: '네 그때 뵐게요!' },
      { from: 'A', minutes: 60, photo: ['game-console', 84] },
      { from: 'A', minutes: 59, text: '잘 받았습니다. 바로 켜봤어요 ㅎㅎ' },
    ],
    trade: {
      soldMinutes: 58,
      reviews: [
        {
          from: 'A',
          score: 0.5,
          tags: ['시간 약속을 잘 지켜요', '친절하고 매너가 좋아요'],
          comment: '약속 시간보다 먼저 나와 계셨어요. 물건 상태도 설명 그대로였습니다.',
          minutes: 50,
        },
        {
          from: 'C',
          score: 0.5,
          tags: ['응답이 빨라요', '친절하고 매너가 좋아요'],
          comment: '연락 잘 되시고 깔끔하게 거래했습니다. 감사합니다!',
          minutes: 45,
        },
      ],
    },
  },
  {
    post: 'bike',
    buyer: 'C',
    messages: [
      { from: 'C', minutes: 95, text: '자전거 아직 있나요? 사진 더 있으면 좋겠어요.' },
      { from: 'B', minutes: 93, photo: ['bicycle', 53] },
      { from: 'B', minutes: 92, text: '오늘 아침에 찍은 사진이에요.' },
      { from: 'C', minutes: 90, text: '상태 좋아 보이네요. 16만 5천원 어떠세요?' },
      { from: 'C', minutes: 89, offer: 165000, status: 'pending' },
    ],
  },
  {
    post: 'microwave',
    buyer: 'D',
    reservePost: true,
    messages: [
      { from: 'D', minutes: 300, text: '전자레인지 보고 연락드려요. 이번 주말에 가지러 갈 수 있을까요?' },
      { from: 'A', minutes: 295, text: '네 주말 좋습니다. 예약해둘게요!' },
      { from: 'D', minutes: 290, offer: 20000, status: 'cancelled' },
      { from: 'D', minutes: 288, text: '아 죄송해요, 가격은 그대로 드릴게요. 방금 건 취소했습니다.' },
    ],
  },
  {
    post: 'lamp',
    buyer: 'B',
    messages: [
      { from: 'B', minutes: 80, text: '조명 색온도가 어느 정도인가요?' },
      { from: 'B', minutes: 79, text: '(이 줄은 보낸 사람이 지웠습니다)', deleted: true },
      { from: 'D', minutes: 75, text: '전구색이라 따뜻한 편이에요. 밝기는 3단계로 조절됩니다.' },
      { from: 'B', minutes: 70, text: '감사합니다! 조금 더 생각해볼게요.' },
    ],
  },
  {
    post: 'desk',
    buyer: 'D',
    messages: [
      { from: 'D', minutes: 4000, text: '책상 아직 있을까요?' },
      { from: 'B', minutes: 3990, text: '네 있습니다. 장위동 근처시면 오늘도 괜찮아요.' },
      { from: 'D', minutes: 3900, text: '방금 잘 받았습니다. 감사합니다!' },
    ],
    trade: {
      soldMinutes: 3880,
      reviews: [
        {
          from: 'D',
          score: 0.1,
          tags: ['응답이 빨라요'],
          comment: '답장이 빨라서 편하게 거래했습니다.',
          minutes: 3800,
        },
      ],
    },
  },
];

const AVATAR_IMAGES = { A: 12, B: 33, C: 47, D: 5 };

// ---------------------------------------------------------------------------
// 심기
// ---------------------------------------------------------------------------

async function resolvePeople(admin, uuids) {
  const columns =
    'id, nickname, region_code, dong_name, region_depth1, region_depth2, region_depth3, location_lat, location_lng, onboarded_at';

  const query = admin.from('profiles').select(columns);
  const { data, error } = uuids.length > 0 ? await query.in('id', uuids) : await query.not('onboarded_at', 'is', null);

  if (error !== null) {
    fail('계정을 읽는 중', error);
  }

  if (data.length !== 4) {
    console.error(`계정이 넷이어야 한다. 지금 ${data.length}개다.`);
    for (const profile of data) {
      console.error(`  ${profile.id}  ${profile.nickname}`);
    }
    process.exit(1);
  }

  const ordered =
    uuids.length > 0
      ? uuids.map(function pick(id) {
          return data.find(function match(profile) {
            return profile.id === id;
          });
        })
      : data.slice().sort(function byOnboarded(left, right) {
          return left.onboarded_at < right.onboarded_at ? -1 : 1;
        });

  const people = {};

  for (const [index, key] of ['A', 'B', 'C', 'D'].entries()) {
    const profile = ordered[index];

    if (profile === undefined || profile.region_code === null) {
      console.error('넷 다 온보딩(동네 설정)을 마친 계정이어야 한다.');
      process.exit(1);
    }

    people[key] = profile;
  }

  return people;
}

/**
 * 프로필 사진.
 *
 * **사람이 이미 올린 사진은 건드리지 않는다.** 처음 판이 무조건 덮어썼는데, 그러면 그 사람이
 * 올린 파일이 **아무도 안 가리키는 파일**로 남는다(실제로 두 장을 그렇게 만들었다).
 * 지우면 사람이 만든 것을 지우는 셈이고, 두면 쓰레기다 — 아예 안 덮는 것이 답이다.
 */
async function seedAvatars(admin, people, manifest) {
  let planted = 0;

  for (const key of Object.keys(people)) {
    const person = people[key];

    const { data: current, error: readError } = await admin
      .from('profiles')
      .select('avatar_url')
      .eq('id', person.id)
      .single();

    if (readError !== null) {
      fail(`프로필 사진 확인 (${person.nickname})`, readError);
    }

    if (current.avatar_url !== null) {
      console.log(`  ${person.nickname}는 이미 사진이 있어 그대로 둔다`);
      continue;
    }

    const photo = await fetchAvatarPhoto(AVATAR_IMAGES[key]);
    const path = await upload(
      admin,
      AVATAR_BUCKET,
      `${person.id}/seed-avatar.jpg`,
      photo,
      '프로필 사진 올리기',
    );

    manifest.storage[AVATAR_BUCKET].push(path);

    const { error } = await admin
      .from('profiles')
      .update({ avatar_url: publicUrl(admin, AVATAR_BUCKET, path) })
      .eq('id', person.id);

    if (error !== null) {
      fail(`프로필 사진 붙이기 (${person.nickname})`, error);
    }

    planted += 1;
  }

  console.log(`프로필 사진 ${planted}장 (원래 있던 것은 그대로)`);
}

async function seedPosts(admin, people, manifest) {
  const byKey = {};

  for (const post of POSTS) {
    const owner = people[post.owner];
    const urls = [];

    for (const [index, [keyword, lock]] of post.photos.entries()) {
      const photo = await fetchProductPhoto(keyword, lock);
      const path = await upload(
        admin,
        POST_IMAGE_BUCKET,
        `${owner.id}/${Date.now()}-${lock}-${index}.jpg`,
        photo,
        '물건 사진 올리기',
      );

      manifest.storage[POST_IMAGE_BUCKET].push(path);
      urls.push(publicUrl(admin, POST_IMAGE_BUCKET, path));
    }

    const id = await insertOne(
      admin,
      'posts',
      {
        seller_id: owner.id,
        title: post.title,
        description: post.description,
        price: post.price,
        category_id: post.categoryId,
        thumbnail_url: urls[0],
        view_count: post.views,
        created_at: minutesAgo(post.minutes),
        updated_at: minutesAgo(post.minutes),
        bumped_at: minutesAgo(post.minutes),
        region_code: owner.region_code,
        dong_name: owner.dong_name,
        location: toPointLiteral(owner.location_lat, owner.location_lng),
        ...(post.place === null ? {} : { trade_location_text: post.place }),
      },
      `글 심기 (${post.title})`,
    );

    manifest.postIds.push(id);
    byKey[post.key] = { id, ownerKey: post.owner, ownerId: owner.id };

    await insertMany(
      admin,
      'post_images',
      urls.map(function toRow(url, index) {
        return { post_id: id, url, sort_order: index };
      }),
      '사진 행 심기',
    );
  }

  const photoCount = POSTS.reduce(function add(sum, post) {
    return sum + post.photos.length;
  }, 0);

  console.log(`글 ${POSTS.length}개 · 물건 사진 ${photoCount}장`);

  return byKey;
}

async function seedLikesAndViews(admin, people, posts) {
  const likes = [];

  for (const like of LIKES) {
    for (const who of like.users) {
      likes.push({ post_id: posts[like.post].id, user_id: people[who].id });
    }
  }

  await insertMany(admin, 'likes', likes, '찜 심기');

  const views = [];

  for (const who of Object.keys(RECENT)) {
    for (const [index, key] of RECENT[who].entries()) {
      views.push({
        user_id: people[who].id,
        post_id: posts[key].id,
        viewed_at: minutesAgo((index + 1) * 17),
      });
    }
  }

  await insertMany(admin, 'recently_viewed', views, '최근 본 글 심기');

  console.log(`찜 ${likes.length}개 · 최근 본 글 ${views.length}개`);
}

async function seedComments(admin, people, posts) {
  let count = 0;

  for (const thread of COMMENTS) {
    const parentId = await insertOne(
      admin,
      'comments',
      {
        post_id: posts[thread.post].id,
        author_id: people[thread.author].id,
        content: thread.content,
        is_secret: thread.secret === true,
        created_at: minutesAgo(thread.minutes),
        updated_at: minutesAgo(thread.minutes),
      },
      '댓글 심기',
    );
    count += 1;

    for (const reply of thread.replies) {
      await insertOne(
        admin,
        'comments',
        {
          post_id: posts[thread.post].id,
          author_id: people[reply.author].id,
          parent_id: parentId,
          content: reply.content,
          is_secret: reply.secret === true,
          created_at: minutesAgo(reply.minutes),
          updated_at: minutesAgo(reply.minutes),
        },
        '대댓글 심기',
      );
      count += 1;
    }
  }

  const secretCount = COMMENTS.filter(function isSecret(thread) {
    return thread.secret === true;
  }).length;

  console.log(`댓글 ${count}개 (비밀 실타래 ${secretCount}개 포함)`);
}

/**
 * 채팅.
 *
 * 순서가 규칙이다 — **방이 먼저** 있어야 거래완료의 `buyer_id`를 박을 수 있다
 * (`guard_post_buyer`, 0035). "거래 상대는 채팅한 사람 중에서만"을 트리거가 지킨다.
 */
async function seedChats(admin, people, posts, manifest) {
  let messageCount = 0;
  let chatPhotoCount = 0;
  let reviewCount = 0;

  for (const chat of CHATS) {
    const post = posts[chat.post];
    const buyer = people[chat.buyer];

    const roomId = await insertOne(
      admin,
      'chat_rooms',
      {
        post_id: post.id,
        buyer_id: buyer.id,
        seller_id: post.ownerId,
        created_at: minutesAgo(chat.messages[0].minutes + 2),
      },
      '채팅방 만들기',
    );

    for (const message of chat.messages) {
      const sender = people[message.from];
      const row = {
        room_id: roomId,
        sender_id: sender.id,
        created_at: minutesAgo(message.minutes),
      };

      if (message.photo !== undefined) {
        const [keyword, lock] = message.photo;
        const photo = await fetchProductPhoto(keyword, lock);
        const path = await upload(
          admin,
          CHAT_IMAGE_BUCKET,
          `${roomId}/${sender.id}/${Date.now()}-0.jpg`,
          photo,
          '채팅 사진 올리기',
        );

        manifest.storage[CHAT_IMAGE_BUCKET].push(path);
        chatPhotoCount += 1;

        Object.assign(row, { type: 'image', content: path });
      } else if (message.offer !== undefined) {
        Object.assign(row, {
          type: 'price_offer',
          offer_amount: message.offer,
          offer_status: message.status,
        });
      } else {
        Object.assign(row, { type: 'text', content: message.text });

        if (message.deleted === true) {
          // 소프트 삭제(0029). 행은 남고 내용만 사라진다 — 화면에는 "삭제된 메시지"로 뜬다.
          Object.assign(row, { content: null, deleted_at: minutesAgo(message.minutes - 1) });
        }
      }

      await insertOne(admin, 'messages', row, '메시지 심기');
      messageCount += 1;
    }

    if (chat.reservePost === true) {
      const { error } = await admin.from('posts').update({ status: 'reserved' }).eq('id', post.id);

      if (error !== null) {
        fail('예약중으로 바꾸기', error);
      }
    }

    if (chat.trade !== undefined) {
      const { error } = await admin
        .from('posts')
        .update({ status: 'sold', buyer_id: buyer.id, sold_at: minutesAgo(chat.trade.soldMinutes) })
        .eq('id', post.id);

      if (error !== null) {
        fail('거래완료로 바꾸기', error);
      }

      for (const review of chat.trade.reviews) {
        const reviewerId = people[review.from].id;

        await insertOne(
          admin,
          'reviews',
          {
            post_id: post.id,
            reviewer_id: reviewerId,
            reviewee_id: reviewerId === buyer.id ? post.ownerId : buyer.id,
            score: review.score,
            manner_tags: review.tags,
            comment: review.comment,
            created_at: minutesAgo(review.minutes),
          },
          '후기 심기',
        );
        reviewCount += 1;
      }
    }
  }

  console.log(
    `채팅방 ${CHATS.length}개 · 메시지 ${messageCount}개 (채팅 사진 ${chatPhotoCount}장) · 후기 ${reviewCount}개`,
  );
}

async function printSummary(admin, people) {
  console.log('\n트리거가 쌓은 것:');

  for (const key of ['A', 'B', 'C', 'D']) {
    const person = people[key];

    const { count } = await admin
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', person.id);

    const { data: profile } = await admin
      .from('profiles')
      .select('manner_temp')
      .eq('id', person.id)
      .single();

    console.log(`  ${key} ${person.nickname} — 알림 ${count ?? 0}줄 · 매너온도 ${profile?.manner_temp ?? '?'}`);
  }
}

async function seed(admin, uuids) {
  const people = await resolvePeople(admin, uuids);

  console.log('\n네 사람:');
  for (const key of ['A', 'B', 'C', 'D']) {
    console.log(`  ${key}  ${people[key].nickname}  ${people[key].dong_name}`);
  }
  console.log('');

  const manifest = {
    seededAt: new Date().toISOString(),
    profileIds: Object.values(people).map(function toId(person) {
      return person.id;
    }),
    postIds: [],
    storage: { [POST_IMAGE_BUCKET]: [], [CHAT_IMAGE_BUCKET]: [], [AVATAR_BUCKET]: [] },
  };

  try {
    await seedAvatars(admin, people, manifest);
    const posts = await seedPosts(admin, people, manifest);
    await seedLikesAndViews(admin, people, posts);
    await seedComments(admin, people, posts);
    await seedChats(admin, people, posts, manifest);
  } finally {
    // 중간에 실패해도 **여기까지 심은 것**은 치울 수 있어야 한다.
    writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  }

  await printSummary(admin, people);

  console.log('\n네 계정으로 각각 로그인해서 보면 된다. 같은 글도 사람마다 다르게 보인다.');
  console.log('치울 때는  npm run seed:story -- --clean\n');
}

// ---------------------------------------------------------------------------
// 치우기 — 심은 것만
// ---------------------------------------------------------------------------

async function clean(admin) {
  if (!existsSync(MANIFEST_PATH)) {
    console.error('심은 기록(.seedStory.json)이 없다. 치울 것을 알 방법이 없다.');
    process.exit(1);
  }

  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));

  // 파일 먼저, 행 나중이다(0031과 같은 이유 — 행이 사라지면 경로를 되짚을 수 없다).
  for (const bucket of Object.keys(manifest.storage)) {
    const paths = manifest.storage[bucket];

    if (paths.length === 0) {
      continue;
    }

    const { error } = await admin.storage.from(bucket).remove(paths);

    if (error !== null) {
      fail(`사진 지우기 (${bucket})`, error);
    }
  }

  // 글을 지우면 댓글·찜·채팅방·메시지·후기·최근 본 글이 cascade로 따라간다(0001).
  // 알림도 0032의 트리거가 함께 걷어낸다. 후기가 사라지면 매너온도도 되돌아간다(0016).
  const { data: removed, error } = await admin
    .from('posts')
    .delete()
    .in('id', manifest.postIds)
    .select('id');

  if (error !== null) {
    fail('심은 글 지우기', error);
  }

  const { error: avatarError } = await admin
    .from('profiles')
    .update({ avatar_url: null })
    .in('id', manifest.profileIds);

  if (avatarError !== null) {
    fail('프로필 사진 떼기', avatarError);
  }

  unlinkSync(MANIFEST_PATH);

  console.log(`\n글 ${removed.length}개와 딸린 것들, 사진, 프로필 사진을 치웠다.`);
  console.log('계정 자체는 그대로다 — 사람이 로그인하는 계정이라 지우지 않는다.\n');
}

async function main() {
  loadEnvLocal();

  const admin = createClient(requireEnv(URL_ENV), requireEnv(SERVICE_ROLE_ENV), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const args = process.argv.slice(2);

  if (args[0] === '--clean') {
    await clean(admin);
    return;
  }

  await seed(admin, args);
}

await main();
