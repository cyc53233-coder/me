import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  // 상품 이미지는 쇼핑몰 도메인에서 직접 옵니다. next/image 대신 <img>를 쓰는
  // 이유는 README「왜 next/image를 안 쓰나」에 적어 두었습니다.
};

export default nextConfig;

// next dev 에서도 Cloudflare 바인딩(env, KV, R2 …)을 그대로 쓰게 해 줍니다.
initOpenNextCloudflareForDev();
