import React, { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "../../lib/supabase";
import { s, GOLD } from "./settingsStyles";
import { SIcon } from "./SettingsIcons";
import type { SettingsData } from "./Settings";

type Props = {
  data: SettingsData;
  onReload: () => Promise<void>;
  notify: (msg: string) => void;
  maskEmail: (e: string | null) => string;
  maskPhone: (p: string | null) => string;
};

type SubView =
  | null
  | "email"
  | "phone"
  | "2fa-setup"
  | "2fa-disable"
  | "password"
  | "withdrawal";

/** Minimal ISO → dial map (backend countries table has no dial_code column). */
const DIAL: Record<string, string> = {
  US: "1", CA: "1", GB: "44", UK: "44", AU: "61", NZ: "64",
  IN: "91", PK: "92", BD: "880", NG: "234", KE: "254", ZA: "27",
  GH: "233", EG: "20", AE: "971", SA: "966", TR: "90",
  DE: "49", FR: "33", ES: "34", IT: "39", NL: "31", BE: "32",
  PT: "351", BR: "55", MX: "52", AR: "54", CO: "57", PH: "63",
  ID: "62", MY: "60", SG: "65", TH: "66", VN: "84", JP: "81",
  KR: "82", CN: "86", HK: "852", TW: "886", RU: "7", UA: "380",
  PL: "48", SE: "46", NO: "47", DK: "45", FI: "358", IE: "353",
  CH: "41", AT: "43", CZ: "420", RO: "40", HU: "36", GR: "30",
};

function toE164(countryIso: string, national: string): string {
  const digits = national.replace(/\D/g, "");
  if (national.trim().startsWith("+")) return `+${digits}`;
  const dial = DIAL[countryIso.toUpperCase()] || "";
  if (!dial) return digits.startsWith("+") ? digits : `+${digits}`;
  const stripped = digits.startsWith(dial) ? digits.slice(dial.length) : digits;
  return `+${dial}${stripped}`;
}

async function edgeErrorMessage(fnErr: any, res: any): Promise<string> {
  if (res?.error) return String(res.error);
  if (res?.message) return String(res.message);
  if (fnErr?.context) {
    try {
      const body = await fnErr.context.json?.();
      if (body?.error) return String(body.error);
      if (body?.message) return String(body.message);
    } catch {
      /* ignore */
    }
  }
  return fnErr?.message || "Request failed. Try again.";
}

export default function SecurityTab({ data, onReload, notify, maskEmail, maskPhone }: Props) {
  const { profile, twoFaEnabled } = data;
  const [view, setView] = useState<SubView>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [secret, setSecret] = useState("");
  const [otpauthUrl, setOtpauthUrl] = useState("");
  const [code, setCode] = useState("");

  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");

  const [newEmail, setNewEmail] = useState("");

  const [phoneCountry, setPhoneCountry] = useState(profile?.country_code || "US");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneOtp, setPhoneOtp] = useState("");
  const [phoneStep, setPhoneStep] = useState<"enter" | "verify">("enter");
  const [pendingE164, setPendingE164] = useState("");

  const [whitelistAddr, setWhitelistAddr] = useState("");

  const lockUntil = profile?.withdrawal_lock_until
    ? new Date(profile.withdrawal_lock_until)
    : null;
  const locked = !!(lockUntil && lockUntil.getTime() > Date.now());
  const lockRemaining = locked
    ? Math.max(0, Math.ceil((lockUntil!.getTime() - Date.now()) / 3600000))
    : 0;

  const start2faSetup = async () => {
    setError("");
    setBusy(true);
    try {
      const { data: res, error: fnErr } = await supabase.functions.invoke("manage-2fa", {
        body: { action: "setup" },
      });
      if (fnErr) throw new Error(await edgeErrorMessage(fnErr, res));
      if (!res?.secret || !res?.otpauthUrl) throw new Error("Setup did not return a secret.");
      setSecret(res.secret);
      setOtpauthUrl(res.otpauthUrl);
      setCode("");
      setView("2fa-setup");
    } catch (e: any) {
      setError(e?.message || "Could not start 2FA setup. Try again later.");
    } finally {
      setBusy(false);
    }
  };

  const confirm2fa = async () => {
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const { data: res, error: fnErr } = await supabase.functions.invoke("manage-2fa", {
        body: { action: "confirm", code },
      });
      if (fnErr) throw new Error(await edgeErrorMessage(fnErr, res));
      if (res?.error) throw new Error(String(res.error));
      notify("Google 2FA enabled. Withdrawals are locked for 24 hours.");
      setSecret("");
      setOtpauthUrl("");
      setCode("");
      setView(null);
      await onReload();
    } catch (e: any) {
      setError(e?.message || "Invalid code. Check the app and try again.");
    } finally {
      setBusy(false);
    }
  };

  const disable2fa = async () => {
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the current 6-digit code to turn 2FA off.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const { data: res, error: fnErr } = await supabase.functions.invoke("manage-2fa", {
        body: { action: "disable", code },
      });
      if (fnErr) throw new Error(await edgeErrorMessage(fnErr, res));
      if (res?.error) throw new Error(String(res.error));
      notify("Google 2FA turned off. Withdrawals are locked for 24 hours.");
      setCode("");
      setView(null);
      await onReload();
    } catch (e: any) {
      setError(e?.message || "Invalid code. 2FA was not disabled.");
    } finally {
      setBusy(false);
    }
  };

  const changePassword = async () => {
    setError("");
    if (newPass.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPass !== confirmPass) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      const { error: authErr } = await supabase.auth.updateUser({ password: newPass });
      if (authErr) throw authErr;
      notify("Password updated.");
      setNewPass("");
      setConfirmPass("");
      setView(null);
    } catch (e: any) {
      setError(e?.message || "Could not update password. Sign in again and retry.");
    } finally {
      setBusy(false);
    }
  };

  const changeEmail = async () => {
    setError("");
    const email = newEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      setError("Enter a valid new email address.");
      return;
    }
    setBusy(true);
    try {
      const { error: authErr } = await supabase.auth.updateUser({ email });
      if (authErr) throw authErr;
      notify("Confirmation links sent. Check your current and new email inboxes.");
      setNewEmail("");
      setView(null);
    } catch (e: any) {
      setError(e?.message || "Could not start email change. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const sendPhoneCode = async () => {
    setError("");
    if (!phoneNumber.trim()) {
      setError("Enter a phone number.");
      return;
    }
    const e164 = toE164(phoneCountry, phoneNumber.trim());
    setBusy(true);
    try {
      const { error: authErr } = await supabase.auth.updateUser({ phone: e164 });
      if (authErr) {
        const msg = authErr.message || "";
        if (/sms|provider|phone|not.*configured|unsupported/i.test(msg)) {
          throw new Error("SMS verification is not yet available — contact support.");
        }
        throw authErr;
      }
      setPendingE164(e164);
      setPhoneStep("verify");
      notify("Verification code sent to your phone.");
    } catch (e: any) {
      const msg = e?.message || "SMS verification is not yet available — contact support.";
      setError(msg);
      notify(msg);
    } finally {
      setBusy(false);
    }
  };

  const verifyPhoneCode = async () => {
    if (!/^\d{4,8}$/.test(phoneOtp)) {
      setError("Enter the SMS code.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const { error: authErr } = await supabase.auth.verifyOtp({
        phone: pendingE164,
        token: phoneOtp,
        type: "phone_change",
      });
      if (authErr) throw authErr;
      notify("Phone number verified.");
      setView(null);
      setPhoneStep("enter");
      setPhoneOtp("");
      setPhoneNumber("");
      await onReload();
    } catch (e: any) {
      setError(e?.message || "Invalid code or SMS not configured.");
    } finally {
      setBusy(false);
    }
  };

  const saveWhitelist = async () => {
    if (!whitelistAddr.trim()) {
      setError("Enter a wallet address.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const { error: rpcErr } = await supabase.rpc("set_withdrawal_whitelist", {
        p_addresses: [whitelistAddr.trim()],
      });
      if (rpcErr) throw rpcErr;
      notify("Withdrawal whitelist updated.");
      setWhitelistAddr("");
    } catch (e: any) {
      setError(e?.message || "Could not update whitelist.");
    } finally {
      setBusy(false);
    }
  };

  if (view === "2fa-setup") {
    return (
      <div style={s.section}>
        <div style={s.infoBox}>
          Scan the QR with Google Authenticator (or any TOTP app), or enter the key manually.
          Then confirm with a 6-digit code. Enabling 2FA applies a 24-hour withdrawal lock.
          The secret is never stored in this browser beyond this step.
        </div>
        {otpauthUrl && (
          <div style={{ display: "flex", justifyContent: "center", padding: 12, background: "#fff", borderRadius: 12, margin: "0 auto 12px", width: "fit-content" }}>
            <QRCodeSVG value={otpauthUrl} size={180} level="M" />
          </div>
        )}
        {secret && (
          <div style={{ ...s.infoBox, fontFamily: "monospace", wordBreak: "break-all" as const }}>
            Manual key: {secret}
          </div>
        )}
        <label style={s.field}>
          6-digit code
          <input
            style={{ ...s.input, letterSpacing: 6, textAlign: "center", fontSize: 20 }}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            autoFocus
          />
        </label>
        {error && <div style={s.errorBox}>{error}</div>}
        <button type="button" style={s.primaryBtn} disabled={busy} onClick={() => void confirm2fa()}>
          {busy ? "Confirming…" : "Confirm and enable 2FA"}
        </button>
        <button type="button" style={s.secondaryBtn} onClick={() => { setView(null); setSecret(""); setOtpauthUrl(""); setCode(""); setError(""); }}>
          Cancel
        </button>
      </div>
    );
  }

  if (view === "2fa-disable") {
    return (
      <div style={s.section}>
        <div style={s.infoBox}>
          Enter a current code from your authenticator app to turn Google 2FA off.
          Disabling 2FA also applies a 24-hour withdrawal lock.
        </div>
        <label style={s.field}>
          6-digit code
          <input
            style={{ ...s.input, letterSpacing: 6, textAlign: "center", fontSize: 20 }}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            autoFocus
          />
        </label>
        {error && <div style={s.errorBox}>{error}</div>}
        <button type="button" style={s.primaryBtn} disabled={busy} onClick={() => void disable2fa()}>
          {busy ? "Disabling…" : "Turn off 2FA"}
        </button>
        <button type="button" style={s.secondaryBtn} onClick={() => { setView(null); setCode(""); setError(""); }}>
          Cancel
        </button>
      </div>
    );
  }

  if (view === "password") {
    return (
      <div style={s.section}>
        <div style={s.infoBox}>You must be signed in. The new password replaces the current one for this account.</div>
        <label style={s.field}>
          New password
          <input style={s.input} type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} autoComplete="new-password" />
        </label>
        <label style={s.field}>
          Confirm new password
          <input style={s.input} type="password" value={confirmPass} onChange={(e) => setConfirmPass(e.target.value)} autoComplete="new-password" />
        </label>
        {error && <div style={s.errorBox}>{error}</div>}
        <button type="button" style={s.primaryBtn} disabled={busy} onClick={() => void changePassword()}>
          {busy ? "Updating…" : "Update password"}
        </button>
        <button type="button" style={s.secondaryBtn} onClick={() => { setView(null); setError(""); }}>
          Cancel
        </button>
      </div>
    );
  }

  if (view === "email") {
    return (
      <div style={s.section}>
        <div style={s.infoBox}>
          Current email: {maskEmail(profile?.email ?? null)}.
          Enter a new address below. We send confirmation links to your current and new email —
          click both to complete the change. There is no in-app code step for this method.
        </div>
        <label style={s.field}>
          New email address
          <input
            style={s.input}
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="you@example.com"
            autoFocus
          />
        </label>
        {error && <div style={s.errorBox}>{error}</div>}
        <button type="button" style={s.primaryBtn} disabled={busy} onClick={() => void changeEmail()}>
          {busy ? "Sending…" : "Send confirmation links"}
        </button>
        <button type="button" style={s.secondaryBtn} onClick={() => { setView(null); setError(""); setNewEmail(""); }}>
          Back
        </button>
      </div>
    );
  }

  if (view === "phone") {
    return (
      <div style={s.section}>
        <div style={s.infoBox}>
          Uses Supabase Auth phone change. If SMS is not configured, the error is shown plainly.
          After verification, profile phone fields update automatically via trigger.
        </div>
        {phoneStep === "enter" ? (
          <>
            <label style={s.field}>
              Country (ISO)
              <input
                style={s.input}
                value={phoneCountry}
                onChange={(e) => setPhoneCountry(e.target.value.toUpperCase().slice(0, 2))}
                placeholder="US"
              />
            </label>
            <label style={s.field}>
              Phone number
              <input
                style={s.input}
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="+12015550123 or national number"
                inputMode="tel"
              />
            </label>
            {error && <div style={s.errorBox}>{error}</div>}
            <button type="button" style={s.primaryBtn} disabled={busy} onClick={() => void sendPhoneCode()}>
              {busy ? "Sending…" : "Send verification code"}
            </button>
          </>
        ) : (
          <>
            <div style={s.infoBox}>Code sent to {pendingE164}. Enter it below.</div>
            <label style={s.field}>
              SMS code
              <input
                style={s.input}
                value={phoneOtp}
                onChange={(e) => setPhoneOtp(e.target.value.replace(/\D/g, "").slice(0, 8))}
                inputMode="numeric"
                autoFocus
              />
            </label>
            {error && <div style={s.errorBox}>{error}</div>}
            <button type="button" style={s.primaryBtn} disabled={busy} onClick={() => void verifyPhoneCode()}>
              {busy ? "Verifying…" : "Verify phone"}
            </button>
          </>
        )}
        <button
          type="button"
          style={s.secondaryBtn}
          onClick={() => {
            setView(null);
            setError("");
            setPhoneStep("enter");
            setPhoneOtp("");
          }}
        >
          Cancel
        </button>
      </div>
    );
  }

  if (view === "withdrawal") {
    return (
      <div style={s.section}>
        {locked ? (
          <div style={s.infoBox}>
            Withdrawals are locked for approximately {lockRemaining} more hour(s) (until {lockUntil!.toLocaleString()}).
          </div>
        ) : (
          <div style={s.infoBox}>No active withdrawal lock.</div>
        )}
        <label style={s.field}>
          Whitelist address
          <input style={s.input} value={whitelistAddr} onChange={(e) => setWhitelistAddr(e.target.value)} placeholder="Paste wallet address" />
        </label>
        {error && <div style={s.errorBox}>{error}</div>}
        <button type="button" style={s.primaryBtn} disabled={busy} onClick={() => void saveWhitelist()}>
          {busy ? "Saving…" : "Save whitelist"}
        </button>
        <button type="button" style={s.secondaryBtn} onClick={() => { setView(null); setError(""); }}>
          Back
        </button>
      </div>
    );
  }

  return (
    <div style={s.section}>
      <button type="button" style={s.row} onClick={() => setView("email")}>
        <span style={s.rowIcon}><SIcon name="mail" size={16} /></span>
        <span style={s.rowLabel}>Email</span>
        <span style={s.rowValue}>{maskEmail(profile?.email ?? null)}</span>
        <span style={s.rowChevron}><SIcon name="chevron" size={16} /></span>
      </button>

      <button type="button" style={s.row} onClick={() => setView("phone")}>
        <span style={s.rowIcon}><SIcon name="phone" size={16} /></span>
        <span style={s.rowLabel}>Mobile</span>
        <span style={s.rowValue}>{maskPhone(profile?.phone ?? null)}</span>
        <span style={s.rowChevron}><SIcon name="chevron" size={16} /></span>
      </button>

      <div style={s.row}>
        <span style={s.rowIcon}><SIcon name="google" size={16} /></span>
        <span style={s.rowLabel}>Google 2FA Authentication</span>
        <button
          type="button"
          style={{ ...s.toggle, background: twoFaEnabled ? GOLD : "#333" }}
          onClick={() => {
            if (twoFaEnabled) {
              setCode("");
              setView("2fa-disable");
            } else {
              void start2faSetup();
            }
          }}
          aria-label={twoFaEnabled ? "Disable 2FA" : "Enable 2FA"}
        >
          <span style={{ ...s.toggleKnob, left: twoFaEnabled ? 21 : 3 }} />
        </button>
      </div>

      <button type="button" style={s.row} onClick={() => setView("withdrawal")}>
        <span style={s.rowIcon}><SIcon name="wallet" size={16} /></span>
        <span style={s.rowLabel}>Withdrawal Security</span>
        <span style={s.rowValue}>{locked ? `Locked ${lockRemaining}h` : "Open"}</span>
        <span style={s.rowChevron}><SIcon name="chevron" size={16} /></span>
      </button>

      <button type="button" style={s.row} onClick={() => setView("password")}>
        <span style={s.rowIcon}><SIcon name="lock" size={16} /></span>
        <span style={s.rowLabel}>Change Password</span>
        <span style={s.rowChevron}><SIcon name="chevron" size={16} /></span>
      </button>
    </div>
  );
}
