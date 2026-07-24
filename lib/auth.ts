import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";
import { getSupabaseAuthClient } from "@/lib/supabase/auth-server";
import type { SessionUser, UserRole } from "@/lib/types";

const VALID_ROLES: UserRole[] = ["ADMIN", "OPERATOR", "VIEWER"];

/** user_metadata.role을 안전하게 UserRole로 정규화 (미지정/오염 시 최소 권한) */
function normalizeRole(raw: unknown): UserRole {
  const upper = typeof raw === "string" ? raw.toUpperCase() : "";
  return VALID_ROLES.includes(upper as UserRole) ? (upper as UserRole) : "VIEWER";
}

/**
 * 세션 사용자 조회 (서버 전용, nullable).
 *
 * Supabase Auth의 인증 쿠키에서 사용자를 복원한다. 로그인하지 않았으면 null.
 * 권한(role)은 회원가입 시 user_metadata에 저장한 값을 사용한다 — 데모에서는
 * 가입 시 사용자가 역할을 선택해 권한별 화면을 체험한다.
 * (실서비스라면 역할은 서버/관리자가 부여하고 클라이언트 입력을 신뢰하지 않는다.)
 *
 * React `cache()`로 감싸 한 요청 안에서 여러 번 호출해도 1회만 평가된다.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await getSupabaseAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const meta = user.user_metadata ?? {};

  return {
    id: user.id,
    name:
      (typeof meta.name === "string" && meta.name.trim()) ||
      user.email?.split("@")[0] ||
      "사용자",
    email: user.email ?? "",
    department:
      (typeof meta.department === "string" && meta.department.trim()) || "FIS팀",
    role: normalizeRole(meta.role),
  };
});

/**
 * 세션 사용자 조회 (서버 전용, non-null 보장).
 *
 * 로그인하지 않은 상태로 보호 페이지/서버 액션에 진입하면 즉시 /login으로
 * redirect한다 — 기존 페이지들은 이 함수의 시그니처(항상 SessionUser 반환)에
 * 의존하므로 인증 도입 후에도 코드 수정이 필요 없다. (proxy가 1차로 막지만
 * Server Function 경로 누락에 대비한 최종 방어선이다.)
 */
export const getCurrentUser = cache(async (): Promise<SessionUser> => {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
});
