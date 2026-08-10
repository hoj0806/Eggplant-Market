/**
 * 화면을 눈으로 확인하려면 **볼 것이 있어야 한다.**
 *
 * `npm run seed -- <내 uuid>`   심는다
 * `npm run seed -- --clean`     심은 것만 치운다
 *
 * 왜 필요한가
 * ----------
 * 밀려 있는 화면 확인 아홉 건 중 절반 이상이 **데이터가 없어 확인 자체가 불가능**했다.
 * 채팅방 0 · 댓글 0 · 후기 0 · 알림 0이면 그 화면들은 전부 빈 상태만 보여준다.
 * 알림 "모두 삭제" 버튼은 알림이 없으면 **버튼 자체가 안 뜬다.**
 *
 * 왜 로그인할 수 있는 계정을 새로 못 만드나
 * --------------------------------------
 * 로그인이 카카오·구글뿐이라 **심은 계정으로는 화면에 들어갈 수 없다.** 그래서 이 스크립트는
 * "데모 계정을 만들어 그걸로 보라"가 아니라 **이미 로그인하는 계정 주변에 이웃과 사건을
 * 심는다.** 보는 사람은 평소 쓰던 카카오 계정으로 그대로 들어가면 된다.
 *
 * 알림은 심지 않는다
 * -----------------
 * 댓글·찜·메시지·후기를 심으면 **트리거가 알아서 알림을 쌓는다**(0001 · 0015 · 0018).
 * 알림 행을 직접 넣으면 트리거가 만드는 것과 모양이 달라져, 화면이 진짜로 도는지 못 본다.
 *
 * 치우는 규칙은 통합 테스트 픽스처와 같다 — **심은 것만 치운다.**
 * 사람이 화면에서 만든 글과 섞이므로 "전부 지우기"는 쓸 수 없다.
 */

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

/** 심은 글을 한눈에 알아보는 표. 치울 때도 이 표로 찾는다. */
const TAG = '[데모]';

/** 심은 계정의 메일 도메인. 치울 때 이 도메인으로 찾는다. */
const DEMO_DOMAIN = 'demo.eggplant.test';

const SERVICE_ROLE_ENV = 'SUPABASE_SERVICE_ROLE_KEY';
const URL_ENV = 'VITE_SUPABASE_URL';

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

/** insert 한 줄. 실패하면 그 자리에서 세운다 — 반쯤 심긴 상태가 가장 헷갈린다. */
async function insertOne(admin, table, row, label) {
  const { data, error } = await admin.from(table).insert(row).select('id').single();

  if (error !== null) {
    fail(`${label} (${table})`, error);
  }

  return data.id;
}

/**
 * 볼 사람을 정한다.
 *
 * 인자로 uuid를 주면 그것을 쓰고, 안 주면 **온보딩까지 끝난 계정이 딱 하나일 때만**
 * 그것을 고른다. 둘 이상이면 고르지 않고 멈춘다 — 남의 계정 주변에 심는 것은
 * 조용히 일어나면 안 되는 일이다.
 */
async function resolveViewer(admin, argument) {
  if (argument !== undefined) {
    const { data, error } = await admin
      .from('profiles')
      .select('id, nickname, region_code, dong_name, region_depth1, region_depth2, region_depth3, location_lat, location_lng')
      .eq('id', argument)
      .maybeSingle();

    if (error !== null) {
      fail('계정을 찾는 중', error);
    }
    if (data === null) {
      console.error(`그런 계정이 없다: ${argument}`);
      process.exit(1);
    }

    return data;
  }

  const { data, error } = await admin
    .from('profiles')
    .select('id, nickname, region_code, dong_name, region_depth1, region_depth2, region_depth3, location_lat, location_lng')
    .not('onboarded_at', 'is', null);

  if (error !== null) {
    fail('계정 목록을 읽는 중', error);
  }
  if (data.length !== 1) {
    console.error(`온보딩을 마친 계정이 ${data.length}개다. 누구 주변에 심을지 uuid로 정해 달라.\n`);
    for (const profile of data) {
      console.error(`  ${profile.id}  ${profile.nickname}  ${profile.dong_name ?? '(동네 없음)'}`);
    }
    process.exit(1);
  }

  return data[0];
}

function toRegionColumns(viewer) {
  return {
    region_code: viewer.region_code,
    dong_name: viewer.dong_name,
    location: `SRID=4326;POINT(${viewer.location_lng} ${viewer.location_lat})`,
  };
}

