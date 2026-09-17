import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js@2";

// ============================================================================
// bybit-private Edge Function  (DRAFT — NOT YET DEPLOYED)
//
// PHASE 1 SCOPE ONLY. This is the ONLY component that would talk to Bybit's
// private/authenticated API. It never returns BYBIT_API_KEY / BYBIT_API_SECRET
// to any caller, and the frontend never calls Bybit directly.
//
// AUTHORIZATION (security fix): "api_key_info", "wallet_balance", and "diag"
// all expose information about the platform's SHARED Bybit account (UID,
// permissions, IP allowlist, balances, secret-configuration state). Being
// logged in to CEO Exchange is NOT sufficient authorization for any of that.
// All three actions now require the caller to pass the existing
// is_current_user_admin() check — the same admin/ops authorization mechanism
// already used by get-kyc-document-url and the rest of the admin surface
// (backed by public.profiles.role = 'admin' OR public.admin_users). No new
// role system was invented for this.
//
// What this phase intentionally DOES:
//   GET  ping           -> public connectivity check (Bybit server time only
//                           — no credentials involved, nothing account-
//                           specific, safe to leave unauthenticated exactly
//                           like kraken-spot's "ping")
//   GET  diag           -> ADMIN ONLY — non-sensitive config check
//                           (key/secret present?) but gated anyway since
//                           even "is a secret configured" is unnecessary
//                           information for an ordinary user
//   GET  api_key_info   -> ADMIN ONLY — signed GET /v5/user/query-api
//   GET  wallet_balance -> ADMIN ONLY — signed GET /v5/account/wallet-balance
//
// What this phase intentionally does NOT do (deliberately out of scope —
// see the audit report for why):
//   - place_order / cancel_order / reconcile are NOT implemented here.
//     Doing that safely requires a DB migration (orders.execution_venue
//     CHECK constraint currently only allows 'internal' | 'kraken') and new
//     Bybit-specific settlement RPCs mirroring settle_kraken_fill /
//     link_kraken_order_id / finalize_kraken_order_cancel. That migration
//     has NOT been applied — this function does not touch it.
//   - No IP-restricted key handling / static-IP proxy (explicitly deferred).
// ============================================================================

const BYBIT_API_URL = "https://api.bybit.com";
const BYBIT_API_KEY = Deno.env.get("BYBIT_API_KEY") ?? "";
const BYBIT_API_SECRET = Deno.env.get("BYBIT_API_SECRET") ?? "";
const RECV_WINDOW = "5000";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

