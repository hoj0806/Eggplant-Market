/**
 * **가입한 계정 전부가 서로 얽힌** 데이터를 심는다.
 *
 * `npm run seed:story`            첫 판을 심는다 (온보딩을 마친 계정을 전부 자동으로 고른다)
 * `npm run seed:story -- <uuid> ...`   순서를 직접 정한다
 * `npm run seed:story -- --more`  두 번째 판을 **더** 심는다 (= `--wave 2`)
 * `npm run seed:story -- --wave 3` 세 번째 판을 더 심는다 (앞선 판의 글에도 말이 붙는다)
 * `npm run seed:story -- --clean` 심은 것만 치운다
 *
 * 사람은 A·B·C… 자리로 적고 **온보딩을 마친 순서대로** 실제 계정을 붙인다. 계정이 늘면
 * 뒷자리(E·F…)가 채워지고, 아직 없는 자리를 가리키는 줄은 **그 줄만 조용히 건너뛴다** —
 * 계정 수가 판마다 달라도 같은 파일이 돈다.
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

/**
 * 한 판이 사진 수십 장을 받는데 그중 **한 장만 걸려도 통째로 멈춘다.** 남의 서버가 가끔
 * 튕기는 것을 그렇게 다룰 이유가 없어서 세 번까지 다시 청한다. 세 번 다 실패하면 그때 선다 —
 * 사진 없는 글이 섞이면 화면 버그와 구별되지 않는다.
 */
const DOWNLOAD_TRIES = 3;

function wait(ms) {
  return new Promise(function later(resolve) {
    setTimeout(resolve, ms);
  });
}

