import type { UserRole } from "@/lib/types";

/**
 * RBAC 정책 정의 (클라이언트/서버 공용 — 비밀 정보 없음).
 *
 * "권한 → 허용 기능" 매핑을 한 곳에 모아, 사이드바 메뉴 노출·페이지 가드·
 * 금액 마스킹이 항상 같은 정책을 참조하도록 한다.
 */

/** 권한 서열 — 상위 권한은 하위 권한의 기능을 모두 포함한다 */
const ROLE_LEVEL: Record<UserRole, number> = {
  VIEWER: 0,
  OPERATOR: 1,
  ADMIN: 2,
};

/** minRole 이상인지 검사 */
export function hasRole(userRole: UserRole, minRole: UserRole): boolean {
  return ROLE_LEVEL[userRole] >= ROLE_LEVEL[minRole];
}

/** 민감 재무 금액 열람 가능 여부 — VIEWER는 마스킹 처리 대상 */
export function canViewAmounts(role: UserRole): boolean {
  return hasRole(role, "OPERATOR");
}

/** 대사 확정/재실행 등 데이터 변경(Mutation) 가능 여부 */
export function canMutate(role: UserRole): boolean {
  return hasRole(role, "OPERATOR");
}

/**
 * 금액 마스킹.
 * 권한이 없으면 자릿수조차 노출하지 않도록 고정 길이 마스크를 반환한다.
 */
export function maskAmount(
  formatted: string,
  role: UserRole,
): string {
  return canViewAmounts(role) ? formatted : "₩ ***,***";
}
