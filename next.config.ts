import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Next.js 16은 dev 서버의 /_next/* 리소스에 대한 localhost 외 origin 요청을
   * 기본 차단한다. LAN IP·mDNS 호스트네임으로 접속(휴대폰 반응형 테스트 등)하면
   * JS 번들이 막혀 하이드레이션이 실패하므로 개발용 origin을 명시적으로 허용한다.
   * ⚠ DHCP로 IP가 바뀌면 이 목록도 갱신해야 한다.
   */
  allowedDevOrigins: ["192.168.45.35", "minsig-ui-mac-studio.local"],
};

export default nextConfig;
