import { NextResponse, type NextRequest } from "next/server";
import { auth0Ready, blockedWithoutAuth } from "@/lib/auth-gate";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Empty AUTH0_DOMAIN makes auth0.middleware throw DomainResolutionError.
  if (!auth0Ready()) {
    if (blockedWithoutAuth(pathname)) {
      return new NextResponse("Auth0 is not configured", {
        status: 503,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }
    return NextResponse.next();
  }

  const { auth0 } = await import("@/lib/auth0");
  const authRes = await auth0.middleware(request);

  if (pathname.startsWith("/auth")) {
    return authRes;
  }

  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) {
    const session = await auth0.getSession(request);
    if (!session) {
      const { origin } = new URL(request.url);
      return NextResponse.redirect(
        `${origin}/auth/login?returnTo=${pathname}`,
      );
    }
  }

  return authRes;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
