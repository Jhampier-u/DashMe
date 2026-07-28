import NextAuth from "next-auth";
import Spotify from "next-auth/providers/spotify";

// El origen por el que se sirve la aplicación, y el que ve Spotify. Tiene que
// ser la IP de loopback: Spotify rechaza `localhost` como redirect URI en apps
// nuevas. `AUTH_URL` puede venir con o sin la ruta base, así que se normaliza a
// solo el origen.
const PUBLIC_ORIGIN = (process.env.AUTH_URL ?? "http://127.0.0.1:3000")
  .replace(/\/api\/auth\/?$/, "")
  .replace(/\/$/, "");

/*
  Por qué se retiran AUTH_URL y NEXTAUTH_URL del entorno, medido y no supuesto.

  En esta versión de Next, `NextRequest` IGNORA la URL que se le pasa y siempre
  reporta `http://localhost:3000`, aunque la cabecera `Host` diga otra cosa:

    new NextRequest("http://127.0.0.1:3000/x", req).url  -> http://localhost:3000/x
    new Request(    "http://127.0.0.1:3000/x", req).url  -> http://127.0.0.1:3000/x

  `next-auth` aplica AUTH_URL con `new NextRequest(...)` (ver `reqWithEnvURL` en
  next-auth/lib/env.js), así que la reescritura se descarta en silencio. Eso es
  lo que hacía que AUTH_URL, NEXTAUTH_URL y la cabecera Host parecieran no
  servir de nada: no es que no se leyeran, es que el mecanismo que las aplica
  está roto en este Next.

  El sitio por el que sí se puede entrar es un `Request` plano — pero
  `reqWithEnvURL` solo lo deja pasar intacto cuando NO hay ninguna de las dos
  variables (si las hay, lee `req.nextUrl`, que un Request plano no tiene, y
  revienta). Por eso se leen aquí y se quitan: el origen lo imponen los
  manejadores de más abajo, que es el único punto donde sobrevive.

  Nada más del proyecto lee estas dos variables.
*/
delete process.env.AUTH_URL;
delete process.env.NEXTAUTH_URL;

const SPOTIFY_SCOPES = [
  "user-read-private",
  "user-read-email",
  "user-library-read",
  "user-library-modify",
  "playlist-read-private",
  "playlist-read-collaborative",
  "playlist-modify-private",
  "playlist-modify-public",
  "user-top-read",
  "user-read-recently-played",
  "user-follow-read",
  "user-follow-modify",
  "ugc-image-upload",
].join(" ");

async function refreshSpotifyToken(refreshToken: string) {
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization:
        "Basic " +
        Buffer.from(
          `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`,
        ).toString("base64"),
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) throw new Error("Failed to refresh Spotify token");
  return (await res.json()) as {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
  };
}

const nextAuth = NextAuth({
  trustHost: true,
  providers: [
    Spotify({
      clientId: process.env.SPOTIFY_CLIENT_ID,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
      checks: ["state"],
      authorization: {
        url: "https://accounts.spotify.com/authorize",
        // Sin `redirect_uri` explícito: Auth.js lo deriva del origen de la
        // petición, que los manejadores de abajo ya fijan en PUBLIC_ORIGIN.
        // Ponerlo a mano solo servía cuando ese origen salía mal.
        params: { scope: SPOTIFY_SCOPES },
      },
      token: "https://accounts.spotify.com/api/token",
      userinfo: "https://api.spotify.com/v1/me",
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = (account.expires_at ?? 0) * 1000;

        // Persistir el refresh token para que el cron pueda operar sin cookie.
        // El import es dinámico a propósito: `@/modules/core/db` arrastra better-sqlite3
        // (módulo nativo) y no debe acabar en ningún bundle que no sea Node.
        // Un fallo aquí no debe impedir el login: la app sigue funcionando por
        // navegador y /ajustes avisará de que la captura no está configurada.
        if (account.refresh_token) {
          try {
            const { saveCredentials } = await import(
              "@/modules/musica/lib/credentials"
            );
            await saveCredentials({
              spotifyUserId:
                (profile as { id?: string } | undefined)?.id ?? "me",
              refreshToken: account.refresh_token,
              accessToken: account.access_token ?? null,
              expiresAt: (account.expires_at ?? 0) * 1000,
            });
          } catch (e) {
            console.error("[auth] no se pudieron guardar las credenciales", e);
          }
        }

        return token;
      }

      if (Date.now() < (token.expiresAt as number) - 60_000) {
        return token;
      }

      try {
        const refreshed = await refreshSpotifyToken(
          token.refreshToken as string,
        );
        token.accessToken = refreshed.access_token;
        token.expiresAt = Date.now() + refreshed.expires_in * 1000;
        if (refreshed.refresh_token) token.refreshToken = refreshed.refresh_token;
        return token;
      } catch (e) {
        console.error("Token refresh failed", e);
        // No propagar el accessToken caduco: quien no revise `error` usaría un
        // token vencido y recibiría 401.
        return { ...token, accessToken: undefined, error: "RefreshTokenError" };
      }
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string;
      session.error = token.error as string | undefined;
      return session;
    },
  },
});

export const { auth, signIn, signOut } = nextAuth;

/**
 * Reconstruye la petición con el origen real antes de dársela a Auth.js.
 *
 * Es la pieza que arregla el login. Sin esto, Auth.js cree estar en
 * `localhost` aunque el navegador esté en `127.0.0.1`, y entonces:
 *
 *  - sirve la página de inicio de sesión con el formulario apuntando a
 *    `localhost`, así que el POST sale hacia otro host, la cookie CSRF no viaja
 *    y devuelve `MissingCSRF` sin llegar a hablar con Spotify;
 *  - y si se entra por `localhost` para esquivarlo, entonces Spotify devuelve a
 *    `127.0.0.1` —el único host que acepta— y la que falta es la cookie
 *    `state`.
 *
 * Los dos hosts fallaban, por motivos distintos. Fijando el origen, todo
 * —página, cookies, callback y canje de token— ocurre en `127.0.0.1`.
 *
 * El cuerpo se materializa en vez de reenviar el flujo: `Request` exige
 * `duplex` para pasar un stream, y las peticiones de auth son diminutas.
 */
async function conOrigenReal(req: Request): Promise<Request> {
  const { pathname, search } = new URL(req.url);
  const destino = new URL(pathname + search, PUBLIC_ORIGIN);

  const init: RequestInit = { method: req.method, headers: req.headers };
  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = await req.arrayBuffer();
  }
  return new Request(destino, init);
}

/*
  `nextAuth.handlers` está tipado para `NextRequest`, pero lo único que hace con
  la petición es leerla: la conversión es segura y es justo lo que permite
  colar un `Request` plano, que es el que conserva la URL.
*/
const manejar = nextAuth.handlers as unknown as {
  GET: (req: Request) => Promise<Response>;
  POST: (req: Request) => Promise<Response>;
};

export const handlers = {
  GET: async (req: Request) => manejar.GET(await conOrigenReal(req)),
  POST: async (req: Request) => manejar.POST(await conOrigenReal(req)),
};

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    error?: string;
  }
}

// Auth.js v5: `next-auth/jwt` solo reexporta `@auth/core/jwt` (donde vive
// `interface JWT`). Augmentar el reexport dispara TS2664 cuando el módulo
// `next-auth` ya está importado + el plugin de Next; se augmenta el módulo
// fuente y la ampliación se propaga a `next-auth/jwt` igual.
declare module "@auth/core/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number;
    error?: string;
  }
}