/** 이웃 하나. 같은 동네라야 목록에 함께 뜬다. */
async function createNeighbor(admin, viewer, nickname) {
  const suffix = Math.random().toString(36).slice(2, 8);

  const { data, error } = await admin.auth.admin.createUser({
    email: `demo-${suffix}@${DEMO_DOMAIN}`,
    password: `demo-${suffix}-${Date.now()}`,
    email_confirm: true,
  });

  if (error !== null) {
    fail(`이웃 계정 만들기 (${nickname})`, error);
  }

  // handle_new_user 트리거가 profiles 행을 이미 만들었다. 온보딩만 채운다.
  const { error: profileError } = await admin
    .from('profiles')
    .update({
      nickname,
      ...toRegionColumns(viewer),
      region_depth1: viewer.region_depth1,
      region_depth2: viewer.region_depth2,
      region_depth3: viewer.region_depth3,
      search_radius_m: 2000,
      onboarded_at: new Date().toISOString(),
    })
    .eq('id', data.user.id);

  if (profileError !== null) {
    fail(`이웃 온보딩 (${nickname})`, profileError);
  }

  return { id: data.user.id, nickname };
}

const MINUTE = 60 * 1000;

function minutesAgo(minutes) {
  return new Date(Date.now() - minutes * MINUTE).toISOString();
}

/**
 * 심을 글.
 *
 * 열 개인 이유는 **격자**다. 768px에서 2열, 1280px에서 3열이 되는지 보려면 줄이 여러 개
 * 나와야 한다. 가격·카테고리·시간을 흩어 두어 정렬과 "3분 전" 문구도 함께 보인다.
 */
const POSTS = [
  { title: '자취방 정리 · 미니 냉장고', price: 45000, categoryId: 19, minutes: 4 },
  { title: '아이패드 9세대 64GB', price: 250000, categoryId: 14, minutes: 25 },
  { title: '닌텐도 스위치 OLED', price: 290000, categoryId: 17, minutes: 90 },
  { title: '접이식 원목 책상', price: 30000, categoryId: 24, minutes: 200 },
  { title: '무선 이어폰 (거의 새것)', price: 55000, categoryId: 18, minutes: 400 },
  { title: '캠핑 의자 두 개', price: 20000, categoryId: 13, minutes: 800 },
  { title: '드립 커피 세트 나눔', price: 0, categoryId: 20, minutes: 1500 },
  { title: '기계식 키보드 청축', price: 68000, categoryId: 15, minutes: 2600 },
];

/**
 * 보는 사람 소유로 심을 글. 넷인 이유는 **글마다 맡는 확인이 다르기** 때문이다.
 *
 *   0  댓글·비밀 댓글 실타래   (판매중으로 둔다)
 *   1  채팅 · 대기 중인 가격 제안 (판매중으로 둔다 — 거래완료된 글에 제안이 떠 있으면 어색하다)
 *   2  거래완료 → 받은 후기
 *   3  거래완료 → 받은 후기 (둘이라야 매너온도 이력에 줄이 두 개 생긴다)
 */
const MY_POSTS = [
  { title: '거실 스탠드 조명', price: 18000, categoryId: 23, minutes: 60 },
  { title: '전자레인지 (직거래만)', price: 25000, categoryId: 20, minutes: 1200 },
  { title: '캔들 워머 새것', price: 22000, categoryId: 23, minutes: 3000 },
  { title: '스탠딩 옷걸이', price: 15000, categoryId: 22, minutes: 4200 },
];

