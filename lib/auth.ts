import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";
import type { SessionUser, UserRole } from "@/lib/types";

/**
 * 세션 사용자 조회 (서버 전용).
 *
 * 데모에서는 `x-demo-role` 쿠키로 권한을 전환해 RBAC 분기를 시연한다.
 * 실제 환경에서는 이 함수만 IdP(SSO)/세션 스토어 연동으로 교체하면
 * 레이아웃·페이지의 권한 분기 로직은 그대로 재사용된다.
 *
 * Next.js 16: `cookies()`는 비동기 API — 반드시 await 해야 한다.
 * React `cache()`로 감싸 한 요청 안에서 여러 번 호출해도 1회만 평가된다.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser> => {
  const cookieStore = await cookies();
  const roleCookie = cookieStore.get("x-demo-role")?.value?.toUpperCase();

  const role: UserRole =
    roleCookie === "OPERATOR" || roleCookie === "VIEWER"
      ? roleCookie
      : "ADMIN";

  return {
    id: "emp-20240627",
    name: "정민식",
    email: "minsik.jeong@newselect.co.kr",
    department: "FIS팀",
    role,
  };
});
