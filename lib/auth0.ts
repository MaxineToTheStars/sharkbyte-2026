import { Auth0Client } from "@auth0/nextjs-auth0/server";

export const auth0 = new Auth0Client({
  domain: process.env.AUTH0_DOMAIN!,
  clientId: process.env.AUTH0_CLIENT_ID!,
  clientSecret: process.env.AUTH0_CLIENT_SECRET!,
  secret: process.env.AUTH0_SECRET!,
  appBaseUrl: process.env.APP_BASE_URL!,
  // The gateway returns 502 once response headers pass ~2.3KB. A stateless
  // session with access, id, and refresh tokens lands near 3.7KB of Set-Cookie.
  async beforeSessionSaved(session) {
    return {
      user: {
        sub: session.user.sub,
        name: session.user.name,
        email: session.user.email,
      },
      tokenSet: {
        accessToken: "",
        expiresAt: session.tokenSet.expiresAt,
      },
      internal: session.internal,
    };
  },
});
