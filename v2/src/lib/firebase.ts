"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAnalytics, isSupported, logEvent, type Analytics } from "firebase/analytics";

// Firebase 웹 설정은 전부 공개값입니다 — 브라우저에 그대로 나가도록 설계된
// 값이라 숨길 필요가 없습니다. (보호는 Firebase 보안 규칙이 담당합니다.)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// measurementId(G-XXXX)가 없으면 Analytics 자체가 못 켜집니다.
const configured = Boolean(firebaseConfig.apiKey && firebaseConfig.measurementId);

let analyticsPromise: Promise<Analytics | null> | null = null;

/**
 * Analytics 인스턴스를 한 번만 만들어 재사용합니다.
 * - 서버에서는 window가 없어 무조건 null 입니다.
 * - isSupported() 는 인앱 브라우저·시크릿 모드 등 지원하지 않는 환경을 걸러 줍니다.
 */
function analytics(): Promise<Analytics | null> {
  if (analyticsPromise) return analyticsPromise;

  analyticsPromise = (async () => {
    if (typeof window === "undefined" || !configured) return null;
    if (!(await isSupported())) return null;

    const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
    return getAnalytics(app);
  })().catch(() => null);

  return analyticsPromise;
}

/** 이벤트 하나 보내기. 실패해도 화면에는 아무 영향이 없어야 합니다. */
export async function track(name: string, params?: Record<string, unknown>) {
  const a = await analytics();
  if (a) logEvent(a, name, params);
}

/**
 * 딜 클릭. Firebase 권장 이커머스 이벤트 이름(select_item)을 그대로 써서
 * 콘솔의 기본 리포트에 잡히게 합니다.
 */
export function trackDealClick(deal: {
  id: string;
  title: string;
  price: number;
  category: string;
  mall: string;
}) {
  return track("select_item", {
    item_list_name: "deals",
    items: [
      {
        item_id: deal.id,
        item_name: deal.title,
        item_category: deal.category,
        item_brand: deal.mall,
        price: deal.price,
        currency: "KRW",
      },
    ],
  });
}
