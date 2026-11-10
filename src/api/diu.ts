import { bytesToBinaryString } from './crypto';

// Disney's RSA public key for the "disney internal use" booking fields.
const PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAofk7tvl26d48HL0if2gE8uPt18KJHDOQ7WZr4lsiiEisu3BrPwkGM6y8VJzOZLgak3foNLkMOxFwtP9wOECM9QPaOMeReTGNpv+9y496UnYON3WiRGUgdPrMOG+Q75kWsZHrpvbdGoF35dQqAXAaM7yAKOgeMX7vfHltK4sWcn7MX3K64oBJFPDnfWgcbEVevyfA3ARZ/Gt2PeGPqJjdIYDVYiRxF/fTgC60GejRbNPP8AkFBTZ42k13aKuL/Own2fsdYPpJl1RoJyg2gIOWP8j3S2IjWEMBwDUf3vC2KqlqSKL6uztl7+hjeMjD8hjhDz89W0WcXZg74SvG0rp6/wIDAQAB
-----END PUBLIC KEY-----`;

const PUBLIC_KEY_VERSION = '2';

const AES_KEY_BITS = 128;
const IV_LENGTH = 12;

// The fields Disneyland expects alongside an offer ID when booking: the offer
// ID encrypted with a one-time AES key, the public key version, and that AES
// key encrypted with Disney's public key.
export type DisneyInternalUseFields = {
  disneyInternalUse01: string;
  disneyInternalUse02: string;
  disneyInternalUse03: string;
};

export async function encryptOfferId(
  offerId: string
): Promise<DisneyInternalUseFields> {
  const offerKey = await crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: AES_KEY_BITS,
    },
    true,
    ['encrypt']
  );
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  const encryptedOfferId = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    offerKey,
    new TextEncoder().encode(offerId)
  );
  const encryptedOfferKey = await encryptWithPublicKey(
    await crypto.subtle.exportKey('raw', offerKey)
  );

  return {
    disneyInternalUse01: btoa(
      bytesToBinaryString(iv) + bytesToBinaryString(encryptedOfferId)
    ),
    disneyInternalUse02: PUBLIC_KEY_VERSION,
    disneyInternalUse03: btoa(encryptedOfferKey),
  };
}

// Web Crypto has no RSA PKCS#1 v1.5 encryption, so this needs node-forge. It
// is loaded on demand because only Disneyland bookings use it.
async function encryptWithPublicKey(bytes: ArrayBuffer): Promise<string> {
  const { pki } = await import('node-forge');
  const publicKey = pki.publicKeyFromPem(PUBLIC_KEY_PEM);

  return publicKey.encrypt(bytesToBinaryString(bytes));
}
