import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Proxy (Next.js 16에서 middleware의 새 이름 — 함수명도 `proxy`, Node.js 런타임 기본).
 *
 * 역할은 두 가지로 한정한다:
 *  1) 매 요청마다 Supabase 세션 쿠키를 갱신(refresh)해 만료를 방지한다.
 *  2) 낙관적(optimistic) 라우팅 가드 — 미인증은 /login으로, 인증된 사용자가
 *     로그인/회원가입 화면에 오면 대시보드로 보낸다.
 *
 * ⚠️ 공식 문서 권고대로 proxy는 최종 인가 수단이 아니다. 실제 접근 통제는
 *   각 페이지의 `getCurrentUser()`(세션 없으면 redirect)와 서버 액션의
 *   권한 검증이 담당한다 — proxy는 UX용 1차 방어선일 뿐이다.
 */
export async function proxy(request: NextRequest) {
  // getUser()가 토큰을 갱신하면 setAll로 새 쿠키가 request/response 양쪽에 실린다.
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getSession()이 아닌 getUser()로 검증 — 서버에서 토큰 진위를 실제로 확인한다.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isAuthRoute = pathname === "/login" || pathname === "/signup";

  // 미인증 사용자가 보호 라우트에 접근 → 로그인 화면으로
  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // 이미 로그인한 사용자가 로그인/회원가입 화면에 접근 → 대시보드로
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  /*
   * 정적 자산·이미지·favicon을 제외한 모든 경로에서 실행.
   * (matcher가 없으면 _next/static·이미지까지 가로채 CSS/JS 로딩을 막을 수 있다)
   */
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
