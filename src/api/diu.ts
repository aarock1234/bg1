import forge from 'node-forge';

const PUBLIC_KEY_STRING =
  '-----BEGIN PUBLIC KEY-----MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAofk7tvl26d48HL0if2gE8uPt18KJHDOQ7WZr4lsiiEisu3BrPwkGM6y8VJzOZLgak3foNLkMOxFwtP9wOECM9QPaOMeReTGNpv+9y496UnYON3WiRGUgdPrMOG+Q75kWsZHrpvbdGoF35dQqAXAaM7yAKOgeMX7vfHltK4sWcn7MX3K64oBJFPDnfWgcbEVevyfA3ARZ/Gt2PeGPqJjdIYDVYiRxF/fTgC60GejRbNPP8AkFBTZ42k13aKuL/Own2fsdYPpJl1RoJyg2gIOWP8j3S2IjWEMBwDUf3vC2KqlqSKL6uztl7+hjeMjD8hjhDz89W0WcXZg74SvG0rp6/wIDAQAB-----END PUBLIC KEY-----';
const PUBLIC_KEY_VERSION = '2';

export type SignedPayload = {
  disneyInternalUse01: string;
  disneyInternalUse02: string;
  disneyInternalUse03: string;
};

function Uint8ArrayToString(arrayBuffer: ArrayBuffer): string {
  return String.fromCharCode(...new Uint8Array(arrayBuffer));
}

// Generates a "disney internal use" payload for a given offer ID
export default async function diu(offerId: string): Promise<SignedPayload> {
  const aesKey = await window.crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 128,
    },
    true,
    ['encrypt']
  );
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const encryptedPayload = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    aesKey,
    new TextEncoder().encode(offerId)
  );

  const disneyInternalUse01 = btoa(
    [iv, encryptedPayload].map(Uint8ArrayToString).join('')
  );

  const rsaKey = forge.pki.publicKeyFromPem(PUBLIC_KEY_STRING);

  const disneyInternalUse03 = btoa(
    rsaKey.encrypt(
      Uint8ArrayToString(await window.crypto.subtle.exportKey('raw', aesKey))
    )
  );

  return {
    disneyInternalUse01,
    disneyInternalUse02: PUBLIC_KEY_VERSION,
    disneyInternalUse03,
  };
}
