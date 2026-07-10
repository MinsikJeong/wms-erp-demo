/**
 * 공통 타입 — 인증/권한 (RBAC).
 * WMS 도메인 타입은 lib/wms/types.ts 참조.
 */

/** 사내 인트라넷 권한 등급 */
export const USER_ROLES = ["ADMIN", "OPERATOR", "VIEWER"] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** 세션 사용자 — 실제 환경에서는 IdP/세션 쿠키에서 복원된다 */
export interface SessionUser {
  id: string;
  name: string;
  email: string;
  department: string;
  role: UserRole;
}