async function download(url, label) {
  let last = null;

  for (let attempt = 1; attempt <= DOWNLOAD_TRIES; attempt += 1) {
    try {
      const response = await fetch(url, { redirect: 'follow' });

      if (response.ok) {
        return Buffer.from(await response.arrayBuffer());
      }

      last = new Error(`${response.status} ${response.statusText}`);
    } catch (error) {
      last = error;
    }

    if (attempt < DOWNLOAD_TRIES) {
      console.log(`  사진 다시 받는다 (${label}, ${attempt}번째 실패)`);
      await wait(attempt * 1000);
    }
  }

  fail(`사진 받기 (${label})`, last);
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

const AVATAR_IMAGES = { A: 12, B: 33, C: 47, D: 5, E: 24, F: 60 };

// ---------------------------------------------------------------------------
// 두 번째 판 (`--more`)
//
// 첫 판을 다시 돌리면 같은 글이 두 벌 생긴다. 그래서 **더 심는 것**을 따로 적는다.
// 여기 있는 댓글·채팅 중에는 **첫 판의 글에 붙는 것**도 있다 — 시간이 지나며 글 하나에
// 말이 쌓이는 모습이 그래야 나온다. 첫 판의 글은 제목으로 찾아 붙인다(아래 findPlantedPosts).
// ---------------------------------------------------------------------------

const MORE_POSTS = [
  {
    key: 'capsule',
    owner: 'A',
    title: '캡슐 커피머신 (캡슐 30개 포함)',
    price: 60000,
    categoryId: 20,
    photos: [['coffee-machine', 141]],
    minutes: 45,
    views: 33,
    place: '석관동 우체국 앞',
    description:
      '드립으로 넘어가면서 정리합니다. 남은 캡슐 30개쯤 같이 드려요.\n물때 청소 방금 했고 잘 나옵니다.',
  },
  {
    key: 'helmet',
    owner: 'A',
    title: '자전거 헬멧 새것 (M)',
    price: 25000,
    categoryId: 53,
    photos: [['bicycle-helmet', 151]],
    minutes: 520,
    views: 19,
    place: null,
    description: '사이즈가 안 맞아서 두 번 쓰고 넣어뒀습니다.\n머리둘레 56~58 정도면 맞아요.',
  },
  {
    key: 'rack',
    owner: 'A',
    title: '원룸 행거 (조립식)',
    price: 8000,
    categoryId: 25,
    photos: [['clothes-rack', 161]],
    minutes: 2100,
    views: 14,
    place: null,
    description: '이사하면서 붙박이장이 생겨서 내놓아요. 나사 다 있고 흔들림 없습니다.',
  },
  {
    key: 'iphone',
    owner: 'B',
    title: '아이폰 13 미니 128GB 미드나이트',
    price: 320000,
    categoryId: 13,
    photos: [['iphone', 171], ['smartphone', 172]],
    minutes: 70,
    views: 154,
    place: '장위동 근린공원 입구',
    description:
      '2년 썼고 배터리 성능 87%입니다. 액정·후면 깨짐 없고 케이스 계속 씌워 썼어요.\n초기화해서 드리고 정품 케이블 같이 드립니다.\n택배는 안 하고 직거래만 할게요.',
  },
  {
    key: 'backpack',
    owner: 'B',
    title: '등산 배낭 40L',
    price: 45000,
    categoryId: 54,
    photos: [['hiking-backpack', 181]],
    minutes: 1050,
    views: 26,
    place: null,
    description: '두 번 메고 창고에 있었습니다. 레인커버 있고 등판 통풍 잘 됩니다.',
  },
  {
    key: 'books',
    owner: 'B',
    title: '문고판 소설 20권 묶음',
    price: 15000,
    categoryId: 67,
    photos: [['books', 191]],
    minutes: 3600,
    views: 22,
    place: null,
    description: '책장 정리합니다. 밑줄 없고 상태 깨끗해요.\n낱권 판매는 안 하고 묶음으로만 드립니다.',
  },
  {
    key: 'camera',
    owner: 'C',
    title: '미러리스 카메라 + 번들렌즈',
    price: 380000,
    categoryId: 16,
    photos: [['mirrorless-camera', 201], ['camera-lens', 202]],
    minutes: 55,
    views: 178,
    place: '이문동 초록마을 앞',
    description:
      '여행 다닐 때 쓰다가 요즘은 폰으로만 찍게 되어 내놓습니다.\n셔터수 8천 정도고 번들렌즈, 배터리 두 개, 스트랩 포함이에요.\n실물 확인하고 사셔도 됩니다.',
  },
  {
    key: 'yoga',
    owner: 'C',
    title: '요가매트 + 폼롤러 세트',
    price: 18000,
    categoryId: 56,
    photos: [['yoga-mat', 211]],
    minutes: 1700,
    views: 31,
    place: null,
    description: '홈트 하다가 헬스장 등록해서 정리해요. 매트 두께 6mm입니다.',
  },
  {
    key: 'kettle',
    owner: 'D',
    title: '전기 주전자 1.7L',
    price: 12000,
    categoryId: 20,
    photos: [['electric-kettle', 221]],
    minutes: 180,
    views: 24,
    place: '중화동 먹자골목 입구',
    description: '자취할 때 쓰던 겁니다. 내부 스테인리스라 냄새 안 나요.\n1분이면 끓습니다.',
  },
  {
    key: 'harness',
    owner: 'D',
    title: '강아지 하네스 M 사이즈',
    price: 9000,
    categoryId: 74,
    photos: [['dog-harness', 231]],
    minutes: 2300,
    views: 17,
    place: null,
    description: '우리 강아지가 커버려서 못 쓰게 됐어요. 세탁해뒀습니다.\n5~8kg 정도에 잘 맞아요.',
  },
  {
    key: 'monstera',
    owner: 'D',
    title: '몬스테라 화분 (중형)',
    price: 20000,
    categoryId: 79,
    photos: [['monstera', 241]],
    minutes: 4100,
    views: 40,
    place: null,
    description:
      '2년 키운 아이입니다. 잎이 커져서 자리를 많이 차지해요.\n화분째 드리고 분갈이는 최근에 했습니다. 물꽂이 방법도 알려드릴게요.',
  },
];

const MORE_COMMENTS = [
  {
    post: 'iphone',
    author: 'A',
    minutes: 66,
    content: '배터리 성능 87%면 하루 정도는 버티나요?',
    replies: [{ author: 'B', minutes: 64, content: '가볍게 쓰면 하루 갑니다. 게임 하면 좀 줄어요.' }],
  },
  {
    post: 'iphone',
    author: 'C',
    minutes: 60,
    secret: true,
    content: '혹시 30만원에 가능하실까요? 오늘 바로 갈 수 있어요.',
    replies: [{ author: 'B', minutes: 58, secret: true, content: '31만원까지는 됩니다. 채팅으로 이야기하시죠.' }],
  },
  {
    post: 'camera',
    author: 'D',
    minutes: 50,
    content: '셔터수 8천이면 거의 새것이네요. 렌즈 곰팡이는 없나요?',
    replies: [{ author: 'C', minutes: 48, content: '없습니다. 방습함에 보관했어요. 보시면서 확인하셔도 돼요.' }],
  },
  {
    post: 'camera',
    author: 'A',
    minutes: 40,
    content: '가방도 같이 주시나요?',
    replies: [{ author: 'C', minutes: 38, content: '가방은 제가 계속 써야 해서요. 스트랩은 드립니다!' }],
  },
  {
    post: 'monstera',
    author: 'C',
    minutes: 3800,
    content: '잎 크기가 어느 정도인가요? 화분 높이도 궁금해요.',
    replies: [{ author: 'D', minutes: 3780, content: '잎이 어른 손바닥보다 크고 화분까지 70cm쯤 됩니다.' }],
  },
  {
    post: 'kettle',
    author: 'A',
    minutes: 160,
    content: '아직 있을까요? 오늘 저녁에 갈 수 있어요.',
    replies: [{ author: 'D', minutes: 150, content: '네 있습니다. 먹자골목 입구에서 뵈면 돼요.' }],
  },
  {
    post: 'backpack',
    author: 'D',
    minutes: 1000,
    content: '등산 자주 다니시나 봐요. 40L면 1박 2일도 되나요?',
    replies: [],
  },
  {
    post: 'books',
    author: 'C',
    minutes: 3500,
    content: '어떤 작가 책들인가요? 목록 있으면 좋겠어요.',
    replies: [{ author: 'B', minutes: 3480, content: '한국 소설 위주고 절반은 단편집입니다. 사진 더 찍어 올릴게요.' }],
  },
  // 첫 판의 글에 말이 더 붙는다. 시간이 지나며 쌓이는 모습이 그래야 나온다.
  {
    post: 'ipad',
    author: 'D',
    minutes: 8,
    content: '아직 판매 중인가요? 주말에 갈 수 있습니다.',
    replies: [],
  },
  {
    post: 'bike',
    author: 'C',
    minutes: 88,
    content: '지금 채팅도 드렸어요! 오늘 저녁까지 답 주시면 바로 갈게요.',
    replies: [{ author: 'B', minutes: 86, content: '확인했습니다. 조금만 기다려 주세요!' }],
  },
  {
    post: 'coffee',
    author: 'B',
    minutes: 2700,
    secret: true,
    content: '나눔이라 조심스러운데 혹시 아직 남아 있을까요?',
    replies: [{ author: 'A', minutes: 2690, secret: true, content: '아직 있어요! 편하실 때 말씀 주세요.' }],
  },
];

const MORE_LIKES = [
  { post: 'iphone', users: ['A', 'C', 'D'] },
  { post: 'camera', users: ['A', 'B', 'D'] },
  { post: 'monstera', users: ['A', 'C'] },
  { post: 'capsule', users: ['B', 'D'] },
  { post: 'kettle', users: ['A'] },
  { post: 'books', users: ['C'] },
  { post: 'yoga', users: ['B'] },
  // 첫 판의 글에도 관심이 더 붙는다.
  { post: 'earbuds', users: ['D'] },
  { post: 'chair', users: ['A'] },
];

const MORE_RECENT = {
  A: ['iphone', 'camera', 'kettle', 'monstera'],
  B: ['camera', 'capsule', 'yoga'],
  C: ['iphone', 'harness', 'monstera'],
  D: ['camera', 'iphone', 'books', 'capsule'],
};

const MORE_CHATS = [
  {
    post: 'iphone',
    buyer: 'C',
    messages: [
      { from: 'C', minutes: 56, text: '댓글 남겼던 사람이에요. 실물 사진 한 장만 볼 수 있을까요?' },
      { from: 'B', minutes: 54, photo: ['iphone', 173] },
      { from: 'B', minutes: 53, text: '이렇게 생겼습니다. 케이스 벗긴 상태예요.' },
      { from: 'C', minutes: 50, text: '깨끗하네요. 30만원 어떠세요?' },
      { from: 'C', minutes: 49, offer: 300000, status: 'pending' },
    ],
  },
  {
    post: 'camera',
    buyer: 'D',
    messages: [
      { from: 'D', minutes: 45, text: '카메라 보고 연락드려요. 오늘 실물 확인 가능할까요?' },
      { from: 'C', minutes: 44, text: '네 저녁 7시 이후면 초록마을 앞에서 가능합니다.' },
      { from: 'D', minutes: 42, text: '그럼 36만원에 해주시면 바로 갈게요!' },
      { from: 'D', minutes: 41, offer: 360000, status: 'accepted' },
      { from: 'C', minutes: 40, text: '좋습니다. 이따 뵐게요.' },
      { from: 'D', minutes: 20, text: '잘 받았습니다. 시험 삼아 몇 장 찍어봤는데 좋네요!' },
    ],
    trade: {
      soldMinutes: 18,
      reviews: [
        {
          from: 'D',
          score: 0.5,
          tags: ['시간 약속을 잘 지켜요', '상품 상태가 설명과 같아요'],
          comment: '셔터수까지 그대로였습니다. 사용법도 알려주셔서 감사했어요.',
          minutes: 15,
        },
        {
          from: 'C',
          score: 0.1,
          tags: ['응답이 빨라요'],
          comment: '약속 잡기 편했습니다.',
          minutes: 12,
        },
      ],
    },
  },
  {
    post: 'capsule',
    buyer: 'D',
    messages: [
      { from: 'D', minutes: 40, text: '커피머신 5만 5천원에 가능할까요?' },
      { from: 'D', minutes: 39, offer: 55000, status: 'rejected' },
      { from: 'A', minutes: 35, text: '캡슐까지 드리는 거라 6만원은 받아야 할 것 같아요. 죄송합니다!' },
    ],
  },
  {
    post: 'kettle',
    buyer: 'A',
    messages: [
      { from: 'A', minutes: 140, text: '댓글 드렸던 사람입니다. 지금 가도 될까요?' },
      { from: 'D', minutes: 138, photo: ['electric-kettle', 222] },
      { from: 'D', minutes: 137, text: '지금 상태 이래요. 7시 이후에 오시면 됩니다.' },
      { from: 'A', minutes: 135, text: '네 그때 뵐게요!' },
    ],
  },
  {
    post: 'yoga',
    buyer: 'B',
    messages: [
      { from: 'B', minutes: 900, text: '요가매트 아직 있나요?' },
      { from: 'C', minutes: 880, text: '네 있습니다. 이문동으로 오실 수 있으면 오늘도 괜찮아요.' },
      { from: 'B', minutes: 500, text: '받았습니다.' },
    ],
    trade: {
      soldMinutes: 480,
      reviews: [
        {
          from: 'B',
          score: -0.5,
          tags: [],
          comment: '약속 시간에 30분 늦으셨고 연락도 늦게 되어 아쉬웠습니다.',
          minutes: 460,
        },
      ],
    },
  },
];

// ---------------------------------------------------------------------------
// 세 번째 판 (`--wave 3`)
//
// 계정이 넷에서 **여섯**이 됐다. 새로 들어온 둘(E·F)은 글도 말도 없는 빈 사람이라
// 그 계정으로 로그인하면 화면이 처음 그 자리로 돌아간다 — 프로필도 비고 채팅도 비었다.
// 그래서 세 번째 판은 **E·F를 이야기 한가운데 놓는다.** F는 파는 쪽(글 아홉),
// E는 사고 파는 쪽 양쪽에 걸친다.
//
// 앞선 두 판의 글에도 말이 더 붙는다 — 새로 들어온 사람이 **이미 있던 글에 댓글을 달고
// 채팅을 여는 것**이 실제로 벌어지는 일이고, 그 모습이 있어야 오래된 글이 죽어 보이지 않는다.
// ---------------------------------------------------------------------------

const WAVE3_POSTS = [
  {
    key: 'monitor',
    owner: 'F',
    title: '27인치 QHD 모니터 (거치대 포함)',
    price: 130000,
    categoryId: 21,
    photos: [['computer-monitor', 301], ['monitor', 302]],
    minutes: 25,
    views: 96,
    place: '석관동 우체국 앞',
    description:
      '재택하다가 듀얼로 쓰던 걸 하나 정리합니다. 불량화소 없고 밝기도 그대로예요.\n높낮이 조절되는 거치대랑 HDMI 케이블 같이 드립니다.\n박스는 버려서 직접 오셔야 해요.',
  },
  {
    key: 'airfryer',
    owner: 'F',
    title: '에어프라이어 5.5L 거의 안 씀',
    price: 35000,
    categoryId: 20,
    photos: [['air-fryer', 311]],
    minutes: 140,
    views: 44,
    place: null,
    description: '작년에 사서 열 번쯤 돌렸습니다. 바스켓 코팅 벗겨진 곳 없어요.\n안쪽 닦아뒀습니다.',
  },
  {
    key: 'speaker',
    owner: 'F',
    title: '블루투스 스피커 (방수)',
    price: 40000,
    categoryId: 18,
    photos: [['bluetooth-speaker', 321]],
    minutes: 330,
    views: 38,
    place: null,
    description: '캠핑 갈 때 들고 다니던 스피커입니다. 배터리 여덟 시간쯤 갑니다.\n충전 케이블 같이 드려요.',
  },
  {
    key: 'sneakers',
    owner: 'F',
    title: '운동화 270 (두 번 신음)',
    price: 55000,
    categoryId: 44,
    photos: [['sneakers', 331]],
    minutes: 620,
    views: 51,
    place: '석관동 두산아파트 정문',
    description:
      '사이즈를 잘못 사서 두 번 신고 넣어뒀습니다.\n밑창 깨끗하고 박스 있습니다. 275 신으시는 분께 딱 맞을 거예요.',
  },
  {
    key: 'jacket',
    owner: 'F',
    title: '남성 패딩 점퍼 L (블랙)',
    price: 70000,
    categoryId: 43,
    photos: [['winter-jacket', 341]],
    minutes: 1500,
    views: 62,
    place: null,
    description: '겨울에 두 시즌 입었습니다. 오리털이라 가볍고 따뜻해요.\n세탁소 드라이 맡겨 뒀고 지퍼·단추 이상 없습니다.',
  },
  {
    key: 'humidifier',
    owner: 'F',
    title: '초음파 가습기 (필터 새것)',
    price: 15000,
    categoryId: 19,
    photos: [['humidifier', 351]],
    minutes: 2200,
    views: 23,
    place: null,
    description: '방이 건조해서 썼는데 이사 가는 집에는 이미 있어서요.\n물통 세척했고 여분 필터 하나 같이 드립니다.',
  },
  {
    key: 'ricecooker',
    owner: 'F',
    title: '6인용 전기밥솥',
    price: 30000,
    categoryId: 20,
    photos: [['rice-cooker', 361]],
    minutes: 3300,
    views: 29,
    place: null,
    description: '자취하면서 쓰던 밥솥입니다. 내솥 코팅 멀쩡하고 취사 잘 됩니다.\n계량컵이랑 주걱 있어요.',
  },
  {
    key: 'hanger',
    owner: 'F',
    title: '옷걸이 50개 나눔합니다',
    price: 0,
    categoryId: 30,
    photos: [['clothes-hanger', 371]],
    minutes: 4300,
    views: 71,
    place: '석관동 우체국 앞',
    description:
      '이사 정리하다 나온 옷걸이입니다. 검정 벨벳이라 옷이 안 흘러내려요.\n필요하신 분 편하게 가져가세요. 나눠 가져가셔도 됩니다.',
  },
  {
    key: 'desklight',
    owner: 'F',
    title: '책상 스탠드 (밝기 조절)',
    price: 9000,
    categoryId: 26,
    photos: [['desk-lamp', 381]],
    minutes: 5200,
    views: 16,
    place: null,
    description: '눈 안 부시고 밝기 5단계입니다. 클립형이라 책상 모서리에 물려 쓰면 돼요.',
  },
  {
    key: 'guitar',
    owner: 'E',
    title: '통기타 입문용 (케이스 포함)',
    price: 85000,
    categoryId: 61,
    photos: [['acoustic-guitar', 391], ['guitar', 392]],
    minutes: 60,
    views: 108,
    place: '석관동 우체국 앞',
    description:
      '배워보겠다고 샀다가 세 달 치고 세워만 뒀습니다.\n줄 최근에 갈았고 넥 휨 없습니다. 소프트 케이스랑 카포, 피크 같이 드려요.\n실물 쳐보고 사셔도 됩니다.',
  },
  {
    key: 'boardgame',
    owner: 'E',
    title: '보드게임 5종 묶음',
    price: 40000,
    categoryId: 64,
    photos: [['board-game', 401]],
    minutes: 210,
    views: 57,
    place: null,
    description:
      '모임에서 쓰던 것들입니다. 부품 다 있고 설명서도 들어 있어요.\n낱개로는 안 팔고 다섯 개 묶어서 드립니다.',
  },
  {
    key: 'figure',
    owner: 'E',
    title: '피규어 미개봉 (정품)',
    price: 45000,
    categoryId: 63,
    photos: [['action-figure', 411]],
    minutes: 880,
    views: 74,
    place: null,
    description:
      '두 개 사서 하나는 그대로 뒀습니다. 박스 뜯지 않았어요.\n택배도 가능하지만 파손 걱정돼서 직거래를 선호합니다.',
  },
  {
    key: 'purifier',
    owner: 'E',
    title: '공기청정기 (원룸용)',
    price: 55000,
    categoryId: 19,
    photos: [['air-purifier', 421]],
    minutes: 1900,
    views: 42,
    place: '석관동 두산아파트 정문',
    description: '필터 두 달 전에 갈았고 여분 필터 하나 같이 드립니다.\n소음은 취침 모드에서 거의 안 들려요.',
  },
  {
    key: 'cattower',
    owner: 'E',
    title: '캣타워 (2단, 해체해서 드림)',
    price: 25000,
    categoryId: 75,
    photos: [['cat-tower', 431]],
    minutes: 3700,
    views: 33,
    place: null,
    description: '고양이가 위층만 써서 정리합니다. 스크래처 기둥 멀쩡해요.\n해체해서 드리니 차에 실으실 수 있습니다.',
  },
  {
    key: 'golf',
    owner: 'B',
    title: '골프 아이언 세트 (7개)',
    price: 250000,
    categoryId: 55,
    photos: [['golf-clubs', 441]],
    minutes: 100,
    views: 121,
    place: '장위동 근린공원 입구',
    description:
      '연습장에서 두 시즌 썼습니다. 그립 최근에 다 갈았어요.\n헤드 찍힘 거의 없고 캐디백은 따로 쓰던 거라 안 드립니다.\n실물 보고 사셔도 됩니다.',
  },
  {
    key: 'tent',
    owner: 'B',
    title: '2인용 백패킹 텐트',
    price: 90000,
    categoryId: 54,
    photos: [['camping-tent', 451], ['tent', 452]],
    minutes: 760,
    views: 66,
    place: null,
    description: '세 번 쳤고 방수 그대로입니다. 폴대 휨 없고 팩 전부 있어요.\n말려서 보관했습니다.',
  },
  {
    key: 'watch',
    owner: 'B',
    title: '오토매틱 손목시계 (정품 보증서)',
    price: 150000,
    categoryId: 46,
    photos: [['wristwatch', 461]],
    minutes: 2800,
    views: 89,
    place: null,
    description: '선물 받았는데 손목이 얇아 안 어울려서요. 오차 하루 5초 정도입니다.\n보증서랑 여분 링크 있습니다.',
  },
  {
    key: 'basketball',
    owner: 'B',
    title: '농구공 + 펌프',
    price: 15000,
    categoryId: 57,
    photos: [['basketball', 471]],
    minutes: 4600,
    views: 19,
    place: null,
    description: '공원에서 몇 번 튀겼습니다. 바람 잘 차 있고 펌프 같이 드려요.',
  },
  {
    key: 'tripod',
    owner: 'C',
    title: '삼각대 + 미니 짐벌',
    price: 70000,
    categoryId: 16,
    photos: [['tripod', 481]],
    minutes: 190,
    views: 58,
    place: '이문동 초록마을 앞',
    description:
      '카메라 정리하면서 같이 내놓습니다. 삼각대는 알루미늄이라 가볍고 짐벌은 폰용이에요.\n둘 다 파우치 있습니다.',
  },
  {
    key: 'headphone',
    owner: 'C',
    title: '노이즈캔슬링 헤드폰',
    price: 120000,
    categoryId: 18,
    photos: [['headphones', 491], ['headphone', 492]],
    minutes: 480,
    views: 143,
    place: '이문동 초록마을 앞',
    description:
      '출퇴근할 때 쓰다가 이어폰으로 갈아타서 정리합니다.\n이어패드 갈아 끼운 지 얼마 안 됐고 케이스, 케이블 다 있어요.\n배터리는 아직 스무 시간 넘게 갑니다.',
  },
  {
    key: 'vinyl',
    owner: 'C',
    title: 'LP 레코드 10장 묶음',
    price: 50000,
    categoryId: 60,
    photos: [['vinyl-record', 501]],
    minutes: 2400,
    views: 47,
    place: null,
    description: '턴테이블을 정리하면서 같이 내놓습니다. 스크래치 심한 판은 뺐어요.\n목록은 채팅으로 알려드릴게요.',
  },
  {
    key: 'stroller',
    owner: 'D',
    title: '절충형 유모차 (세탁 완료)',
    price: 120000,
    categoryId: 37,
    photos: [['stroller', 511]],
    minutes: 320,
    views: 84,
    place: '중화동 먹자골목 입구',
    description:
      '둘째까지 쓰고 정리합니다. 바퀴 소음 없고 접이도 부드럽게 됩니다.\n시트는 분리해서 세탁했고 햇빛가리개, 컵홀더 있습니다.',
  },
  {
    key: 'babyclothes',
    owner: 'D',
    title: '아기 옷 정리해요 (12~24개월)',
    price: 10000,
    categoryId: 35,
    photos: [['baby-clothes', 521]],
    minutes: 2000,
    views: 31,
    place: null,
    description: '스무 벌 정도 됩니다. 얼룩 있는 건 뺐고 전부 세탁해뒀어요.\n묶음으로만 드립니다.',
  },
  {
    key: 'succulent',
    owner: 'D',
    title: '다육이 모둠 화분',
    price: 8000,
    categoryId: 80,
    photos: [['succulent', 531]],
    minutes: 5600,
    views: 26,
    place: null,
    description: '햇빛 잘 드는 창가에서 키웠습니다. 물은 2주에 한 번이면 돼요.\n화분째 드립니다.',
  },
  {
    key: 'fan',
    owner: 'A',
    title: '스탠드 선풍기 (리모컨)',
    price: 18000,
    categoryId: 19,
    photos: [['electric-fan', 541]],
    minutes: 1100,
    views: 28,
    place: null,
    description: '작년 여름에 쓰고 넣어뒀습니다. 날개 분리해서 닦아뒀어요.\n리모컨 있고 타이머 됩니다.',
  },
  {
    key: 'textbook',
    owner: 'A',
    title: '토익 문제집 세트 (필기 없음)',
    price: 12000,
    categoryId: 70,
    photos: [['textbook', 551]],
    minutes: 3100,
    views: 20,
    place: null,
    description: '시험 끝나서 정리합니다. RC·LC 두 권이고 밑줄 없습니다.\nCD도 그대로 있어요.',
  },
  {
    key: 'wanted',
    owner: 'A',
    title: '애플펜슬 2세대 구합니다',
    price: 50000,
    categoryId: 84,
    photos: [['apple-pencil', 561]],
    minutes: 300,
    views: 39,
    place: '석관동 우체국 앞',
    description:
      '아이패드는 있는데 펜슬만 없어서 구합니다. 잔기스는 괜찮고 필기만 잘 되면 돼요.\n5만원 정도 생각하고 있고 석관동 근처면 제가 갈게요.',
  },
];

const WAVE3_COMMENTS = [
  {
    post: 'monitor',
    author: 'A',
    minutes: 22,
    content: '주사율이 어떻게 되나요? 게임용으로도 쓸 만할까요?',
    replies: [
      { author: 'F', minutes: 20, content: '75Hz입니다. 문서 작업에는 넉넉한데 FPS 하시면 아쉬울 수 있어요.' },
    ],
  },
  {
    post: 'monitor',
    author: 'E',
    minutes: 18,
    content: '거치대 높이 조절 폭이 어느 정도인가요?',
    replies: [{ author: 'F', minutes: 16, content: '10cm 정도 오르내리고 피벗도 됩니다.' }],
  },
  {
    post: 'monitor',
    author: 'C',
    minutes: 12,
    secret: true,
    content: '12만원에 가능하실까요? 오늘 바로 가져갈 수 있어요.',
    replies: [{ author: 'F', minutes: 10, secret: true, content: '12만 5천원까지 생각하고 있어요. 채팅 주세요!' }],
  },
  {
    post: 'guitar',
    author: 'B',
    minutes: 55,
    content: '넥 휨은 직접 보면 알 수 있을까요? 기타는 처음이라서요.',
    replies: [{ author: 'E', minutes: 52, content: '오시면 같이 봐 드릴게요. 12프렛에서 줄 높이 재보면 바로 나와요.' }],
  },
  {
    post: 'guitar',
    author: 'D',
    minutes: 45,
    content: '혹시 튜너도 같이 주시나요?',
    replies: [{ author: 'E', minutes: 43, content: '클립 튜너 하나 같이 넣어드릴게요.' }],
  },
  {
    post: 'guitar',
    author: 'F',
    minutes: 30,
    secret: true,
    content: '8만원에 해주시면 이번 주에 가지러 갈게요.',
    replies: [
      { author: 'E', minutes: 28, secret: true, content: '케이스까지 드리는 거라 8만 5천원은 받아야 할 것 같아요. 죄송합니다!' },
    ],
  },
  {
    post: 'headphone',
    author: 'E',
    minutes: 460,
    content: '유선으로도 쓸 수 있나요?',
    replies: [{ author: 'C', minutes: 455, content: '네 3.5mm 케이블 같이 드려서 유선으로도 됩니다.' }],
  },
  {
    post: 'headphone',
    author: 'F',
    minutes: 440,
    content: '이어패드 갈아 끼우신 게 정품인가요?',
    replies: [{ author: 'C', minutes: 435, content: '정품으로 샀습니다. 영수증도 남아 있어요.' }],
  },
  {
    post: 'golf',
    author: 'F',
    minutes: 90,
    content: '샤프트가 스틸인가요 카본인가요?',
    replies: [{ author: 'B', minutes: 88, content: '스틸입니다. 남성 레귤러예요.' }],
  },
  {
    post: 'golf',
    author: 'E',
    minutes: 70,
    content: '입문자가 쓰기에도 괜찮을까요?',
    replies: [{ author: 'B', minutes: 66, content: '연습장에서 배우기엔 충분합니다. 저도 그렇게 시작했어요.' }],
  },
  {
    post: 'stroller',
    author: 'E',
    minutes: 300,
    content: '접었을 때 트렁크에 들어갈 정도인가요?',
    replies: [{ author: 'D', minutes: 296, content: '준중형 트렁크에 들어갑니다. 접으면 폭이 많이 줄어요.' }],
  },
  {
    post: 'stroller',
    author: 'F',
    minutes: 250,
    secret: true,
    content: '11만원까지 가능할까요? 조심스럽게 여쭤봅니다.',
    replies: [{ author: 'D', minutes: 245, secret: true, content: '세탁까지 해둔 거라 12만원은 받고 싶어요. 이해해 주세요.' }],
  },
  {
    post: 'hanger',
    author: 'A',
    minutes: 4200,
    content: '나눔 감사합니다! 스무 개만 가져가도 될까요?',
    replies: [{ author: 'F', minutes: 4190, content: '네 그렇게 하셔도 돼요. 편한 시간 말씀해주세요.' }],
  },
  {
    post: 'hanger',
    author: 'D',
    minutes: 4100,
    content: '아직 남아 있을까요?',
    replies: [{ author: 'F', minutes: 4090, content: '아직 있습니다. 우체국 앞에서 뵈면 돼요.' }],
  },
  {
    post: 'boardgame',
    author: 'A',
    minutes: 200,
    content: '어떤 게임들인지 알 수 있을까요?',
    replies: [{ author: 'E', minutes: 195, content: '루미큐브, 할리갈리, 젠가, 부루마블, 다빈치코드입니다.' }],
  },
  {
    post: 'boardgame',
    author: 'C',
    minutes: 150,
    content: '4인 이상도 되는 게임 있나요?',
    replies: [{ author: 'E', minutes: 145, content: '루미큐브 빼고는 다 4인 이상 됩니다.' }],
  },
  {
    post: 'tent',
    author: 'D',
    minutes: 700,
    content: '전실 있나요? 배낭 두 개 놓을 자리가 필요해서요.',
    replies: [{ author: 'B', minutes: 690, content: '전실 있고 배낭 두 개는 넉넉히 들어갑니다.' }],
  },
  {
    post: 'watch',
    author: 'F',
    minutes: 2700,
    content: '파워리저브가 얼마나 되나요?',
    replies: [{ author: 'B', minutes: 2690, content: '40시간 정도입니다. 하루 차고 벗어두면 다음 날 아침까지는 돌아가요.' }],
  },
  {
    post: 'tripod',
    author: 'F',
    minutes: 170,
    content: '짐벌은 어느 폰까지 물리나요?',
    replies: [{ author: 'C', minutes: 165, content: '6.7인치까지 물립니다. 케이스 벗기면 더 여유 있어요.' }],
  },
  {
    post: 'vinyl',
    author: 'E',
    minutes: 2300,
    content: '목록 미리 알려주실 수 있을까요? 겹치는 판이 있을까 봐요.',
    replies: [{ author: 'C', minutes: 2280, content: '채팅 주시면 사진으로 보내드릴게요.' }],
  },
  {
    post: 'purifier',
    author: 'B',
    minutes: 1800,
    content: '필터값이 얼마나 하나요?',
    replies: [{ author: 'E', minutes: 1790, content: '정품이 2만원쯤 합니다. 여분 하나 드리니 한동안은 안 사셔도 돼요.' }],
  },
  {
    post: 'cattower',
    author: 'D',
    minutes: 3600,
    content: '높이가 어느 정도인가요?',
    replies: [{ author: 'E', minutes: 3590, content: '1m 조금 넘습니다. 2단이라 창가에 두기 딱 좋아요.' }],
  },
  {
    post: 'airfryer',
    author: 'C',
    minutes: 130,
    content: '바스켓 크기가 통닭 한 마리 들어가나요?',
    replies: [{ author: 'F', minutes: 125, content: '한 마리는 빠듯하고 반 마리씩 두 번 돌리시는 게 좋아요.' }],
  },
  {
    post: 'sneakers',
    author: 'E',
    minutes: 600,
    content: '275 신는데 넉넉할까요?',
    replies: [{ author: 'F', minutes: 590, content: '정사이즈보다 크게 나온 모델이라 275도 맞으실 거예요.' }],
  },
  {
    post: 'jacket',
    author: 'C',
    minutes: 1400,
    content: '키 180에 L이면 팔 길이 괜찮을까요?',
    replies: [],
  },
  {
    post: 'speaker',
    author: 'A',
    minutes: 300,
    content: '방수 등급이 어떻게 되나요? 계곡에 들고 가려고요.',
    replies: [{ author: 'F', minutes: 290, content: 'IPX7이라 잠깐 물에 빠져도 괜찮습니다. 다만 오래 담그진 마세요.' }],
  },
  {
    post: 'figure',
    author: 'A',
    minutes: 800,
    content: '박스 상태는 어떤가요? 눌린 곳 있나요?',
    replies: [{ author: 'E', minutes: 790, content: '모서리 하나 살짝 눌렸고 나머지는 깨끗합니다. 사진 더 찍어드릴게요.' }],
  },
  {
    post: 'babyclothes',
    author: 'E',
    minutes: 1900,
    content: '남아 옷인가요 여아 옷인가요?',
    replies: [{ author: 'D', minutes: 1890, content: '남아 옷 위주고 성별 상관없는 것도 몇 벌 있어요.' }],
  },
  {
    post: 'wanted',
    author: 'F',
    minutes: 280,
    content: '1세대는 안 되시죠? 저한테 1세대가 하나 있어서요.',
    replies: [{ author: 'A', minutes: 270, content: '제 아이패드가 2세대만 붙어서요. 말씀 감사합니다!' }],
  },
  {
    post: 'ricecooker',
    author: 'E',
    minutes: 3200,
    content: '내솥만 따로 사려면 파나요?',
    replies: [],
  },
  // 앞선 두 판의 글에도 새 사람들이 말을 붙인다.
  {
    post: 'ipad',
    author: 'F',
    minutes: 6,
    content: '아직 판매 중이면 오늘 저녁에 가겠습니다. 채팅도 드렸어요!',
    replies: [{ author: 'A', minutes: 5, content: '네 확인했습니다. 저녁에 뵐게요.' }],
  },
  {
    post: 'iphone',
    author: 'E',
    minutes: 40,
    content: '초기화해서 주신다고 하셨는데 잠금 해제도 되어 있는 거죠?',
    replies: [{ author: 'B', minutes: 38, content: '네 계정까지 다 지워서 드립니다. 자급제라 통신사도 상관없어요.' }],
  },
  {
    post: 'camera',
    author: 'F',
    minutes: 35,
    content: '이미 팔리셨을까요? 늦게 봐서요.',
    replies: [{ author: 'C', minutes: 30, content: '아쉽게도 방금 나갔습니다. 다음에 또 올릴게요!' }],
  },
  {
    post: 'coffee',
    author: 'E',
    minutes: 2600,
    content: '나눔 아직 남아 있을까요? 커피 배워보려고요.',
    replies: [{ author: 'A', minutes: 2590, content: '아직 있어요. 오늘 저녁에 우체국 앞에서 뵐까요?' }],
  },
  {
    post: 'switch',
    author: 'E',
    minutes: 100,
    content: '거래 끝났으면 혹시 다음에 또 올리실 계획 있으신가요?',
    replies: [],
  },
  {
    post: 'monstera',
    author: 'F',
    minutes: 3500,
    content: '물꽂이 방법 알려주신다는 게 잎 하나 잘라주신다는 뜻인가요?',
    replies: [{ author: 'D', minutes: 3490, content: '네 줄기 하나 잘라서 같이 드릴게요. 뿌리 내리면 화분 하나 더 생겨요.' }],
  },
  {
    post: 'bike',
    author: 'F',
    minutes: 80,
    secret: true,
    content: '17만원에 오늘 바로 가능할까요?',
    replies: [{ author: 'B', minutes: 78, secret: true, content: '먼저 채팅 주신 분이 계셔서요. 그쪽 답을 보고 말씀드릴게요.' }],
  },
  {
    post: 'keyboard',
    author: 'E',
    minutes: 360,
    content: '축만 갈면 적축으로 바꿀 수 있는 모델인가요?',
    replies: [{ author: 'B', minutes: 350, content: '핫스왑은 아니라서 납땜해야 합니다. 그냥 쓰시는 걸 권해요.' }],
  },
  {
    post: 'lamp',
    author: 'F',
    minutes: 60,
    content: '전구는 몇 와트짜리인가요?',
    replies: [{ author: 'D', minutes: 55, content: '8W LED입니다. 방 하나 밝히기엔 충분해요.' }],
  },
];

const WAVE3_LIKES = [
  { post: 'monitor', users: ['A', 'C', 'D', 'E'] },
  { post: 'guitar', users: ['A', 'B', 'D', 'F'] },
  { post: 'headphone', users: ['A', 'E', 'F'] },
  { post: 'golf', users: ['C', 'E', 'F'] },
  { post: 'stroller', users: ['E', 'F'] },
  { post: 'hanger', users: ['A', 'D', 'E'] },
  { post: 'boardgame', users: ['A', 'C'] },
  { post: 'tent', users: ['C', 'D'] },
  { post: 'watch', users: ['A', 'F'] },
  { post: 'tripod', users: ['B', 'F'] },
  { post: 'vinyl', users: ['E'] },
  { post: 'purifier', users: ['B', 'D'] },
  { post: 'sneakers', users: ['C', 'E'] },
  { post: 'airfryer', users: ['D'] },
  { post: 'figure', users: ['A', 'D'] },
  { post: 'succulent', users: ['C', 'E'] },
  { post: 'wanted', users: ['F'] },
  // 앞선 판의 글에도 새 사람의 관심이 붙는다.
  { post: 'ipad', users: ['E', 'F'] },
  { post: 'iphone', users: ['E', 'F'] },
  { post: 'monstera', users: ['E'] },
  { post: 'coffee', users: ['E'] },
  { post: 'capsule', users: ['E', 'F'] },
];

const WAVE3_RECENT = {
  A: ['monitor', 'guitar', 'hanger', 'headphone'],
  B: ['guitar', 'tripod', 'monitor', 'purifier'],
  C: ['monitor', 'golf', 'sneakers', 'succulent'],
  D: ['guitar', 'purifier', 'figure', 'cattower'],
  E: ['headphone', 'golf', 'stroller', 'monitor', 'ipad', 'iphone'],
  F: ['guitar', 'golf', 'watch', 'tripod', 'ipad', 'camera'],
};

const WAVE3_CHATS = [
  {
    post: 'monitor',
    buyer: 'A',
    messages: [
      { from: 'A', minutes: 20, text: '모니터 아직 있나요? 댓글 드렸던 사람입니다.' },
      { from: 'F', minutes: 19, text: '네 있습니다. 지금 켜져 있는 상태예요.' },
      { from: 'F', minutes: 18, photo: ['computer-monitor', 303] },
      { from: 'A', minutes: 16, text: '깔끔하네요. 12만 5천원에 가능할까요?' },
      { from: 'A', minutes: 15, offer: 125000, status: 'accepted' },
      { from: 'F', minutes: 13, text: '좋습니다. 오늘 저녁 8시 우체국 앞 어떠세요?' },
      { from: 'A', minutes: 12, text: '네 그때 뵐게요!' },
      { from: 'A', minutes: 6, text: '잘 받았습니다. 연결해보니 화면 아주 좋네요.' },
    ],
    trade: {
      soldMinutes: 5,
      reviews: [
        {
          from: 'A',
          score: 0.5,
          tags: ['시간 약속을 잘 지켜요', '상품 상태가 설명한 그대로예요'],
          comment: '먼저 나와 계셨고 케이블까지 챙겨주셨어요. 설명 그대로였습니다.',
          minutes: 4,
        },
        {
          from: 'F',
          score: 0.5,
          tags: ['응답이 빨라요', '친절하고 매너가 좋아요'],
          comment: '연락 잘 되시고 약속대로 오셔서 편하게 거래했습니다.',
          minutes: 3,
        },
      ],
    },
  },
  {
    post: 'guitar',
    buyer: 'B',
    messages: [
      { from: 'B', minutes: 50, text: '기타 보고 연락드립니다. 이번 주말에 볼 수 있을까요?' },
      { from: 'E', minutes: 48, text: '네 주말 좋습니다. 오시면 같이 쳐봐요.' },
      { from: 'E', minutes: 47, photo: ['acoustic-guitar', 393] },
      { from: 'B', minutes: 44, text: '상태 좋아 보이네요. 8만원 어떠세요?' },
      { from: 'B', minutes: 43, offer: 80000, status: 'pending' },
    ],
  },
  {
    post: 'golf',
    buyer: 'F',
    messages: [
      { from: 'F', minutes: 85, text: '아이언 세트 아직 있을까요?' },
      { from: 'B', minutes: 83, text: '네 있습니다. 그립 갈아서 상태 괜찮아요.' },
      { from: 'F', minutes: 80, text: '23만원에 가능하실까요? 오늘 차 가지고 갈 수 있습니다.' },
      { from: 'F', minutes: 79, offer: 230000, status: 'accepted' },
      { from: 'B', minutes: 76, text: '좋습니다. 근린공원 입구에서 6시에 뵐까요?' },
      { from: 'F', minutes: 74, text: '네 그때 가겠습니다.' },
      { from: 'F', minutes: 40, photo: ['golf-clubs', 442] },
      { from: 'F', minutes: 39, text: '잘 받았습니다! 내일 연습장 가보려고요.' },
    ],
    trade: {
      soldMinutes: 38,
      reviews: [
        {
          from: 'F',
          score: 0.5,
          tags: ['친절하고 매너가 좋아요', '상품 상태가 설명한 그대로예요'],
          comment: '그립 상태까지 설명하신 그대로였고 잡는 법도 알려주셨어요.',
          minutes: 35,
        },
      ],
    },
  },
  {
    post: 'headphone',
    buyer: 'E',
    messages: [
      { from: 'E', minutes: 450, text: '헤드폰 보고 연락드려요. 배터리 사이클 확인 가능할까요?' },
      { from: 'C', minutes: 448, text: '앱에서 보이는 건 없고 체감으로는 스무 시간 넘게 갑니다.' },
      { from: 'E', minutes: 445, text: '(이 줄은 보낸 사람이 지웠습니다)', deleted: true },
      { from: 'E', minutes: 440, text: '10만원에 가능할까요?' },
      { from: 'E', minutes: 439, offer: 100000, status: 'cancelled' },
      { from: 'E', minutes: 437, text: '아 죄송해요, 방금 건 잘못 눌렀습니다. 11만원으로 다시 여쭤볼게요.' },
      { from: 'C', minutes: 430, text: '11만원이면 좋습니다. 이문동으로 오실 수 있나요?' },
    ],
  },
  {
    post: 'airfryer',
    buyer: 'D',
    messages: [
      { from: 'D', minutes: 120, text: '에어프라이어 3만원에 안 될까요?' },
      { from: 'D', minutes: 119, offer: 30000, status: 'rejected' },
      { from: 'F', minutes: 115, text: '거의 안 쓴 거라 3만 5천원은 받고 싶습니다. 죄송해요!' },
      { from: 'D', minutes: 110, text: '알겠습니다. 조금 더 생각해볼게요.' },
    ],
  },
  {
    post: 'stroller',
    buyer: 'E',
    reservePost: true,
    messages: [
      { from: 'E', minutes: 280, text: '유모차 보고 연락드려요. 다음 주 토요일에 가지러 가도 될까요?' },
      { from: 'D', minutes: 276, text: '네 좋습니다. 그때까지 예약해둘게요.' },
      { from: 'E', minutes: 270, photo: ['stroller', 512] },
      { from: 'E', minutes: 269, text: '저희 차 트렁크가 이 정도인데 들어갈까요?' },
      { from: 'D', minutes: 265, text: '넉넉히 들어갑니다. 접는 법은 그때 알려드릴게요.' },
    ],
  },
  {
    post: 'boardgame',
    buyer: 'A',
    messages: [
      { from: 'A', minutes: 190, text: '보드게임 다섯 개 다 가져가고 싶은데 오늘 가능할까요?' },
      { from: 'E', minutes: 188, text: '네 저녁 이후면 언제든 좋습니다.' },
      { from: 'A', minutes: 150, text: '방금 잘 받았습니다. 부품도 다 확인했어요!' },
    ],
    trade: {
      soldMinutes: 148,
      reviews: [
        {
          from: 'A',
          score: 0.5,
          tags: ['응답이 빨라요', '친절하고 매너가 좋아요'],
          comment: '설명서까지 정리해서 주셨어요. 다음에도 거래하고 싶습니다.',
          minutes: 140,
        },
        {
          from: 'E',
          score: 0.1,
          tags: ['시간 약속을 잘 지켜요'],
          comment: '약속 시간 정확하게 오셨습니다.',
          minutes: 135,
        },
      ],
    },
  },
  {
    post: 'vinyl',
    buyer: 'F',
    messages: [
      { from: 'F', minutes: 2200, text: 'LP 목록 좀 볼 수 있을까요?' },
      { from: 'C', minutes: 2190, photo: ['vinyl-record', 502] },
      { from: 'C', minutes: 2188, text: '이렇게 열 장입니다. 재즈가 절반이에요.' },
      { from: 'F', minutes: 2180, text: '좋네요. 그대로 가져가겠습니다.' },
      { from: 'F', minutes: 2000, text: '잘 받았습니다. 오늘 저녁에 들어보려고요.' },
    ],
    trade: {
      soldMinutes: 1990,
      reviews: [
        {
          from: 'F',
          score: 0.1,
          tags: ['응답이 빨라요'],
          comment: '사진도 바로 보내주시고 약속 잡기 편했습니다.',
          minutes: 1980,
        },
      ],
    },
  },
  {
    post: 'tent',
    buyer: 'C',
    messages: [
      { from: 'C', minutes: 720, text: '텐트 방수는 다시 먹이신 적 있나요?' },
      { from: 'B', minutes: 715, photo: ['camping-tent', 453] },
      { from: 'B', minutes: 713, text: '따로 안 했는데 아직 물 잘 튕겨냅니다. 이렇게 보관했어요.' },
      { from: 'C', minutes: 700, text: '알겠습니다. 주말에 다시 연락드릴게요!' },
    ],
  },
  {
    post: 'figure',
    buyer: 'D',
    messages: [
      { from: 'D', minutes: 700, text: '피규어 4만원에 가능할까요?' },
      { from: 'D', minutes: 699, offer: 40000, status: 'pending' },
    ],
  },
  {
    post: 'sneakers',
    buyer: 'C',
    messages: [
      { from: 'C', minutes: 500, text: '운동화 밑창 사진 한 장만 볼 수 있을까요?' },
      { from: 'F', minutes: 495, photo: ['sneakers', 332] },
      { from: 'F', minutes: 493, text: '이 정도입니다. 두 번 신은 게 맞아요.' },
      { from: 'C', minutes: 480, text: '깨끗하네요! 생각해보고 다시 연락드릴게요.' },
    ],
  },
  {
    post: 'cattower',
    buyer: 'F',
    messages: [
      { from: 'F', minutes: 3400, text: '캣타워 아직 있나요? 이웃이라 가지러 가기 편할 것 같아요.' },
      { from: 'E', minutes: 3390, text: '네 있습니다. 해체해두면 혼자서도 들 수 있어요.' },
      { from: 'F', minutes: 3380, text: '좋습니다. 이번 주 안에 연락드릴게요!' },
    ],
  },
  {
    post: 'speaker',
    buyer: 'B',
    messages: [{ from: 'B', minutes: 240, text: '스피커 아직 있을까요? 답변 주시면 바로 가겠습니다.' }],
  },
  {
    post: 'purifier',
    buyer: 'A',
    messages: [
      { from: 'A', minutes: 1700, text: '공기청정기 필터 갈아 끼우는 게 어렵진 않죠?' },
      { from: 'E', minutes: 1690, text: '뚜껑 열고 넣기만 하면 됩니다. 30초면 돼요.' },
      { from: 'A', minutes: 1600, text: '감사합니다! 주말에 가지러 갈게요.' },
    ],
  },
  // 앞선 판의 글에서 새로 열리는 방. 오래된 글도 계속 살아 있다.
  {
    post: 'ipad',
    buyer: 'F',
    messages: [
      { from: 'F', minutes: 10, text: '아이패드 아직 있나요? 댓글도 남겼습니다.' },
      { from: 'A', minutes: 9, text: '네 아직 있어요. 오늘 저녁 괜찮으세요?' },
      { from: 'F', minutes: 8, text: '좋습니다. 23만원에 가능할까요?' },
      { from: 'F', minutes: 7, offer: 230000, status: 'pending' },
    ],
  },
  {
    post: 'iphone',
    buyer: 'E',
    messages: [
      { from: 'E', minutes: 36, text: '아이폰 아직 판매하시나요? 자급제 맞는지만 확인하고 싶어요.' },
      { from: 'B', minutes: 34, text: '네 자급제 맞습니다. 통신사 상관없이 쓰실 수 있어요.' },
      { from: 'E', minutes: 30, text: '감사합니다. 다른 분이 먼저 제안하셨다고 하셨는데 그쪽 답 오면 알려주세요!' },
      { from: 'B', minutes: 28, text: '네 오늘 안에 정리되면 바로 알려드릴게요.' },
    ],
  },
  {
    post: 'coffee',
    buyer: 'E',
    messages: [
      { from: 'E', minutes: 2580, text: '나눔 받고 싶습니다! 오늘 저녁에 갈 수 있어요.' },
      { from: 'A', minutes: 2570, text: '네 우체국 앞에서 뵐게요. 드리퍼랑 서버, 저울까지 한 세트입니다.' },
      { from: 'E', minutes: 2400, photo: ['coffee-maker', 42] },
      { from: 'E', minutes: 2398, text: '잘 받았습니다. 오늘 아침에 처음 내려봤어요. 감사합니다!' },
    ],
    trade: {
      soldMinutes: 2395,
      reviews: [
        {
          from: 'E',
          score: 0.5,
          tags: ['좋은 가격에 나눔해 주셨어요', '친절하고 매너가 좋아요'],
          comment: '나눔인데도 내리는 방법까지 알려주셨어요. 덕분에 커피 시작합니다.',
          minutes: 2390,
        },
        {
          from: 'A',
          score: 0.5,
          tags: ['시간 약속을 잘 지켜요'],
          comment: '약속 시간 정확히 오셨고 잘 쓰시겠다고 해주셔서 기분 좋았습니다.',
          minutes: 2380,
        },
      ],
    },
  },
];

// ---------------------------------------------------------------------------
// 판 목록
//
// 같은 판을 두 번 돌리면 **같은 글이 두 벌** 생긴다. 그래서 "더 심는 것"을 판으로 나눠 적고
// 부를 때 번호를 준다. 뒤 판은 앞 판의 글에도 말을 붙일 수 있다 —
// 앞 판의 글은 제목으로 되짚는다(`findPlantedPosts`).
// ---------------------------------------------------------------------------

const WAVES = [
  { posts: POSTS, comments: COMMENTS, likes: LIKES, recent: RECENT, chats: CHATS },
  { posts: MORE_POSTS, comments: MORE_COMMENTS, likes: MORE_LIKES, recent: MORE_RECENT, chats: MORE_CHATS },
  { posts: WAVE3_POSTS, comments: WAVE3_COMMENTS, likes: WAVE3_LIKES, recent: WAVE3_RECENT, chats: WAVE3_CHATS },
];

// ---------------------------------------------------------------------------
// 심기
// ---------------------------------------------------------------------------

/**
 * 자리 이름. 이야기는 A·B·C…로 적고 실제 계정은 실행할 때 붙인다.
 *
 * 처음에는 넷으로 못 박혀 있었는데(`['A','B','C','D']`), 계정이 여섯이 되자 **다섯째부터는
 * 아예 이야기에 낄 수 없는** 상태가 됐다 — 새로 가입한 사람으로 로그인하면 화면이 텅 빈다.
 * 그래서 자리를 넉넉히 두고 **있는 만큼만 채운다.**
 */
const PEOPLE_SLOTS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

const MIN_PEOPLE = 2;

async function resolvePeople(admin, uuids) {
  const columns =
    'id, nickname, region_code, dong_name, region_depth1, region_depth2, region_depth3, location_lat, location_lng, onboarded_at';

  const query = admin.from('profiles').select(columns);
  const { data, error } = uuids.length > 0 ? await query.in('id', uuids) : await query.not('onboarded_at', 'is', null);

  if (error !== null) {
    fail('계정을 읽는 중', error);
  }

  // 거래는 **둘 이상**이어야 성립한다. 하나뿐이면 자기 글에 자기가 채팅을 여는 꼴이 되는데
  // `posts_buyer_is_not_seller`가 그것을 막는다 — 심다가 죽느니 여기서 세운다.
  if (data.length < MIN_PEOPLE) {
    console.error(`온보딩(동네 설정)을 마친 계정이 둘 이상이어야 한다. 지금 ${data.length}개다.`);
    process.exit(1);
  }

  if (data.length > PEOPLE_SLOTS.length) {
    console.error(`자리는 ${PEOPLE_SLOTS.length}개까지다. 지금 ${data.length}개라 PEOPLE_SLOTS를 늘려야 한다.`);
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

  for (const [index, profile] of ordered.entries()) {
    if (profile === undefined || profile.region_code === null) {
      console.error('전부 온보딩(동네 설정)을 마친 계정이어야 한다.');
      process.exit(1);
    }

    people[PEOPLE_SLOTS[index]] = profile;
  }

  return people;
}

/** 지금 자리에 앉은 사람들. 심는 쪽은 이 순서로 훑는다. */
function peopleKeys(people) {
  return PEOPLE_SLOTS.filter(function seated(key) {
    return people[key] !== undefined;
  });
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

async function seedPosts(admin, people, manifest, definitions) {
  const byKey = {};

  for (const post of definitions) {
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

  const photoCount = definitions.reduce(function add(sum, post) {
    return sum + post.photos.length;
  }, 0);

  console.log(`글 ${definitions.length}개 · 물건 사진 ${photoCount}장`);

  return byKey;
}

async function seedLikesAndViews(admin, people, posts, likeDefinitions, recentDefinitions) {
  const likes = [];

  // 가리키는 글이 없으면 건너뛴다 — 두 번째 판이 첫 판의 글을 가리키는데 그 글이
  // 사람 손에 지워졌을 수 있다.
  for (const like of likeDefinitions) {
    if (posts[like.post] === undefined) {
      continue;
    }

    for (const who of like.users) {
      likes.push({ post_id: posts[like.post].id, user_id: people[who].id });
    }
  }

  await insertMany(admin, 'likes', likes, '찜 심기');

  const views = [];

  for (const who of Object.keys(recentDefinitions)) {
    for (const [index, key] of recentDefinitions[who].entries()) {
      if (posts[key] === undefined) {
        continue;
      }

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

async function seedComments(admin, people, posts, threads) {
  let count = 0;

  for (const thread of threads) {
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

  const secretCount = threads.filter(function isSecret(thread) {
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
async function seedChats(admin, people, posts, manifest, chats) {
  let messageCount = 0;
  let chatPhotoCount = 0;
  let reviewCount = 0;

  for (const chat of chats) {
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
    `채팅방 ${chats.length}개 · 메시지 ${messageCount}개 (채팅 사진 ${chatPhotoCount}장) · 후기 ${reviewCount}개`,
  );
}

async function printSummary(admin, people) {
  console.log('\n트리거가 쌓은 것:');

  for (const key of peopleKeys(people)) {
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

/**
 * 이미 심어 둔 글을 제목으로 찾는다.
 *
 * 두 번째 판(`--more`)의 댓글·채팅 중에는 **첫 판의 글에 붙는 것**이 있다. 글 하나에 시간을
 * 두고 말이 쌓이는 모습은 그래야 나온다.
 *
 * 목록(`.seedStory.json`)은 id만 적고 어느 글인지는 안 적는다. 그래서 제목으로 되짚는데,
 * **못 찾으면 조용히 건너뛴다** — 사람이 지운 글일 수 있고, 그때 시드가 멈출 이유는 없다.
 */
async function findPlantedPosts(admin, people, definitions) {
  const byKey = {};

  for (const post of definitions) {
    const owner = people[post.owner];

    // 그 자리에 앉은 사람이 없으면 그 글은 애초에 안 심겼다.
    if (owner === undefined) {
      continue;
    }

    const { data, error } = await admin
      .from('posts')
      .select('id')
      .eq('seller_id', owner.id)
      .eq('title', post.title)
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error !== null) {
      fail(`이미 심은 글 찾기 (${post.title})`, error);
    }

    if (data !== null) {
      byKey[post.key] = { id: data.id, ownerKey: post.owner, ownerId: owner.id };
    }
  }

  return byKey;
}

/** 뒤 판이 앞 판의 글을 가리키는데 그 글이 없어졌을 때. 그 줄만 뺀다. */
function onlyPlanted(items, posts, describe) {
  return items.filter(function isPlanted(item) {
    if (posts[item.post] !== undefined) {
      return true;
    }

    console.log(`  건너뜀 — ${describe(item)} (가리키는 글이 없다)`);
    return false;
  });
}

/**
 * **아직 없는 자리**를 가리키는 줄을 뺀다.
 *
 * 이야기는 여섯 자리(A~F)로 적혀 있는데 계정이 넷뿐인 판도 있다. 그때 E가 쓴 댓글을
 * 그냥 심으면 `people['E']`가 `undefined`라 그 자리에서 죽는다 — 계정 수는 사람이
 * 정하는 것이니 **시드가 맞춰야 한다.**
 */
function onlyPresentPeople(items, people, keysOf, describe) {
  return items.filter(function isSeated(item) {
    const missing = keysOf(item).filter(function absent(key) {
      return people[key] === undefined;
    });

    if (missing.length === 0) {
      return true;
    }

    console.log(`  건너뜀 — ${describe(item)} (${[...new Set(missing)].join('·')} 자리가 비었다)`);
    return false;
  });
}

/** 찜은 줄 통째로가 아니라 **사람 단위로** 뺀다. 한 사람이 없다고 나머지 관심까지 지울 이유가 없다. */
function onlyPresentLikes(likes, people) {
  const kept = [];

  for (const like of likes) {
    const users = like.users.filter(function seated(key) {
      return people[key] !== undefined;
    });

    if (users.length > 0) {
      kept.push({ post: like.post, users });
    }
  }

  return kept;
}

/** 최근 본 글도 사람 단위다. 없는 사람의 칸만 덜어낸다. */
function onlyPresentRecent(recent, people) {
  const kept = {};

  for (const key of Object.keys(recent)) {
    if (people[key] !== undefined) {
      kept[key] = recent[key];
    }
  }

  return kept;
}

function commentPeopleKeys(thread) {
  return [
    thread.author,
    ...thread.replies.map(function toAuthor(reply) {
      return reply.author;
    }),
  ];
}

function chatPeopleKeys(chat) {
  const reviews = chat.trade === undefined ? [] : chat.trade.reviews;

  return [
    chat.buyer,
    ...chat.messages.map(function toSender(message) {
      return message.from;
    }),
    ...reviews.map(function toReviewer(review) {
      return review.from;
    }),
  ];
}

function loadManifest(people) {
  const ids = Object.values(people).map(function toId(person) {
    return person.id;
  });

  if (existsSync(MANIFEST_PATH)) {
    const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));

    // 계정이 늘어난 뒤의 판도 있다. 목록에 없던 사람을 이어 적는다.
    manifest.profileIds = [...new Set([...manifest.profileIds, ...ids])];

    return manifest;
  }

  return {
    seededAt: new Date().toISOString(),
    profileIds: ids,
    postIds: [],
    storage: { [POST_IMAGE_BUCKET]: [], [CHAT_IMAGE_BUCKET]: [], [AVATAR_BUCKET]: [] },
  };
}

async function seed(admin, uuids, waveNumber) {
  const people = await resolvePeople(admin, uuids);
  const keys = peopleKeys(people);
  const wave = WAVES[waveNumber - 1];

  console.log(`\n사람 ${keys.length}명 (${waveNumber}번째 판을 심는다):`);
  for (const key of keys) {
    console.log(`  ${key}  ${people[key].nickname}  ${people[key].dong_name}`);
  }
  console.log('');

  // 목록은 **이어 쓴다.** 새로 쓰면 앞 판이 심은 것을 치울 방법이 없어진다.
  const manifest = loadManifest(people);

  // 없는 자리를 가리키는 줄은 먼저 덜어낸다 — 심다가 `undefined`로 죽는 것을 막는다.
  const definitions = onlyPresentPeople(
    wave.posts,
    people,
    function postPeopleKeys(post) {
      return [post.owner];
    },
    function describePost(post) {
      return `글 (${post.title})`;
    },
  );
  const comments = onlyPresentPeople(wave.comments, people, commentPeopleKeys, function describeComment(thread) {
    return `댓글 (${thread.post})`;
  });
  const chats = onlyPresentPeople(wave.chats, people, chatPeopleKeys, function describeChat(chat) {
    return `채팅 (${chat.post})`;
  });
  const likes = onlyPresentLikes(wave.likes, people);
  const recent = onlyPresentRecent(wave.recent, people);

  try {
    await seedAvatars(admin, people, manifest);

    // 뒤 판은 앞 판의 글에도 말을 붙인다. 그래서 이미 심은 글과 새 글을 함께 들고 간다.
    const earlier = WAVES.slice(0, waveNumber - 1).flatMap(function toPosts(item) {
      return item.posts;
    });
    const planted = earlier.length > 0 ? await findPlantedPosts(admin, people, earlier) : {};
    const posts = { ...planted, ...(await seedPosts(admin, people, manifest, definitions)) };

    await seedLikesAndViews(admin, people, posts, likes, recent);
    await seedComments(
      admin,
      people,
      posts,
      onlyPlanted(comments, posts, function describeComment(thread) {
        return `댓글 (${thread.post})`;
      }),
    );
    await seedChats(
      admin,
      people,
      posts,
      manifest,
      onlyPlanted(chats, posts, function describeChat(chat) {
        return `채팅 (${chat.post})`;
      }),
    );
  } finally {
    // 중간에 실패해도 **여기까지 심은 것**은 치울 수 있어야 한다.
    writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  }

  await printSummary(admin, people);

  console.log('\n계정마다 로그인해서 보면 된다. 같은 글도 사람마다 다르게 보인다.');

  if (waveNumber < WAVES.length) {
    console.log(`더 심으려면  npm run seed:story -- --wave ${waveNumber + 1}`);
  }

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

  // **심은 프로필 사진만** 뗀다. 목록의 사람 전부를 지우면 사람이 직접 올린 사진까지
  // 날아간다(넷 중 둘은 실제로 자기 사진이었다). 심은 파일 경로가 `<id>/seed-avatar.jpg`라
  // 앞머리가 곧 그 사람이다.
  const avatarOwners = manifest.storage[AVATAR_BUCKET].map(function toOwnerId(path) {
    return path.split('/')[0];
  });

  if (avatarOwners.length > 0) {
    const { error: avatarError } = await admin
      .from('profiles')
      .update({ avatar_url: null })
      .in('id', avatarOwners);

    if (avatarError !== null) {
      fail('프로필 사진 떼기', avatarError);
    }
  }

  unlinkSync(MANIFEST_PATH);

  console.log(`\n글 ${removed.length}개와 딸린 것들, 사진, 심은 프로필 사진 ${avatarOwners.length}장을 치웠다.`);
  console.log('계정 자체는 그대로다 — 사람이 로그인하는 계정이라 지우지 않는다.\n');
}

/**
 * `--more`는 두 번째 판을 뜻하던 옛 이름이다. 판이 셋이 되면서 번호를 받게 됐지만
 * 손에 익은 이름이라 그대로 둔다 — 부르는 쪽을 고치게 만들 이유가 없다.
 */
function parseArgs(argv) {
  const uuids = [];
  let wave = 1;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--more') {
      wave = 2;
    } else if (arg === '--wave') {
      wave = Number(argv[index + 1]);
      index += 1;
    } else if (arg.startsWith('--wave=')) {
      wave = Number(arg.slice('--wave='.length));
    } else if (!arg.startsWith('--')) {
      uuids.push(arg);
    }
  }

  return { uuids, wave };
}

async function main() {
  loadEnvLocal();

  const admin = createClient(requireEnv(URL_ENV), requireEnv(SERVICE_ROLE_ENV), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const args = process.argv.slice(2);

  if (args.includes('--clean')) {
    await clean(admin);
    return;
  }

  const { uuids, wave } = parseArgs(args);

  if (!Number.isInteger(wave) || wave < 1 || wave > WAVES.length) {
    console.error(`판 번호는 1부터 ${WAVES.length}까지다. 받은 값: ${wave}`);
    process.exit(1);
  }

  await seed(admin, uuids, wave);
}

await main();