async function seed(admin, viewerArgument) {
  const viewer = await resolveViewer(admin, viewerArgument);

  if (viewer.region_code === null) {
    console.error('그 계정은 아직 동네를 안 정했다. 온보딩을 먼저 끝내야 목록에 함께 뜬다.');
    process.exit(1);
  }

  console.log(`\n${viewer.nickname} (${viewer.id})`);
  console.log(`${viewer.dong_name} 주변에 심는다.\n`);

  const neighborOne = await createNeighbor(admin, viewer, '석관동단골');
  const neighborTwo = await createNeighbor(admin, viewer, '이문동토박이');
  console.log(`이웃 둘: ${neighborOne.nickname} · ${neighborTwo.nickname}`);

  const region = toRegionColumns(viewer);
  const neighborPostIds = [];

  for (const [index, post] of POSTS.entries()) {
    const sellerId = index % 2 === 0 ? neighborOne.id : neighborTwo.id;
    const id = await insertOne(
      admin,
      'posts',
      {
        seller_id: sellerId,
        title: `${TAG} ${post.title}`,
        description: `${post.title} 팝니다. 화면 확인용으로 심은 글이라 실제 거래는 아닙니다.`,
        price: post.price,
        category_id: post.categoryId,
        view_count: (index + 1) * 7,
        created_at: minutesAgo(post.minutes),
        bumped_at: minutesAgo(post.minutes),
        ...region,
      },
      `이웃 글 심기 (${post.title})`,
    );
    neighborPostIds.push({ id, sellerId });
  }

  const myPostIds = [];

  for (const post of MY_POSTS) {
    const id = await insertOne(
      admin,
      'posts',
      {
        seller_id: viewer.id,
        title: `${TAG} ${post.title}`,
        description: `${post.title} 팝니다. 화면 확인용으로 심은 글이라 실제 거래는 아닙니다.`,
        price: post.price,
        category_id: post.categoryId,
        view_count: 12,
        created_at: minutesAgo(post.minutes),
        bumped_at: minutesAgo(post.minutes),
        ...region,
      },
      `내 글 심기 (${post.title})`,
    );
    myPostIds.push(id);
  }

  console.log(`글 ${neighborPostIds.length + myPostIds.length}개 (내 글 ${myPostIds.length}개)`);

  // 찜 — like_count가 오르고 찜 알림이 온다(0018).
  for (const postId of myPostIds) {
    const { error } = await admin
      .from('likes')
      .insert([
        { post_id: postId, user_id: neighborOne.id },
        { post_id: postId, user_id: neighborTwo.id },
      ]);

    if (error !== null) {
      fail('찜 심기', error);
    }
  }

  // 내가 남의 글을 찜한 것도 하나 — /my/likes가 비어 있지 않게.
  await admin.from('likes').insert({ post_id: neighborPostIds[1].id, user_id: viewer.id });

  // 댓글 — 공개 1단 + 답글, 그리고 비밀 댓글 실타래.
  // 비밀 댓글은 **판매자와 실타래를 연 사람만** 본다(0033). 보는 사람이 판매자라야 확인된다.
  const openComment = await insertOne(
    admin,
    'comments',
    { post_id: myPostIds[0], author_id: neighborOne.id, content: '아직 판매 중인가요?' },
    '공개 댓글',
  );
  await insertOne(
    admin,
    'comments',
    { post_id: myPostIds[0], author_id: viewer.id, parent_id: openComment, content: '네 그대로 있습니다!' },
    '공개 답글',
  );
  const secretComment = await insertOne(
    admin,
    'comments',
    {
      post_id: myPostIds[0],
      author_id: neighborTwo.id,
      content: '혹시 조금 깎아 주실 수 있을까요? 비밀로 여쭤봅니다.',
      is_secret: true,
    },
    '비밀 댓글',
  );
  await insertOne(
    admin,
    'comments',
    {
      post_id: myPostIds[0],
      author_id: viewer.id,
      parent_id: secretComment,
      content: '메시지 주시면 이야기해 볼게요.',
      is_secret: true,
    },
    '비밀 답글',
  );
  console.log('댓글 4개 (공개 실타래 하나 · 비밀 실타래 하나)');

  // 채팅방 둘 — 내가 파는 방 하나, 내가 사는 방 하나.
  // 두 자리에서 보이는 것이 다르다(나가기 문구 · 가격 제안 버튼).
  const sellingRoom = await insertOne(
    admin,
    'chat_rooms',
    { post_id: myPostIds[1], buyer_id: neighborOne.id, seller_id: viewer.id },
    '내가 파는 방',
  );
  const buyingRoom = await insertOne(
    admin,
    'chat_rooms',
    { post_id: neighborPostIds[2].id, buyer_id: viewer.id, seller_id: neighborPostIds[2].sellerId },
    '내가 사는 방',
  );

  const messages = [
    { room_id: sellingRoom, sender_id: neighborOne.id, type: 'text', content: '안녕하세요! 아직 있나요?', created_at: minutesAgo(40) },
    { room_id: sellingRoom, sender_id: viewer.id, type: 'text', content: '네 있습니다. 언제 편하세요?', created_at: minutesAgo(38) },
    { room_id: sellingRoom, sender_id: neighborOne.id, type: 'text', content: '오늘 저녁 7시쯤 괜찮을까요?', created_at: minutesAgo(35) },
    { room_id: sellingRoom, sender_id: neighborOne.id, type: 'price_offer', offer_amount: 20000, offer_status: 'pending', created_at: minutesAgo(34) },
    { room_id: buyingRoom, sender_id: viewer.id, type: 'text', content: '스위치 아직 판매하시나요?', created_at: minutesAgo(20) },
    { room_id: buyingRoom, sender_id: neighborPostIds[2].sellerId, type: 'text', content: '네! 석관동 편의점 앞에서 거래 가능해요.', created_at: minutesAgo(18) },
    { room_id: buyingRoom, sender_id: viewer.id, type: 'text', content: '이 줄은 지워 보세요 — 삭제 확인용입니다.', created_at: minutesAgo(15) },
  ];

  const { error: messageError } = await admin.from('messages').insert(messages);

  if (messageError !== null) {
    fail('메시지 심기', messageError);
  }
  console.log(`채팅방 2개 · 메시지 ${messages.length}개 (대기 중인 가격 제안 하나)`);

  // 거래완료 + 후기 — 매너온도 이력(0034)이 여기서 생긴다.
  //
  // 순서가 규칙이다. **방이 먼저** 있어야 buyer_id를 박을 수 있다(guard_post_buyer, 0035) —
  // "거래 상대는 채팅한 사람 중에서만"을 트리거가 지키기 때문이다. 방 없이 팔면 거절당한다.
  const TRADES = [
    {
      postId: myPostIds[2],
      buyer: neighborTwo,
      lastWord: '잘 쓸게요, 감사합니다!',
      score: 0.5,
      tags: ['시간 약속을 잘 지켜요', '친절하고 매너가 좋아요'],
      comment: '시간 딱 맞춰 나오셨어요. 다음에 또 거래하고 싶습니다.',
      minutes: 600,
    },
    {
      postId: myPostIds[3],
      buyer: neighborOne,
      lastWord: '방금 받았습니다. 감사해요!',
      score: 0.1,
      tags: ['응답이 빨라요'],
      comment: '답장이 빨라서 편했습니다.',
      minutes: 2400,
    },
  ];

  for (const trade of TRADES) {
    const room = await insertOne(
      admin,
      'chat_rooms',
      { post_id: trade.postId, buyer_id: trade.buyer.id, seller_id: viewer.id },
      '거래완료된 방',
    );

    const { error: lastWordError } = await admin.from('messages').insert({
      room_id: room,
      sender_id: trade.buyer.id,
      type: 'text',
      content: trade.lastWord,
      created_at: minutesAgo(trade.minutes),
    });

    if (lastWordError !== null) {
      fail('거래완료된 방의 메시지', lastWordError);
    }

    const { error: soldError } = await admin
      .from('posts')
      .update({ status: 'sold', buyer_id: trade.buyer.id })
      .eq('id', trade.postId);

    if (soldError !== null) {
      fail('거래완료로 바꾸기', soldError);
    }

    // 후기는 **받는 쪽**이 보는 사람이어야 매너온도 이력이 생긴다.
    const { error: reviewError } = await admin.from('reviews').insert({
      post_id: trade.postId,
      reviewer_id: trade.buyer.id,
      reviewee_id: viewer.id,
      score: trade.score,
      manner_tags: trade.tags,
      comment: trade.comment,
      created_at: minutesAgo(trade.minutes - 30),
    });

    if (reviewError !== null) {
      fail('후기 심기', reviewError);
    }
  }

  console.log(`거래완료 ${TRADES.length}건 · 받은 후기 ${TRADES.length}개 (매너온도가 올라간다)`);

  console.log('\n트리거가 쌓은 것:');
  await printSummary(admin, viewer);
}

