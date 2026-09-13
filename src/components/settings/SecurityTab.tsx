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

  // ───────────────── Main list ─────────────────
  return (
    <div style={{ ...s.section, animation: "secIn 0.28s ease-out both" }}>
      <style>{MOTION}</style>

      {/* Identity Verification */}
      <button
        type="button"
        style={{
          ...s.row,
          ...(kycVerified ? { cursor: "default" } : {}),
        }}
        onClick={() => {
          if (!kycVerified) {
            // Parent Settings / MyInfoTab already owns the full KycFlow modal.
            // We just surface status here. If you want a direct open, wire a prop.
            notify(
              kycPending
                ? "Your identity verification is under review."
                : kycRejected
                ? "Previous verification was rejected. Open My Info to resubmit."
                : "Open My Info → Identity Verification to start."
            );
          }
        }}
      >
        <span style={s.rowIcon}>
          <SIcon name="id" size={16} />
        </span>
        <span style={s.rowLabel}>Identity Verification</span>
        <span
          style={{
            ...s.rowValue,
            color: kycVerified ? "#39d98a" : kycPending ? GOLD_LIGHT : kycRejected ? "#ff9aa3" : "#888",
            fontWeight: 700,
          }}
        >
          {kycVerified ? "Verified" : kycPending ? "Pending" : kycRejected ? "Rejected" : "Unverified"}
        </span>
        {!kycVerified && (
          <span style={s.rowChevron}>
            <SIcon name="chevron" size={16} />
          </span>
        )}
      </button>

      {/* Email */}
      <button type="button" style={s.row} onClick={startEmailChange}>
        <span style={s.rowIcon}>
          <SIcon name="mail" size={16} />
        </span>
        <span style={s.rowLabel}>Email</span>
        <span style={s.rowValue}>{maskEmail(profile?.email ?? null)}</span>
        <span style={s.rowChevron}>
          <SIcon name="chevron" size={16} />
        </span>
      </button>

      {/* Mobile / Phone */}
      <button type="button" style={s.row} onClick={() => setView("phone")}>
        <span style={s.rowIcon}>
          <SIcon name="phone" size={16} />
        </span>
        <span style={s.rowLabel}>Mobile</span>
        <span style={s.rowValue}>
          {profile?.phone_verified ? maskPhone(profile?.phone ?? null) : "Not verified"}
        </span>
        <span style={s.rowChevron}>
          <SIcon name="chevron" size={16} />
        </span>
      </button>

      {/* Authenticator (2FA) */}
      <div style={s.row}>
        <span style={s.rowIcon}>
          <SIcon name="google" size={16} />
        </span>
        <span style={s.rowLabel}>Authenticator</span>
        <button
          type="button"
          style={{
            ...s.toggle,
            background: twoFaEnabled ? GOLD : "#333",
            transition: "background 0.25s ease",
          }}
          onClick={() => {
            if (twoFaEnabled) {
              setCode("");
              setView("2fa-disable");
            } else {
              void start2faSetup();
            }
          }}
          aria-label={twoFaEnabled ? "Disable authenticator" : "Enable authenticator"}
        >
          <span
            style={{
              ...s.toggleKnob,
              left: twoFaEnabled ? 21 : 3,
              transition: "left 0.22s ease",
            }}
          />
        </button>
      </div>

      {/* Withdrawal Security */}
      <button type="button" style={s.row} onClick={() => setView("withdrawal")}>
        <span style={s.rowIcon}>
          <SIcon name="wallet" size={16} />
        </span>
        <span style={s.rowLabel}>Withdrawal Security</span>
        <span style={s.rowValue}>{locked ? `Locked ${lockRemaining}h` : "Open"}</span>
        <span style={s.rowChevron}>
          <SIcon name="chevron" size={16} />
        </span>
      </button>

      {/* Change Password */}
      <button type="button" style={s.row} onClick={startPasswordChange}>
        <span style={s.rowIcon}>
          <SIcon name="lock" size={16} />
        </span>
        <span style={s.rowLabel}>Login Password</span>
        <span style={s.rowChevron}>
          <SIcon name="chevron" size={16} />
        </span>
      </button>
    </div>
  );
}
