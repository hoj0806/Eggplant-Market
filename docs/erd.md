# ERD — EggPlant Market

전체 컬럼·제약은 [`../supabase/migrations/0001_init.sql`](../supabase/migrations/0001_init.sql) 참고.
아래는 테이블 관계 요약(mermaid). GitHub 등에서 렌더링됨.

```mermaid
erDiagram
    profiles ||--o{ posts            : "판매(seller_id)"
    profiles ||--o{ likes            : ""
    profiles ||--o{ comments         : "작성(author_id)"
    profiles ||--o{ recently_viewed  : ""
    profiles ||--o{ notifications    : ""
    profiles ||--o{ reports          : "신고(reporter_id)"
    profiles ||--o{ reviews          : "작성/대상"
    profiles ||--o{ blocks           : "차단(blocker/blocked)"

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
        geography location "동네 좌표"
        text    dong_name
        int     search_radius_m
    }
    posts {
        bigint      id PK
        uuid        seller_id FK
        text        title
        int         price
        bigint      category_id FK
        post_status status
        geography   location
        int         view_count
        timestamptz bumped_at "정렬 기준"
    }
    chat_rooms {
        bigint id PK
        bigint post_id FK
        uuid   buyer_id FK
        uuid   seller_id FK
    }
    messages {
        bigint       id PK
        bigint       room_id FK
        uuid         sender_id FK
        message_type type "text/image/price_offer"
        int          offer_amount
        offer_status offer_status
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