async function printSummary(admin, viewer) {
  const { count } = await admin
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', viewer.id);

  const { data: profile } = await admin
    .from('profiles')
    .select('manner_temp')
    .eq('id', viewer.id)
    .single();

  console.log(`  알림 ${count ?? 0}줄 · 매너온도 ${profile?.manner_temp ?? '?'}`);
  console.log('\n이제 그 카카오 계정으로 로그인해서 design.md §8 순서대로 훑으면 된다.');
  console.log('치울 때는  npm run seed -- --clean\n');
}

async function clean(admin) {
  const { data: users, error } = await admin.auth.admin.listUsers({ perPage: 200 });

  if (error !== null) {
    fail('계정 목록을 읽는 중', error);
  }

  const demoUsers = users.users.filter(function isDemo(user) {
    return (user.email ?? '').endsWith(`@${DEMO_DOMAIN}`);
  });

  // 이웃을 지우면 그 사람의 글·댓글·채팅·후기가 cascade로 함께 사라진다(0001).
  // 후기가 사라지면 매너온도도 되돌아간다(0016) — 그것까지가 "치웠다"의 뜻이다.
  for (const user of demoUsers) {
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);

    if (deleteError !== null) {
      fail(`이웃 계정 지우기 (${user.email})`, deleteError);
    }
  }

  // 보는 사람 소유로 심은 글은 계정을 지울 수 없으니 표로 찾아 지운다.
  const { data: removed, error: postError } = await admin
    .from('posts')
    .delete()
    .like('title', `${TAG}%`)
    .select('id');

  if (postError !== null) {
    fail('심은 글 지우기', postError);
  }

  console.log(`\n이웃 ${demoUsers.length}명 · 남은 표 붙은 글 ${removed.length}개를 치웠다.`);
  console.log('사람이 화면에서 만든 것은 건드리지 않았다.\n');
}

async function main() {
  loadEnvLocal();

  const admin = createClient(requireEnv(URL_ENV), requireEnv(SERVICE_ROLE_ENV), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const argument = process.argv[2];

  if (argument === '--clean') {
    await clean(admin);
    return;
  }

  await seed(admin, argument);
}

await main();
