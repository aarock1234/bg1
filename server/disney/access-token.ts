import { z } from 'zod';

const JWT_PART_COUNT = 3;

const accessTokenClaimsSchema = z.object({
  // When the token was issued and when it expires, in seconds since 1970.
  iat: z.number().optional(),
  exp: z.number().optional(),

  // The OneID client the guest logged in through.
  client_id: z.string().optional(),
});

export type AccessTokenClaims = z.infer<typeof accessTokenClaimsSchema>;

// Reads the claims of an access token that is a JWT, without verifying its
// signature. Returns no claims for any other kind of token.
export function accessTokenClaims(accessToken: string): AccessTokenClaims {
  const parts = accessToken.split('.');
  const [, payload] = parts;

  if (parts.length !== JWT_PART_COUNT || !payload) {
    return {};
  }

  try {
    const json = Buffer.from(payload, 'base64url').toString('utf8');

    return accessTokenClaimsSchema.parse(JSON.parse(json));
  } catch {
    return {};
  }
}
