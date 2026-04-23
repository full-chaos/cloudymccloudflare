import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

// JWKS fetcher per team domain — cached in module scope so repeated requests
// within the same isolate reuse jose's internal HTTP cache instead of refetching
// Cloudflare Access public keys on every request.
const jwksByTeam = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getJwks(teamDomain: string) {
  let jwks = jwksByTeam.get(teamDomain);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${teamDomain}/cdn-cgi/access/certs`));
    jwksByTeam.set(teamDomain, jwks);
  }
  return jwks;
}

export async function verifyCfAccessJwt(
  token: string,
  teamDomain: string,
  audience: string,
): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwks(teamDomain), {
      issuer: teamDomain,
      audience,
    });
    return payload;
  } catch {
    return null;
  }
}
