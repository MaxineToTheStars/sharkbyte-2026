const AUTH_ENV = [
  "AUTH0_DOMAIN",
  "AUTH0_CLIENT_ID",
  "AUTH0_CLIENT_SECRET",
  "AUTH0_SECRET",
  "APP_BASE_URL",
] as const;

export function auth0Ready(
  env: { [key: string]: string | undefined } = process.env,
): boolean {
  return AUTH_ENV.every((name) => Boolean(env[name]?.trim()));
}

export function blockedWithoutAuth(pathname: string): boolean {
  return (
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname === "/auth" ||
    pathname.startsWith("/auth/")
  );
}