// ---------------------------------------------------------------------------
// Bybit V5 private REST signing
// (per bybit-exchange.github.io/docs/v5/guide#authentication)
//   sign = HMAC_SHA256(timestamp + apiKey + recvWindow + queryStringOrBody, secret)
// ---------------------------------------------------------------------------
async function bybitSign(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function bybitPrivateGet(path: string, params: Record<string, string> = {}) {
  if (!BYBIT_API_KEY || !BYBIT_API_SECRET) {
    throw new Error("BYBIT_CREDENTIALS_NOT_CONFIGURED");
  }
  const timestamp = Date.now().toString();
  const qs = new URLSearchParams(params).toString();
  const signPayload = timestamp + BYBIT_API_KEY + RECV_WINDOW + qs;
  const sign = await bybitSign(signPayload, BYBIT_API_SECRET);

  const res = await fetch(`${BYBIT_API_URL}${path}${qs ? `?${qs}` : ""}`, {
    method: "GET",
    headers: {
      "X-BAPI-API-KEY": BYBIT_API_KEY,
      "X-BAPI-TIMESTAMP": timestamp,
      "X-BAPI-RECV-WINDOW": RECV_WINDOW,
      "X-BAPI-SIGN": sign,
      "User-Agent": "ceo-exchange-bybit-private/1.0",
    },
  });
  const json = await res.json();
  // Never log the request headers (they carry the sign/timestamp tied to the
  // secret-derived HMAC) and never log the response body (account info) —
  // only the Bybit-reported retCode/retMsg surface on error.
  if (json.retCode !== 0) {
    throw new Error(`BYBIT_PRIVATE_ERROR(${json.retCode}): ${json.retMsg ?? "unknown"}`);
  }
  return json.result;
}

async function bybitPublicGet(path: string, params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${BYBIT_API_URL}${path}${qs ? `?${qs}` : ""}`, {
    headers: { "User-Agent": "ceo-exchange-bybit-private/1.0" },
  });
  const json = await res.json();
  if (json.retCode !== 0) {
    throw new Error(`BYBIT_PUBLIC_ERROR(${json.retCode}): ${json.retMsg ?? "unknown"}`);
  }
  return json.result;
}

// ---------------------------------------------------------------------------
// Supabase client (mirrors kraken-spot's pattern)
// ---------------------------------------------------------------------------
function userClient(authHeader: string): SupabaseClient {
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: authHeader } },
  });
}

// ---------------------------------------------------------------------------
// Authorization: reuse the EXISTING admin mechanism (is_current_user_admin(),
// already relied on by get-kyc-document-url and the rest of the admin
// surface) rather than inventing a new role system. Never logs the JWT/
// Authorization header — only ever the resulting true/false and, on
// rejection, a generic error message.
// ---------------------------------------------------------------------------
async function requireAdmin(authHeader: string): Promise<string> {
  if (!authHeader) throw new AuthError("NOT_AUTHENTICATED", 401);
  const uc = userClient(authHeader);
  const { data: userData, error: userErr } = await uc.auth.getUser();
  if (userErr || !userData?.user) throw new AuthError("NOT_AUTHENTICATED", 401);

  const { data: isAdmin, error: adminErr } = await uc.rpc("is_current_user_admin");
  if (adminErr) throw new AuthError("AUTHORIZATION_CHECK_FAILED", 500);
  if (isAdmin !== true) throw new AuthError("NOT_AUTHORIZED", 403);

  return userData.user.id;
}

class AuthError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

// ---------------------------------------------------------------------------
// HTTP entrypoint
// ---------------------------------------------------------------------------
Deno.serve(async (req: Request) => {
  try {
    const url = new URL(req.url);
    const authHeader = req.headers.get("Authorization") ?? "";

    if (req.method === "GET") {
      const action = url.searchParams.get("action");

      if (action === "ping") {
        // Public Bybit server time only — no credentials, no account data.
        const t = await bybitPublicGet("/v5/market/time");
        return jsonResponse({ ok: true, bybit_time: t });
      }

      if (action === "diag") {
        await requireAdmin(authHeader);
        // Non-sensitive config check only — never returns the actual key/secret values.
        return jsonResponse({
          bybit_api_key_configured: BYBIT_API_KEY.length > 0,
          bybit_api_secret_configured: BYBIT_API_SECRET.length > 0,
        });
      }

      if (action === "api_key_info") {
        await requireAdmin(authHeader);
        const info = await bybitPrivateGet("/v5/user/query-api");
        const permissions = info?.permissions ?? {};
        const hasWithdraw =
          Array.isArray(permissions.Withdraw) && permissions.Withdraw.length > 0;
        return jsonResponse({
          uid: info?.userID ?? null,
          note: info?.note ?? null,
          ips: info?.ips ?? null,
          permissions,
          has_withdraw_permission: hasWithdraw,
          expected_no_withdraw_permission: !hasWithdraw,
        });
      }

      if (action === "wallet_balance") {
        await requireAdmin(authHeader);
        const accountType = url.searchParams.get("accountType") ?? "UNIFIED";
        const result = await bybitPrivateGet("/v5/account/wallet-balance", { accountType });
        return jsonResponse(result);
      }

      return jsonResponse({ error: "unknown action" }, 400);
    }

    // No POST actions in this phase (no order placement/cancellation yet).
    return jsonResponse({ error: "method not allowed" }, 405);
  } catch (e) {
    if (e instanceof AuthError) {
      // Generic message only — never confirms/denies account details, never
      // echoes back anything from the Authorization header.
      return jsonResponse({ error: e.message }, e.status);
    }
    // Never leak credentials; only ever surface the error message text.
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});
