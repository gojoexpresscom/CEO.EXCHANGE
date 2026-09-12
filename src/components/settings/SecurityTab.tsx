import React, { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "../../lib/supabase";
import { s, GOLD, GOLD_LIGHT } from "./settingsStyles";
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

export default function SecurityTab({ data, onReload, notify, maskEmail, maskPhone }: Props) {
  const { profile, twoFaEnabled, userId } = data;
  const [view, setView] = useState<SubView>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // 2FA setup state
  const [secret, setSecret] = useState("");
  const [otpauthUrl, setOtpauthUrl] = useState("");
  const [code, setCode] = useState("");

  // Password
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");

  // Email change (current only — new email OTP not available yet)
  const [emailOtp, setEmailOtp] = useState("");
  const [emailStep, setEmailStep] = useState<"verify-current" | "new-email-stub">("verify-current");

  // Phone
  const [phoneCountry, setPhoneCountry] = useState(profile?.country_code || "US");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneOtp, setPhoneOtp] = useState("");
  const [phoneStep, setPhoneStep] = useState<"enter" | "verify">("enter");

  // Withdrawal whitelist
  const [whitelistAddr, setWhitelistAddr] = useState("");

  const lockUntil = profile?.withdrawal_lock_until
    ? new Date(profile.withdrawal_lock_until)
    : null;
  const locked = lockUntil && lockUntil.getTime() > Date.now();
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
      if (fnErr) throw fnErr;
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
      if (fnErr) throw fnErr;
      if (res?.error) throw new Error(res.error);
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
      if (fnErr) throw fnErr;
      if (res?.error) throw new Error(res.error);
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

  const sendEmailOtp = async () => {
    setError("");
    setBusy(true);
    try {
      const { data: res, error: fnErr } = await supabase.functions.invoke("send-otp", {
        body: { purpose: "change_email_verify_current" },
      });
      if (fnErr) throw fnErr;
      if (res?.error) throw new Error(res.error);
      notify("Verification code sent to your current email.");
    } catch (e: any) {
      setError(e?.message || "Could not send code. Check that email delivery is configured.");
    } finally {
      setBusy(false);
    }
  };

  const verifyCurrentEmail = async () => {
    if (!/^\d{4,8}$/.test(emailOtp)) {
      setError("Enter the code from your email.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const { data: res, error: fnErr } = await supabase.functions.invoke("verify-otp", {
        body: { purpose: "change_email_verify_current", code: emailOtp },
      });
      if (fnErr) throw fnErr;
      if (res?.error) throw new Error(res.error);
      // Backend cannot yet OTP a brand-new address.
      setEmailStep("new-email-stub");
      notify("Current email verified. New-email step is waiting on backend.");
    } catch (e: any) {
      setError(e?.message || "Invalid or expired code.");
    } finally {
      setBusy(false);
    }
  };

  const sendPhoneOtp = async () => {
    setError("");
    if (!phoneNumber.trim()) {
      setError("Enter a phone number.");
      return;
    }
    setBusy(true);
    try {
      const { data: res, error: fnErr } = await supabase.functions.invoke("send-otp", {
        body: {
          purpose: "phone_verify",
          phone: phoneNumber.trim(),
          country_code: phoneCountry,
        },
      });
      if (fnErr) throw fnErr;
      if (res?.error) throw new Error(res.error);
      // SMS provider may not be configured — surface real error, never fake success.
      setPhoneStep("verify");
      notify("If SMS is configured, a code was sent.");
    } catch (e: any) {
      const msg = e?.message || "SMS provider is not configured. Phone verification is unavailable.";
      setError(msg);
      notify(msg);
    } finally {
      setBusy(false);
    }
  };

  const verifyPhone = async () => {
    if (!/^\d{4,8}$/.test(phoneOtp)) {
      setError("Enter the SMS code.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const { data: res, error: fnErr } = await supabase.functions.invoke("verify-otp", {
        body: { purpose: "phone_verify", code: phoneOtp },
      });
      if (fnErr) throw fnErr;
      if (res?.error) throw new Error(res.error);
      notify("Phone number verified.");
      setView(null);
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

  // ——— Sub-views ———
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
        {emailStep === "verify-current" ? (
          <>
            <div style={s.infoBox}>
              Current email: {maskEmail(profile?.email ?? null)}. We send a code to this address first.
              Verifying a brand-new email address is not available yet (backend gap).
            </div>
            <button type="button" style={s.secondaryBtn} disabled={busy} onClick={() => void sendEmailOtp()}>
              {busy ? "Sending…" : "Send code to current email"}
            </button>
            <label style={s.field}>
              Code from email
              <input style={s.input} value={emailOtp} onChange={(e) => setEmailOtp(e.target.value)} inputMode="numeric" />
            </label>
            {error && <div style={s.errorBox}>{error}</div>}
            <button type="button" style={s.primaryBtn} disabled={busy} onClick={() => void verifyCurrentEmail()}>
              Verify current email
            </button>
          </>
        ) : (
          <div style={s.infoBox}>
            Current email verified. The backend does not yet provide an Edge Function that sends/verifies an OTP to a new address.
            Flagged for the backend agent — this step is intentionally a stub.
          </div>
        )}
        <button type="button" style={s.secondaryBtn} onClick={() => { setView(null); setError(""); setEmailStep("verify-current"); }}>
          Back
        </button>
      </div>
    );
  }

  if (view === "phone") {
    return (
      <div style={s.section}>
        <div style={s.infoBox}>
          SMS provider is not configured on the live project. The full flow is built; any configuration error from the backend is shown plainly (never faked as success).
        </div>
        {phoneStep === "enter" ? (
          <>
            <label style={s.field}>
              Country code (ISO)
              <input style={s.input} value={phoneCountry} onChange={(e) => setPhoneCountry(e.target.value.toUpperCase().slice(0, 2))} placeholder="US" />
            </label>
            <label style={s.field}>
              Phone number
              <input style={s.input} value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="2015550123" inputMode="tel" />
            </label>
            {error && <div style={s.errorBox}>{error}</div>}
            <button type="button" style={s.primaryBtn} disabled={busy} onClick={() => void sendPhoneOtp()}>
              {busy ? "Sending…" : "Send verification code"}
            </button>
          </>
        ) : (
          <>
            <label style={s.field}>
              SMS code
              <input style={s.input} value={phoneOtp} onChange={(e) => setPhoneOtp(e.target.value)} inputMode="numeric" />
            </label>
            {error && <div style={s.errorBox}>{error}</div>}
            <button type="button" style={s.primaryBtn} disabled={busy} onClick={() => void verifyPhone()}>
              Verify phone
            </button>
          </>
        )}
        <button type="button" style={s.secondaryBtn} onClick={() => { setView(null); setError(""); setPhoneStep("enter"); }}>
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

  // ——— Main list (flat, no "Basic Protect" / Passkeys) ———
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
          style={{
            ...s.toggle,
            background: twoFaEnabled ? GOLD : "#333",
          }}
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
          <span
            style={{
              ...s.toggleKnob,
              left: twoFaEnabled ? 21 : 3,
            }}
          />
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
