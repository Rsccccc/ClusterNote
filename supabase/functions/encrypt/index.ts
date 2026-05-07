// Supabase Edge Function: encrypt
// Encrypts any JSON payload using AES-256-GCM with a server-side secret key.
// The client never sees the encryption key.

import { encode as base64Encode } from "https://deno.land/std@0.224.0/encoding/base64.ts";

const ENCRYPTION_KEY_B64 = Deno.env.get("ENCRYPTION_KEY");

if (!ENCRYPTION_KEY_B64) {
  console.error("ENCRYPTION_KEY environment secret is not set!");
}

async function getKey(): Promise<CryptoKey> {
  const raw = Uint8Array.from(atob(ENCRYPTION_KEY_B64!), (c) => c.charCodeAt(0));
  return await crypto.subtle.importKey(
    "raw",
    raw,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

async function encryptPayload(data: unknown): Promise<{ iv: string; ciphertext: string }> {
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit nonce
  const encoded = new TextEncoder().encode(JSON.stringify(data));

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded,
  );

  return {
    iv: base64Encode(iv),
    ciphertext: base64Encode(new Uint8Array(encrypted)),
  };
}

async function decryptPayload(iv: string, ciphertext: string): Promise<unknown> {
  const key = await getKey();
  const ivBytes = Uint8Array.from(atob(iv), (c) => c.charCodeAt(0));
  const ciphertextBytes = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0));

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ivBytes },
    key,
    ciphertextBytes,
  );

  return JSON.parse(new TextDecoder().decode(decrypted));
}

Deno.serve(async (req: Request) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Content-Type": "application/json",
  };

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Only POST requests are allowed" }),
      { status: 405, headers: corsHeaders },
    );
  }

  try {
    const body = await req.json();
    const { action, data, iv, ciphertext } = body;

    if (action === "encrypt") {
      if (data === undefined) {
        return new Response(
          JSON.stringify({ error: "Missing 'data' field" }),
          { status: 400, headers: corsHeaders },
        );
      }
      const result = await encryptPayload(data);
      return new Response(JSON.stringify({ success: true, ...result }), {
        status: 200,
        headers: corsHeaders,
      });
    }

    if (action === "decrypt") {
      if (!iv || !ciphertext) {
        return new Response(
          JSON.stringify({ error: "Missing 'iv' or 'ciphertext' field" }),
          { status: 400, headers: corsHeaders },
        );
      }
      const result = await decryptPayload(iv, ciphertext);
      return new Response(JSON.stringify({ success: true, data: result }), {
        status: 200,
        headers: corsHeaders,
      });
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use 'encrypt' or 'decrypt'" }),
      { status: 400, headers: corsHeaders },
    );
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: corsHeaders },
    );
  }
});
