"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { track } from "@/lib/firebase";

/**
 * 페이지 이동을 Firebase에 알립니다.
 * Next.js는 화면을 갈아 끼울 뿐 새로고침을 하지 않아서, 직접 보내지 않으면
 * 첫 페이지 하나만 집계됩니다.
 */
export function Analytics() {
  const pathname = usePathname();

  useEffect(() => {
    track("page_view", {
      page_path: pathname,
      page_location: window.location.href,
      page_title: document.title,
    });
  }, [pathname]);

  return null;
}
