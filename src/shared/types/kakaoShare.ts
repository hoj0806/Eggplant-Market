/**
 * 카카오톡 공유 SDK 중 **이 앱이 쓰는 만큼만** 적는다.
 *
 * `kakaoMaps.ts`와 같은 태도다 — 전체 타입을 받아 오면 안 쓰는 것까지 따라오고,
 * 카카오가 SDK를 고칠 때마다 우리 타입이 흔들린다.
 */

/** 피드 템플릿. 카드 하나 + 버튼 하나짜리 가장 단순한 모양이다. */
export type KakaoFeedTemplate = {
  objectType: 'feed';
  content: {
    title: string;
    description: string;
    imageUrl: string;
    link: { mobileWebUrl: string; webUrl: string };
  };
  buttons: Array<{
    title: string;
    link: { mobileWebUrl: string; webUrl: string };
  }>;
};

export type KakaoShareNamespace = {
  init(appKey: string): void;
  isInitialized(): boolean;
  Share: {
    sendDefault(settings: KakaoFeedTemplate): void;
  };
};

declare global {
  interface Window {
    /**
     * 공유 SDK가 붙는 자리. **지도 SDK의 `window.kakao`와 다른 객체다**
     * (그쪽은 소문자 `kakao`, 이쪽은 대문자 `Kakao`).
     */
    Kakao?: KakaoShareNamespace;
  }
}
