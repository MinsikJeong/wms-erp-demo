"use server";

import { cookies } from "next/headers";
import type { UserRole } from "@/lib/types";

const VALID_ROLES: UserRole[] = ["ADMIN", "OPERATOR", "VIEWER"];

/**
 * 데모 권한 전환 (Server Action).
 *
 * `x-demo-role` 쿠키만 교체한다 — Next.js 16에서 Server Action이 쿠키를
 * 변경하면 현재 라우트가 같은 응답 안에서 자동 리렌더되므로, 클라이언트의
 * 추가 refresh 호출 없이 사이드바 메뉴·마스킹·페이지 가드가 즉시 반영된다.
 * (실서비스라면 IdP 세션 교체 지점 — 입력은 항상 화이트리스트로 검증한다.)
 */
export async function setDemoRole(role: string): Promise<void> {
  const normalized = role.toUpperCase() as UserRole;
  if (!VALID_ROLES.includes(normalized)) return;

  const cookieStore = await cookies();
  cookieStore.set("x-demo-role", normalized, {
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    sameSite: "lax",
  });
}
