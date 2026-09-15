import React, { useState, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "../../lib/supabase";
import { s, GOLD, GOLD_LIGHT, BG, CARD, BORDER } from "./settingsStyles";
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
  | "email-otp"
  | "phone"
  | "2fa-setup"
  | "2fa-disable"
  | "password"
  | "password-verify"
  | "password-new"
  | "withdrawal"
  | "kyc";

const MOTION = `
@keyframes secIn {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes secField {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes secPulse {
  0%   { box-shadow: 0 0 0 0 rgba(245,181,27,0.4); }
  70%  { box-shadow: 0 0 0 8px rgba(245,181,27,0); }
  100% { box-shadow: 0 0 0 0 rgba(245,181,27,0); }
}
@keyframes secCheck {
  0%   { transform: scale(0.5); opacity: 0; }
  60%  { transform: scale(1.12); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}
@keyframes secBtnPress {
  0%   { transform: scale(1); }
  50%  { transform: scale(0.97); }
  100% { transform: scale(1); }
}
`;

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
  const { profile, twoFaEnabled, userId } = data;
  const [view, setView] = useState<SubView>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // 2FA
  const [secret, setSecret] = useState("");
  const [otpauthUrl, setOtpauthUrl] = useState("");
  const [code, setCode] = useState("");

  // Password flow
  const [passStep, setPassStep] = useState<"verify" | "new">("verify");
  const [verifyCode, setVerifyCode] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [otpSent, setOtpSent] = useState(false);

  // Email flow
  const [emailStep, setEmailStep] = useState<"start" | "otp">("start");
  const [newEmail, setNewEmail] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [emailOtpSent, setEmailOtpSent] = useState(false);

  // Withdrawal
  const [whitelistAddr, setWhitelistAddr] = useState("");
  const [infoKey, setInfoKey] = useState<string | null>(null);
  const [appLock, setAppLock] = useState(Boolean((profile as any)?.app_lock_enabled));
  // Passkeys
  const [passkeys, setPasskeys] = useState<any[]>([]);
  const [pkLoading, setPkLoading] = useState(false);
  // Anti-phishing
  const [apCode, setApCode] = useState("");
  // Fund password
  const [fpNew, setFpNew] = useState("");
  const [fpConfirm, setFpConfirm] = useState("");
  const [fpVerify, setFpVerify] = useState("");
  // Devices
  const [devices, setDevices] = useState<any[]>([]);
  const [devLoading, setDevLoading] = useState(false);

  const lockUntil = profile?.withdrawal_lock_until
    ? new Date(profile.withdrawal_lock_until)
    : null;
  const locked = !!(lockUntil && lockUntil.getTime() > Date.now());
  const lockRemaining = locked
    ? Math.max(0, Math.ceil((lockUntil!.getTime() - Date.now()) / 3600000))
    : 0;

  const kycStatus = (profile?.kyc_status || "").toUpperCase();
  const kycVerified = kycStatus === "VERIFIED";
  const kycPending = kycStatus === "PENDING";
  const kycRejected = kycStatus === "REJECTED";

  // ───────────────── 2FA ─────────────────
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
      setError(e?.message || "Could not start 2FA setup.");
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
      notify("Authenticator enabled. Withdrawals locked for 24 hours.");
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
      setError("Enter the current 6-digit code to turn off authenticator.");
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
      notify("Authenticator turned off. Withdrawals locked for 24 hours.");
      setCode("");
      setView(null);
      await onReload();
    } catch (e: any) {
      setError(e?.message || "Invalid code. Authenticator was not disabled.");
    } finally {
      setBusy(false);
    }
  };

  // ───────────────── Password ─────────────────
  const startPasswordChange = () => {
    setError("");
    setVerifyCode("");
    setNewPass("");
    setConfirmPass("");
    setOtpSent(false);
    setPassStep("verify");
    setView("password");
  };

  const sendPasswordOtp = async () => {
    setError("");
    setBusy(true);
    try {
      if (twoFaEnabled) {
        // User will enter TOTP next – no email needed
        setOtpSent(true);
        notify("Enter the 6-digit code from your authenticator app.");
      } else {
        const { data: res, error: fnErr } = await supabase.functions.invoke("send-otp", {
          body: { purpose: "password_change" },
        });
        if (fnErr) throw new Error(await edgeErrorMessage(fnErr, res));
        if (res?.error) throw new Error(String(res.error));
        setOtpSent(true);
        notify("6-digit code sent to your email.");
      }
    } catch (e: any) {
      setError(e?.message || "Could not send verification code.");
    } finally {
      setBusy(false);
    }
  };

  const verifyPasswordGate = async () => {
    if (!/^\d{6}$/.test(verifyCode)) {
      setError("Enter a valid 6-digit code.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      if (twoFaEnabled) {
        const { data: res, error: fnErr } = await supabase.functions.invoke("manage-2fa", {
          body: { action: "verify", code: verifyCode },
        });
        if (fnErr) throw new Error(await edgeErrorMessage(fnErr, res));
        if (!res?.valid) throw new Error("Invalid authenticator code.");
      } else {
        const { data: res, error: fnErr } = await supabase.functions.invoke("verify-otp", {
          body: { code: verifyCode, purpose: "password_change" },
        });
        if (fnErr) throw new Error(await edgeErrorMessage(fnErr, res));
        if (res?.error || !res?.success) throw new Error(res?.error || "Invalid or expired code.");
      }
      setPassStep("new");
      setVerifyCode("");
    } catch (e: any) {
      setError(e?.message || "Verification failed.");
    } finally {
      setBusy(false);
    }
  };

  const finishPasswordChange = async () => {
    if (newPass.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPass !== confirmPass) {
      setError("Passwords do not match.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const { error: authErr } = await supabase.auth.updateUser({ password: newPass });
      if (authErr) throw authErr;
      notify("Password updated. Use the new password from now on.");
      setNewPass("");
      setConfirmPass("");
      setView(null);
    } catch (e: any) {
      setError(e?.message || "Could not update password.");
    } finally {
      setBusy(false);
    }
  };

  // ───────────────── Email ─────────────────
  const startEmailChange = () => {
    setError("");
    setNewEmail("");
    setEmailCode("");
    setEmailOtpSent(false);
    setEmailStep("start");
    setView("email");
  };

  const sendEmailOtp = async () => {
    setError("");
    setBusy(true);
    try {
      const { data: res, error: fnErr } = await supabase.functions.invoke("send-otp", {
        body: { purpose: "email_change" },
      });
      if (fnErr) throw new Error(await edgeErrorMessage(fnErr, res));
      if (res?.error) throw new Error(String(res.error));
      setEmailOtpSent(true);
      setEmailStep("otp");
      notify("6-digit code sent to your current email.");
    } catch (e: any) {
      setError(e?.message || "Could not send verification code.");
    } finally {
      setBusy(false);
    }
  };

  const finishEmailChange = async () => {
    if (!/^\d{6}$/.test(emailCode)) {
      setError("Enter the 6-digit code.");
      return;
    }
    const email = newEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      setError("Enter a valid new email address.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      // 1. Verify OTP
      const { data: res, error: fnErr } = await supabase.functions.invoke("verify-otp", {
        body: { code: emailCode, purpose: "email_change" },
      });
      if (fnErr) throw new Error(await edgeErrorMessage(fnErr, res));
      if (res?.error || !res?.success) throw new Error(res?.error || "Invalid or expired code.");

      // 2. Call change-email edge function (service-role). Claude must create this.
      const { data: changeRes, error: changeErr } = await supabase.functions.invoke("change-email", {
        body: { new_email: email },
      });
      if (changeErr) {
        // Temporary fallback message until the function exists
        throw new Error(
          changeErr.message?.includes("not found") || changeErr.message?.includes("Function")
            ? "Email change service is being prepared. Please try again later or contact support."
            : await edgeErrorMessage(changeErr, changeRes)
        );
      }
      if (changeRes?.error) throw new Error(String(changeRes.error));

      notify("Email updated successfully.");
      setNewEmail("");
      setEmailCode("");
      setView(null);
      await onReload();
    } catch (e: any) {
      setError(e?.message || "Could not change email.");
    } finally {
      setBusy(false);
    }
  };

  // ───────────────── Withdrawal whitelist ─────────────────
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
      setError(e?.message || "Could not update whitelist. Contact support if this persists.");
    } finally {
      setBusy(false);
    }
  };

  // ───────────────── Shared UI helpers ─────────────────
  const backToList = () => {
    setView(null);
    setError("");
    setCode("");
    setVerifyCode("");
    setEmailCode("");
    setNewPass("");
    setConfirmPass("");
    setNewEmail("");
  };

  const primaryBtnStyle = {
    ...s.primaryBtn,
    transition: "transform 0.15s ease, box-shadow 0.2s ease",
  };

  // ───────────────── Sub-views ─────────────────
  if (view === "2fa-setup") {
    return (
      <div style={{ ...s.section, animation: "secIn 0.32s ease-out both" }}>
        <style>{MOTION}</style>
        <div style={s.infoBox}>
          Scan the QR with any authenticator app (Google Authenticator, Authy, etc.), or enter the key manually.
          Then confirm with a 6-digit code. Enabling applies a 24-hour withdrawal lock.
        </div>
        {otpauthUrl && (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              padding: 16,
              background: "#fff",
              borderRadius: 14,
              margin: "0 auto 14px",
              width: "fit-content",
              animation: "secField 0.35s ease-out both",
            }}
          >
            <QRCodeSVG value={otpauthUrl} size={180} level="M" />
          </div>
        )}
        {secret && (
          <div style={{ ...s.infoBox, fontFamily: "monospace", wordBreak: "break-all" as const, fontSize: 12 }}>
            Manual key: {secret}
          </div>
        )}
        <label style={{ ...s.field, animation: "secField 0.35s ease-out both", animationDelay: "0.05s" }}>
          6-digit code
          <input
            style={{ ...s.input, letterSpacing: 8, textAlign: "center", fontSize: 22, fontWeight: 700 }}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            autoFocus
            maxLength={6}
          />
        </label>
        {error && <div style={s.errorBox}>{error}</div>}
        <button type="button" style={primaryBtnStyle} disabled={busy} onClick={() => void confirm2fa()}>
          {busy ? "Confirming…" : "Enable Authenticator"}
        </button>
        <button type="button" style={s.secondaryBtn} onClick={backToList}>
          Cancel
        </button>
      </div>
    );
  }

  if (view === "2fa-disable") {
    return (
      <div style={{ ...s.section, animation: "secIn 0.32s ease-out both" }}>
        <style>{MOTION}</style>
        <div style={s.infoBox}>
          Enter a current code from your authenticator app to turn it off. This also applies a 24-hour withdrawal lock.
        </div>
        <label style={s.field}>
          6-digit code
          <input
            style={{ ...s.input, letterSpacing: 8, textAlign: "center", fontSize: 22, fontWeight: 700 }}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            autoFocus
            maxLength={6}
          />
        </label>
        {error && <div style={s.errorBox}>{error}</div>}
        <button type="button" style={primaryBtnStyle} disabled={busy} onClick={() => void disable2fa()}>
          {busy ? "Turning off…" : "Turn off Authenticator"}
        </button>
        <button type="button" style={s.secondaryBtn} onClick={backToList}>
          Cancel
        </button>
      </div>
    );
  }

  if (view === "password") {
    return (
      <div style={{ ...s.section, animation: "secIn 0.32s ease-out both" }}>
        <style>{MOTION}</style>

        {passStep === "verify" && (
          <>
            <div style={s.infoBox}>
              {twoFaEnabled
                ? "Authenticator is enabled. Enter the 6-digit code from your app to continue."
                : "We'll send a 6-digit code to your current email. Enter it to continue."}
            </div>

            {!otpSent ? (
              <button type="button" style={primaryBtnStyle} disabled={busy} onClick={() => void sendPasswordOtp()}>
                {busy ? "Sending…" : twoFaEnabled ? "Continue with Authenticator" : "Send verification code"}
              </button>
            ) : (
              <>
                <label style={{ ...s.field, animation: "secField 0.3s ease-out both" }}>
                  6-digit code
                  <input
                    style={{ ...s.input, letterSpacing: 8, textAlign: "center", fontSize: 22, fontWeight: 700 }}
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    inputMode="numeric"
                    autoFocus
                    maxLength={6}
                  />
                </label>
                {error && <div style={s.errorBox}>{error}</div>}
                <button type="button" style={primaryBtnStyle} disabled={busy} onClick={() => void verifyPasswordGate()}>
                  {busy ? "Verifying…" : "Verify & continue"}
                </button>
              </>
            )}
            <button type="button" style={s.secondaryBtn} onClick={backToList}>
              Cancel
            </button>
          </>
        )}

        {passStep === "new" && (
          <>
            <div style={{ ...s.infoBox, animation: "secCheck 0.35s ease-out both" }}>
              Verification passed. Create your new password below. The old password stops working immediately.
            </div>
            <label style={{ ...s.field, animation: "secField 0.3s ease-out both" }}>
              New password
              <input
                style={s.input}
                type="password"
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                autoComplete="new-password"
                autoFocus
                placeholder="At least 8 characters"
              />
            </label>
            <label style={{ ...s.field, animation: "secField 0.3s ease-out both", animationDelay: "0.05s" }}>
              Confirm new password
              <input
                style={s.input}
                type="password"
                value={confirmPass}
                onChange={(e) => setConfirmPass(e.target.value)}
                autoComplete="new-password"
              />
            </label>
            {error && <div style={s.errorBox}>{error}</div>}
            <button type="button" style={primaryBtnStyle} disabled={busy} onClick={() => void finishPasswordChange()}>
              {busy ? "Updating…" : "Save new password"}
            </button>
            <button type="button" style={s.secondaryBtn} onClick={backToList}>
              Cancel
            </button>
          </>
        )}
      </div>
    );
  }

  if (view === "email") {
    return (
      <div style={{ ...s.section, animation: "secIn 0.32s ease-out both" }}>
        <style>{MOTION}</style>

        {emailStep === "start" && (
          <>
            <div style={s.infoBox}>
              Current email: <strong style={{ color: GOLD_LIGHT }}>{maskEmail(profile?.email ?? null)}</strong>
              <br />
              Tap below to receive a 6-digit code on this address. You will then enter the code and your new email.
            </div>
            <button type="button" style={primaryBtnStyle} disabled={busy} onClick={() => void sendEmailOtp()}>
              {busy ? "Sending…" : "Change email"}
            </button>
            <button type="button" style={s.secondaryBtn} onClick={backToList}>
              Back
            </button>
          </>
        )}

        {emailStep === "otp" && (
          <>
            <div style={s.infoBox}>
              Code sent to your current email. Enter the 6-digit code and the new email address you want to use.
            </div>
            <label style={{ ...s.field, animation: "secField 0.3s ease-out both" }}>
              6-digit code
              <input
                style={{ ...s.input, letterSpacing: 8, textAlign: "center", fontSize: 22, fontWeight: 700 }}
                value={emailCode}
                onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoFocus
                maxLength={6}
              />
            </label>
            <label style={{ ...s.field, animation: "secField 0.3s ease-out both", animationDelay: "0.05s" }}>
              New email address
              <input
                style={s.input}
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="new@example.com"
                autoComplete="email"
              />
            </label>
            {error && <div style={s.errorBox}>{error}</div>}
            <button type="button" style={primaryBtnStyle} disabled={busy} onClick={() => void finishEmailChange()}>
              {busy ? "Updating…" : "Confirm new email"}
            </button>
            <button type="button" style={s.secondaryBtn} onClick={backToList}>
              Cancel
            </button>
          </>
        )}
      </div>
    );
  }

  if (view === "phone") {
    return (
      <div style={{ ...s.section, animation: "secIn 0.32s ease-out both" }}>
        <style>{MOTION}</style>
        <div
          style={{
            ...s.infoBox,
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            gap: 12,
            padding: "28px 16px",
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "linear-gradient(135deg,#1a1508,#0d0d0d)",
              border: `1.5px solid ${BORDER}`,
              display: "grid",
              placeItems: "center",
              color: GOLD,
              animation: "secPulse 2s ease-out infinite",
            }}
          >
            <SIcon name="phone" size={24} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>Phone verification</div>
          <div style={{ color: "#aaa", fontSize: 13, lineHeight: 1.5, maxWidth: 280 }}>
            SMS verification is being prepared. Once enabled, you will be able to link and verify a mobile number for
            extra account protection.
          </div>
          <div
            style={{
              marginTop: 4,
              padding: "6px 14px",
              borderRadius: 99,
              background: "#1a1508",
              border: `1px solid ${BORDER}`,
              color: GOLD_LIGHT,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 0.5,
            }}
          >
            COMING SOON
          </div>
        </div>
        <button type="button" style={s.secondaryBtn} onClick={backToList}>
          Back
        </button>
      </div>
    );
  }

  if (view === "withdrawal") {
    return (
      <div style={{ ...s.section, animation: "secIn 0.32s ease-out both" }}>
        <style>{MOTION}</style>
        {locked ? (
          <div style={s.infoBox}>
            Withdrawals are temporarily locked for approximately {lockRemaining} more hour(s)
            {lockUntil ? ` (until ${lockUntil.toLocaleString()})` : ""}. This is automatic after security changes.
          </div>
        ) : (
          <div style={s.infoBox}>No active withdrawal lock. You can add trusted addresses below.</div>
        )}
        <label style={s.field}>
          Trusted withdrawal address
          <input
            style={s.input}
            value={whitelistAddr}
            onChange={(e) => setWhitelistAddr(e.target.value)}
            placeholder="Paste wallet address"
            autoFocus
          />
        </label>
        {error && <div style={s.errorBox}>{error}</div>}
        <button type="button" style={primaryBtnStyle} disabled={busy} onClick={() => void saveWhitelist()}>
          {busy ? "Saving…" : "Save address"}
        </button>
        <button type="button" style={s.secondaryBtn} onClick={backToList}>
          Back
        </button>
      </div>
    );
  }



  // ── Passkeys ──
  const loadPasskeys = async () => {
    setPkLoading(true);
    setInfoKey("passkeys");
    try {
      const { data, error } = await supabase.rpc("list_my_passkeys");
      if (error) throw error;
      setPasskeys(Array.isArray(data) ? data : data ? [data] : []);
    } catch (e: any) {
      setPasskeys([]);
      setError(e?.message || "Could not load passkeys.");
    } finally {
      setPkLoading(false);
    }
  };

  const registerPasskey = async () => {
    setBusy(true);
    setError("");
    try {
      const { data: optRes, error: optErr } = await supabase.functions.invoke("passkey-registration-options", { body: {} });
      if (optErr) throw optErr;
      if (optRes?.error) throw new Error(String(optRes.error));
      const publicKey = optRes?.publicKey || optRes?.options || optRes;
      if (!publicKey) throw new Error("No registration options returned.");

      // Convert challenge / user.id / excludeCredentials from base64url if needed by browser
      const cred = (await navigator.credentials.create({ publicKey })) as PublicKeyCredential | null;
      if (!cred) throw new Error("Passkey creation cancelled.");
      const att = cred.response as AuthenticatorAttestationResponse;
      const { data: verRes, error: verErr } = await supabase.functions.invoke("passkey-registration-verify", {
        body: {
          id: cred.id,
          rawId: btoa(String.fromCharCode(...new Uint8Array(cred.rawId))),
          type: cred.type,
          response: {
            clientDataJSON: btoa(String.fromCharCode(...new Uint8Array(att.clientDataJSON))),
            attestationObject: btoa(String.fromCharCode(...new Uint8Array(att.attestationObject))),
          },
          device_name: navigator.userAgent.slice(0, 80),
        },
      });
      if (verErr) throw verErr;
      if (verRes?.error) throw new Error(String(verRes.error));
      notify("Passkey registered.");
      await loadPasskeys();
    } catch (e: any) {
      setError(e?.message || "Could not register passkey.");
    } finally {
      setBusy(false);
    }
  };

  const revokePasskey = async (id: string) => {
    setBusy(true);
    try {
      const { error } = await supabase.rpc("revoke_passkey", { id });
      if (error) throw error;
      notify("Passkey revoked.");
      await loadPasskeys();
    } catch (e: any) {
      notify(e?.message || "Could not revoke passkey.");
    } finally {
      setBusy(false);
    }
  };

  // ── Anti-phishing ──
  const saveAntiPhish = async () => {
    const code = apCode.trim();
    if (code.length < 4 || code.length > 20) {
      setError("Code must be 4–20 characters.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { error } = await supabase.rpc("set_anti_phishing_code", { p_code: code });
      if (error) throw error;
      notify("Anti-phishing code saved.");
      setApCode("");
      setInfoKey(null);
      await onReload();
    } catch (e: any) {
      setError(e?.message || "Could not save code.");
    } finally {
      setBusy(false);
    }
  };

  // ── Fund password ──
  const saveFundPassword = async () => {
    if (fpNew.length < 6) {
      setError("Fund password must be at least 6 characters.");
      return;
    }
    if (fpNew !== fpConfirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { error } = await supabase.rpc("set_fund_password", { p_new_password: fpNew });
      if (error) throw error;
      notify("Fund password set.");
      setFpNew("");
      setFpConfirm("");
      setInfoKey(null);
      await onReload();
    } catch (e: any) {
      setError(e?.message || "Could not set fund password.");
    } finally {
      setBusy(false);
    }
  };

  // ── Devices ──
  const loadDevices = async () => {
    setDevLoading(true);
    setInfoKey("devices");
    try {
      const { data, error } = await supabase.rpc("list_my_devices");
      if (error) throw error;
      setDevices(Array.isArray(data) ? data : data ? [data] : []);
    } catch (e: any) {
      // Fallback direct table
      try {
        const { data } = await supabase.from("user_devices").select("*").eq("user_id", userId).order("last_seen_at", { ascending: false });
        setDevices(data ?? []);
      } catch {
        setDevices([]);
        setError(e?.message || "Could not load devices.");
      }
    } finally {
      setDevLoading(false);
    }
  };

  const revokeDevice = async (deviceId: string) => {
    setBusy(true);
    try {
      const { error } = await supabase.rpc("revoke_device", { p_device_id: deviceId });
      if (error) throw error;
      notify("Device revoked.");
      await loadDevices();
    } catch (e: any) {
      notify(e?.message || "Could not revoke device.");
    } finally {
      setBusy(false);
    }
  };

  if (infoKey === "passkeys") {
    return (
      <div style={{ ...s.section, animation: "secIn 0.28s ease-out both" }}>
        <style>{MOTION}</style>
        <button type="button" style={{ ...s.secondaryBtn, width: "auto", marginBottom: 12 }} onClick={() => { setInfoKey(null); setError(""); }}>
          ← Back
        </button>
        <h3 style={{ margin: "0 0 8px", color: "#fff", fontSize: 17 }}>Passkeys</h3>
        <div style={s.infoBox}>
          Passkeys are step-up authentication only — not passwordless primary login. Use a device authenticator (Face ID, fingerprint, security key).
        </div>
        {error && <div style={s.errorBox}>{error}</div>}
        {pkLoading ? (
          <p style={{ color: "#777" }}>Loading…</p>
        ) : (
          <>
            {passkeys.length === 0 && <div style={s.infoBox}>No passkeys registered yet.</div>}
            {passkeys.map((pk: any) => (
              <div key={pk.id || pk.credential_id} style={{ ...s.row, marginBottom: 6 }}>
                <span style={s.rowLabel}>{pk.device_name || "Passkey"}</span>
                <button
                  type="button"
                  style={{ border: `1px solid ${BORDER}`, borderRadius: 99, background: "transparent", color: GOLD_LIGHT, fontWeight: 700, fontSize: 12, padding: "6px 12px", cursor: "pointer" }}
                  disabled={busy}
                  onClick={() => void revokePasskey(pk.id)}
                >
                  Revoke
                </button>
              </div>
            ))}
            <button type="button" style={s.primaryBtn} disabled={busy} onClick={() => void registerPasskey()}>
              {busy ? "Working…" : "Register passkey"}
            </button>
          </>
        )}
      </div>
    );
  }

  if (infoKey === "antiphish") {
    return (
      <div style={{ ...s.section, animation: "secIn 0.28s ease-out both" }}>
        <style>{MOTION}</style>
        <button type="button" style={{ ...s.secondaryBtn, width: "auto", marginBottom: 12 }} onClick={() => { setInfoKey(null); setError(""); }}>
          ← Back
        </button>
        <h3 style={{ margin: "0 0 8px", color: "#fff", fontSize: 17 }}>Anti-phishing Code</h3>
        <div style={s.infoBox}>
          This code appears in official emails so you can spot phishing. Stored via set_anti_phishing_code (security_settings). 4–20 characters.
        </div>
        <label style={s.field}>
          New code
          <input style={s.input} value={apCode} onChange={(e) => setApCode(e.target.value)} maxLength={20} placeholder="4–20 characters" autoComplete="off" />
        </label>
        {error && <div style={s.errorBox}>{error}</div>}
        <button type="button" style={s.primaryBtn} disabled={busy} onClick={() => void saveAntiPhish()}>
          {busy ? "Saving…" : "Save code"}
        </button>
      </div>
    );
  }

  if (infoKey === "fundpass") {
    const isSet = Boolean((profile as any)?.fund_password_set);
    return (
      <div style={{ ...s.section, animation: "secIn 0.28s ease-out both" }}>
        <style>{MOTION}</style>
        <button type="button" style={{ ...s.secondaryBtn, width: "auto", marginBottom: 12 }} onClick={() => { setInfoKey(null); setError(""); }}>
          ← Back
        </button>
        <h3 style={{ margin: "0 0 8px", color: "#fff", fontSize: 17 }}>Fund Password</h3>
        <div style={s.infoBox}>
          {isSet ? "A fund password is already set. Enter a new one to replace it." : "Set a fund password to protect sensitive fund actions. Min 6 characters. Never shared with the client after hashing."}
        </div>
        <label style={s.field}>
          New fund password
          <input style={s.input} type="password" value={fpNew} onChange={(e) => setFpNew(e.target.value)} autoComplete="new-password" />
        </label>
        <label style={s.field}>
          Confirm
          <input style={s.input} type="password" value={fpConfirm} onChange={(e) => setFpConfirm(e.target.value)} autoComplete="new-password" />
        </label>
        {error && <div style={s.errorBox}>{error}</div>}
        <button type="button" style={s.primaryBtn} disabled={busy} onClick={() => void saveFundPassword()}>
          {busy ? "Saving…" : isSet ? "Update fund password" : "Set fund password"}
        </button>
      </div>
    );
  }

  if (infoKey === "devices") {
    return (
      <div style={{ ...s.section, animation: "secIn 0.28s ease-out both" }}>
        <style>{MOTION}</style>
        <button type="button" style={{ ...s.secondaryBtn, width: "auto", marginBottom: 12 }} onClick={() => { setInfoKey(null); setError(""); }}>
          ← Back
        </button>
        <h3 style={{ margin: "0 0 8px", color: "#fff", fontSize: 17 }}>Trusted Devices</h3>
        {error && <div style={s.errorBox}>{error}</div>}
        {devLoading ? (
          <p style={{ color: "#777" }}>Loading…</p>
        ) : (
          <>
            {devices.length === 0 && <div style={s.infoBox}>No devices recorded yet.</div>}
            {devices.map((d: any) => (
              <div key={d.id || d.device_id} style={{ ...s.row, marginBottom: 6, flexDirection: "column", alignItems: "stretch", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span style={s.rowLabel}>{d.device_name || d.name || d.user_agent?.slice(0, 40) || "Device"}</span>
                  <button
                    type="button"
                    style={{ border: `1px solid ${BORDER}`, borderRadius: 99, background: "transparent", color: GOLD_LIGHT, fontWeight: 700, fontSize: 12, padding: "6px 12px", cursor: "pointer" }}
                    disabled={busy}
                    onClick={() => void revokeDevice(d.id || d.device_id)}
                  >
                    Revoke
                  </button>
                </div>
                <span style={{ color: "#666", fontSize: 11 }}>
                  {[d.platform, d.last_seen_at ? `Last seen ${new Date(d.last_seen_at).toLocaleString()}` : null].filter(Boolean).join(" · ")}
                </span>
              </div>
            ))}
          </>
        )}
      </div>
    );
  }

  if (infoKey === "securetx" || infoKey === "account") {
    const copy: Record<string, { title: string; body: string }> = {
      securetx: {
        title: "Secure Transaction Approval",
        body: "Backend enforcement is not active yet. Enabling a toggle here would not protect transactions. This remains unavailable until the server enforces it.",
      },
      account: {
        title: "Account Settings",
        body: "Account closure and deactivation are not available as self-service actions. Contact support if you need access restricted.",
      },
    };
    const item = copy[infoKey];
    return (
      <div style={{ ...s.section, animation: "secIn 0.28s ease-out both" }}>
        <style>{MOTION}</style>
        <button type="button" style={{ ...s.secondaryBtn, width: "auto", marginBottom: 12 }} onClick={() => setInfoKey(null)}>
          ← Back
        </button>
        <h3 style={{ margin: "0 0 12px", color: "#fff", fontSize: 17 }}>{item.title}</h3>
        <div style={s.infoBox}>{item.body}</div>
      </div>
    );
  }

  // ───────────────── Main list ─────────────────
  return (
    <div style={{ ...s.section, animation: "secIn 0.28s ease-out both" }}>
      <style>{MOTION}</style>

      <div style={s.sectionHeader}>Basic Protect</div>
      <p style={s.sectionDesc}>Essential protection for everyday account activity.</p>

      <button type="button" style={s.row} onClick={startEmailChange}>
        <span style={s.rowIcon}><SIcon name="mail" size={16} /></span>
        <span style={s.rowLabel}>Email</span>
        <span style={s.rowValue}>{maskEmail(profile?.email ?? null)}</span>
        <span style={s.rowChevron}><SIcon name="chevron" size={16} /></span>
      </button>

      <button type="button" style={s.row} onClick={() => setView("phone")}>
        <span style={s.rowIcon}><SIcon name="phone" size={16} /></span>
        <span style={s.rowLabel}>Mobile</span>
        <span style={s.rowValue}>
          {profile?.phone_verified ? maskPhone(profile?.phone ?? null) : "Coming soon"}
        </span>
        <span style={s.rowChevron}><SIcon name="chevron" size={16} /></span>
      </button>

      <div style={s.row}>
        <span style={s.rowIcon}><SIcon name="google" size={16} /></span>
        <span style={s.rowLabel}>Google 2FA Authentication</span>
        <button
          type="button"
          style={{ ...s.toggle, background: twoFaEnabled ? GOLD : "#333", transition: "background 0.25s ease" }}
          onClick={() => {
            if (twoFaEnabled) { setCode(""); setView("2fa-disable"); }
            else { void start2faSetup(); }
          }}
          aria-label={twoFaEnabled ? "Disable authenticator" : "Enable authenticator"}
        >
          <span style={{ ...s.toggleKnob, left: twoFaEnabled ? 21 : 3, transition: "left 0.22s ease" }} />
        </button>
      </div>

      <button type="button" style={s.row} onClick={() => void loadPasskeys()}>
        <span style={s.rowIcon}><SIcon name="lock" size={16} /></span>
        <span style={s.rowLabel}>Passkeys</span>
        <span style={{ ...s.rowValue, color: GOLD_LIGHT }}>Step-up only</span>
        <span style={s.rowChevron}><SIcon name="chevron" size={16} /></span>
      </button>

      <button type="button" style={s.row} onClick={() => setInfoKey("antiphish")}>
        <span style={s.rowIcon}><SIcon name="shield" size={16} /></span>
        <span style={s.rowLabel}>Anti-phishing Code</span>
        <span style={s.rowValue}>"Set / update"</span>
        <span style={s.rowChevron}><SIcon name="chevron" size={16} /></span>
      </button>

      <div style={s.sectionHeader}>Advanced Protect</div>
      <p style={s.sectionDesc}>Additional protection for key fund actions.</p>

      <button type="button" style={s.row} onClick={() => setInfoKey("fundpass")}>
        <span style={s.rowIcon}><SIcon name="lock" size={16} /></span>
        <span style={s.rowLabel}>Fund Password</span>
        <span style={s.rowValue}>{(profile as any)?.fund_password_set ? "Set" : "Not set"}</span>
        <span style={s.rowChevron}><SIcon name="chevron" size={16} /></span>
      </button>

      <button type="button" style={s.row} onClick={() => setInfoKey("securetx")}>
        <span style={s.rowIcon}><SIcon name="shield" size={16} /></span>
        <span style={s.rowLabel}>Secure Transaction Approval</span>
        <span style={{ ...s.rowValue, color: GOLD_LIGHT }}>Not active</span>
        <span style={s.rowChevron}><SIcon name="chevron" size={16} /></span>
      </button>

      <div style={s.sectionHeader}>Scenario-based protection</div>
      <p style={s.sectionDesc}>Extra protection for specific scenarios.</p>

      <button type="button" style={s.row} onClick={() => setView("withdrawal")}>
        <span style={s.rowIcon}><SIcon name="wallet" size={16} /></span>
        <span style={s.rowLabel}>Withdrawal Security</span>
        <span style={s.rowValue}>{locked ? `Locked ${lockRemaining}h` : "Open"}</span>
        <span style={s.rowChevron}><SIcon name="chevron" size={16} /></span>
      </button>

      <div style={s.sectionHeader}>Account access and management</div>

      <button type="button" style={s.row} onClick={startPasswordChange}>
        <span style={s.rowIcon}><SIcon name="lock" size={16} /></span>
        <span style={s.rowLabel}>Change Password</span>
        <span style={s.rowChevron}><SIcon name="chevron" size={16} /></span>
      </button>

      <button type="button" style={s.row} onClick={() => void loadDevices()}>
        <span style={s.rowIcon}><SIcon name="phone" size={16} /></span>
        <span style={s.rowLabel}>Trusted Devices</span>
        <span style={{ ...s.rowValue, color: GOLD_LIGHT }}>Info</span>
        <span style={s.rowChevron}><SIcon name="chevron" size={16} /></span>
      </button>

      <button type="button" style={s.row} onClick={() => setInfoKey("account")}>
        <span style={s.rowIcon}><SIcon name="user" size={16} /></span>
        <span style={s.rowLabel}>Account Settings</span>
        <span style={s.rowValue}>Overview</span>
        <span style={s.rowChevron}><SIcon name="chevron" size={16} /></span>
      </button>

      <div style={s.row}>
        <span style={s.rowIcon}><SIcon name="lock" size={16} /></span>
        <span style={s.rowLabel}>App Lock</span>
        <button
          type="button"
          style={{ ...s.toggle, background: appLock ? GOLD : "#333" }}
          onClick={async () => {
            const next = !appLock;
            setAppLock(next);
            try {
              const { error } = await supabase.from("profiles").update({ app_lock_enabled: next }).eq("id", userId);
              if (error) throw error;
              notify(next ? "App Lock enabled." : "App Lock disabled.");
              await onReload();
            } catch (e: any) {
              setAppLock(!next);
              notify(e?.message || "Could not update App Lock.");
            }
          }}
          aria-label="App Lock"
        >
          <span style={{ ...s.toggleKnob, left: appLock ? 21 : 3 }} />
        </button>
      </div>
    </div>
  );
}

