# ERD — EggPlant Market

전체 컬럼·제약은 [`../supabase/migrations/`](../supabase/migrations/)의 각 파일 참고.
아래는 테이블 관계 요약(mermaid). GitHub 등에서 렌더링됨.

```mermaid
erDiagram
    profiles ||--o{ posts            : "판매(seller_id)"
    profiles ||--o{ posts            : "구매/예약(buyer_id)"
    profiles ||--o{ likes            : ""
    profiles ||--o{ comments         : "작성(author_id)"
    profiles ||--o{ recently_viewed  : ""
    profiles ||--o{ notifications    : ""
    profiles ||--o{ reports          : "신고(reporter_id)"
    profiles ||--o{ reviews          : "작성/대상"
    profiles ||--o{ blocks           : "차단(blocker/blocked)"

    categories ||--o{ categories     : "대분류→소분류(parent_id)"
    categories ||--o{ posts          : "분류"

    posts ||--o{ post_images         : ""
    posts ||--o{ likes               : ""
    posts ||--o{ comments            : ""
    posts ||--o{ chat_rooms          : ""
    posts ||--o{ reviews             : ""
    posts ||--o{ recently_viewed     : ""

    chat_rooms ||--o{ messages       : ""
    comments  ||--o{ comments        : "대댓글(parent_id)"

    profiles {
        uuid    id PK "= auth.users.id"
        text    nickname
        numeric manner_temp "기본 36.5"
        geography location "동네 대표 좌표(0003)"
        text    dong_name
        text    region_code "법정동 코드, 같은 동네 판별 기준(0003)"
        text    region_depth1_3 "시도/시군구/읍면동(0003)"
        float8  location_lat_lng "생성 컬럼(0003)"
        int     search_radius_m
        timestamptz onboarded_at "온보딩 완료(0002)"
    }
    posts {
        bigint      id PK
        uuid        seller_id FK
        uuid        buyer_id FK "예약자 또는 구매자(0008)"
        text        title
        int         price
        bigint      category_id FK "소분류"
        post_status status
        geography   location "판매자 동네 대표 좌표"
        geography   trade_location "거래희망장소(0005)"
        text        region_code "동네 목록의 기준(0005)"
        int         view_count
        int         like_count "likes 트리거가 유지(0005)"
        timestamptz sold_at "거래완료 시각(0008)"
        timestamptz bumped_at "정렬 기준"
    }
    chat_rooms {
        bigint      id PK
        bigint      post_id FK
        uuid        buyer_id FK
        uuid        seller_id FK
        text        last_message "메시지 트리거가 유지"
        timestamptz last_message_at
    }
    messages {
        bigint       id PK
        bigint       room_id FK
        uuid         sender_id FK
        message_type type "text/image/price_offer"
        text         content "text면 내용, image면 저장 경로"
        int          offer_amount
        offer_status offer_status
        timestamptz  read_at "안 읽은 수의 기준"
    }
    reviews {
        bigint  id PK
        uuid    reviewer_id FK
        uuid    reviewee_id FK
        numeric score "매너온도 가감"
    }
```

## 열거형(Enum)

| Enum | 값 |
|---|---|
| `post_status` | selling · reserved · sold |
| `message_type` | text · image · price_offer |
| `offer_status` | pending · accepted · rejected |
| `notification_type` | comment · like · chat · review · price_offer |
| `report_target` | post · user |

## 거래 상태 전이

`enforce_post_status_transition` 트리거(0008)가 지킨다. 화면의
`post/utils/postStatusTransition.ts`가 같은 규칙을 들고 있다.

```
판매중 ⇄ 예약중 → 거래완료(종착점, 되돌릴 수 없음)
```

- 예약중·거래완료로 갈 때 `buyer_id`를 함께 정한다(고르지 않아도 된다).
- 판매중으로 돌아오면 트리거가 `buyer_id`를 지운다.
- 거래완료가 되면 트리거가 `sold_at`을 찍는다.

## 저장소(Storage)

| 버킷 | 공개 | 용량 | 경로 규칙 |
|---|---|---|---|
| `avatars` (0002) | 공개 | 2MB | `{user_id}/…` |
| `post-images` (0005) | 공개 | 5MB | `{user_id}/…` |
| `chat-images` (0008) | **비공개** | 5MB | `{room_id}/{user_id}/…` |

`chat-images`만 비공개다. 1:1 대화 내용이라 URL을 아는 사람 누구나 볼 수 있으면 안 된다.
방 참여자만 읽을 수 있고, 앱은 볼 때마다 서명 URL을 만든다.

## Realtime

`supabase_realtime` publication에 `messages`·`chat_rooms`가 들어 있다(0008).
구독은 RLS를 그대로 타므로 남의 방 메시지는 흘러가지 않는다.
