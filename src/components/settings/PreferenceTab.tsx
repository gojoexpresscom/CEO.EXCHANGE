import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { s, GOLD, GOLD_LIGHT } from "./settingsStyles";
import { SIcon } from "./SettingsIcons";
import type { SettingsData } from "./Settings";

type Props = {
  data: SettingsData;
  onReload: () => Promise<void>;
  notify: (msg: string) => void;
};

type Sub = null | "timezone" | "withdrawal-address" | "limits" | "route" | "notifications" | "email-subs";

export default function PreferenceTab({ data, onReload, notify }: Props) {
  const { profile, prefs, userId } = data;
  const [sub, setSub] = useState<Sub>(null);
  const [busy, setBusy] = useState(false);
  const [tz, setTz] = useState(profile?.time_zone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  const [wakeLock, setWakeLock] = useState<WakeLockSentinel | null>(null);
  const [alwaysOn, setAlwaysOn] = useState(Boolean(prefs?.screen_always_on));
  const [addresses, setAddresses] = useState<any[]>([]);
  const [addrLoading, setAddrLoading] = useState(false);
  const [newAddr, setNewAddr] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState("");

  // Functional notification fields only
  const [notif, setNotif] = useState({
    notification_push: profile?.notification_push ?? true,
    email_security: profile?.email_security ?? true,
    email_trade: profile?.email_trade ?? true,
    email_marketing: profile?.email_marketing ?? false,
  });

  useEffect(() => {
    setAlwaysOn(Boolean(prefs?.screen_always_on));
  }, [prefs]);

  useEffect(() => {
    setTz(profile?.time_zone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
    setNotif({
      notification_push: profile?.notification_push ?? true,
      email_security: profile?.email_security ?? true,
      email_trade: profile?.email_trade ?? true,
      email_marketing: profile?.email_marketing ?? false,
    });
  }, [profile]);

  // Screen Wake Lock
  useEffect(() => {
    let cancelled = false;
    async function apply() {
      if (!alwaysOn) {
        if (wakeLock) {
          try { await wakeLock.release(); } catch { /* ignore */ }
          setWakeLock(null);
        }
        return;
      }
      if (!("wakeLock" in navigator)) return;
      try {
        const lock = await (navigator as any).wakeLock.request("screen");
        if (cancelled) { await lock.release(); return; }
        setWakeLock(lock);
        lock.addEventListener("release", () => setWakeLock(null));
      } catch { /* preference still saved */ }
    }
    void apply();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alwaysOn]);

  const saveTz = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.from("profiles").update({ time_zone: tz }).eq("id", userId);
      if (error) throw error;
      notify("Time zone saved.");
      setSub(null);
      await onReload();
    } catch (e: any) {
      notify(e?.message || "Could not save time zone.");
    } finally {
      setBusy(false);
    }
  };

  const upsertAlwaysOn = async (next: boolean) => {
    setBusy(true);
    try {
      const { error } = await supabase.from("user_preferences").upsert(
        { user_id: userId, screen_always_on: next, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
      if (error) throw error;
      setAlwaysOn(next);
      notify("Changes saved.");
      await onReload();
    } catch (e: any) {
      notify(e?.message || "Could not save.");
    } finally {
      setBusy(false);
    }
  };

  const toggleNotif = async (key: keyof typeof notif) => {
    const next = !notif[key];
    setNotif((f) => ({ ...f, [key]: next }));
    setBusy(true);
    try {
      const { error } = await supabase.from("profiles").update({ [key]: next }).eq("id", userId);
      if (error) throw error;
      notify("Notification preference saved.");
      await onReload();
    } catch (e: any) {
      setNotif((f) => ({ ...f, [key]: !next }));
      notify(e?.message || "Could not save preference.");
    } finally {
      setBusy(false);
    }
  };

  const loadAddresses = async () => {
    setAddrLoading(true);
    setSub("withdrawal-address");
    setError("");
    setOtpSent(false);
    setOtpCode("");
    setNewAddr("");
    try {
      const { data } = await supabase
        .from("withdrawal_addresses")
        .select("id,address,network,asset,created_at,label")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      setAddresses(data ?? []);
    } catch {
      setAddresses([]);
    } finally {
      setAddrLoading(false);
    }
  };

  const sendAddrOtp = async () => {
    setError("");
    setBusy(true);
    try {
      const { data: res, error: fnErr } = await supabase.functions.invoke("send-otp", {
        body: { purpose: "add_withdrawal_address" },
      });
      if (fnErr) throw fnErr;
      if (res?.error) throw new Error(String(res.error));
      setOtpSent(true);
      notify("Verification code sent.");
    } catch (e: any) {
      setError(e?.message || "Could not send code.");
    } finally {
      setBusy(false);
    }
  };

  const addAddress = async () => {
    if (!newAddr.trim()) {
      setError("Enter a wallet address.");
      return;
    }
    if (!/^\d{6}$/.test(otpCode)) {
      setError("Enter the 6-digit code.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      // Verify OTP first
      const { data: vRes, error: vErr } = await supabase.functions.invoke("verify-otp", {
        body: { code: otpCode, purpose: "add_withdrawal_address" },
      });
      if (vErr) throw vErr;
      if (vRes?.error || !vRes?.success) throw new Error(vRes?.error || "Invalid or expired code.");

      // Prefer RPC if available
      const { error: rpcErr } = await supabase.rpc("add_withdrawal_address", {
        p_address: newAddr.trim(),
      });
      if (rpcErr) {
        // Fallback insert (RLS should still protect)
        const { error: insErr } = await supabase.from("withdrawal_addresses").insert({
          user_id: userId,
          address: newAddr.trim(),
        });
        if (insErr) throw insErr;
      }
      notify("Withdrawal address added.");
      setNewAddr("");
      setOtpCode("");
      setOtpSent(false);
      await loadAddresses();
    } catch (e: any) {
      setError(e?.message || "Could not add address.");
    } finally {
      setBusy(false);
    }
  };

  if (sub === "timezone") {
    return (
      <div style={s.section}>
        <button type="button" style={{ ...s.secondaryBtn, width: "auto", marginBottom: 12 }} onClick={() => setSub(null)}>
          ← Back
        </button>
        <h3 style={{ margin: "0 0 12px", color: "#fff", fontSize: 17 }}>Benchmark Time Zone</h3>
        <label style={s.field}>
          Time zone (IANA)
          <input style={s.input} value={tz} onChange={(e) => setTz(e.target.value)} placeholder="e.g. Africa/Nairobi" />
        </label>
        <button type="button" style={s.primaryBtn} disabled={busy} onClick={() => void saveTz()}>
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    );
  }

  if (sub === "withdrawal-address") {
    return (
      <div style={s.section}>
        <button type="button" style={{ ...s.secondaryBtn, width: "auto", marginBottom: 12 }} onClick={() => setSub(null)}>
          ← Back
        </button>
        <h3 style={{ margin: "0 0 12px", color: "#fff", fontSize: 17 }}>Withdrawal Address</h3>
        {addrLoading ? (
          <p style={{ color: "#777" }}>Loading…</p>
        ) : (
          <>
            {addresses.length === 0 && <div style={s.infoBox}>No saved withdrawal addresses.</div>}
            {addresses.map((a) => (
              <div key={a.id} style={{ ...s.rowStatic, marginBottom: 6, flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
                <span style={{ color: "#fff", fontSize: 13, wordBreak: "break-all" }}>{a.address}</span>
                <span style={{ color: "#666", fontSize: 11 }}>
                  {[a.asset, a.network, a.label].filter(Boolean).join(" · ") || "Saved address"}
                </span>
              </div>
            ))}
            <label style={s.field}>
              New address
              <input style={s.input} value={newAddr} onChange={(e) => setNewAddr(e.target.value)} placeholder="Paste wallet address" />
            </label>
            {!otpSent ? (
              <button type="button" style={s.primaryBtn} disabled={busy || !newAddr.trim()} onClick={() => void sendAddrOtp()}>
                {busy ? "Sending…" : "Get verification code"}
              </button>
            ) : (
              <>
                <label style={s.field}>
                  6-digit code
                  <input
                    style={{ ...s.input, letterSpacing: 8, textAlign: "center", fontSize: 20, fontWeight: 700 }}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    inputMode="numeric"
                    maxLength={6}
                  />
                </label>
                <button type="button" style={s.primaryBtn} disabled={busy} onClick={() => void addAddress()}>
                  {busy ? "Adding…" : "Add address"}
                </button>
              </>
            )}
            {error && <div style={s.errorBox}>{error}</div>}
          </>
        )}
      </div>
    );
  }

  if (sub === "limits") {
    return (
      <div style={s.section}>
        <button type="button" style={{ ...s.secondaryBtn, width: "auto", marginBottom: 12 }} onClick={() => setSub(null)}>
          ← Back
        </button>
        <h3 style={{ margin: "0 0 12px", color: "#fff", fontSize: 17 }}>Manage Crypto Withdrawal Limits</h3>
        <div style={{ ...s.infoBox, flexDirection: "column", gap: 10 }}>
          <strong style={{ color: GOLD_LIGHT }}>Not user-configurable</strong>
          <p style={{ margin: 0, lineHeight: 1.45 }}>
            The platform currently enforces a global withdrawal limit with concurrency protection.
            There is no per-user adjustable limit system on the backend.
          </p>
          <span style={s.comingSoonPill}>UNAVAILABLE</span>
        </div>
      </div>
    );
  }

  if (sub === "route") {
    return (
      <div style={s.section}>
        <button type="button" style={{ ...s.secondaryBtn, width: "auto", marginBottom: 12 }} onClick={() => setSub(null)}>
          ← Back
        </button>
        <h3 style={{ margin: "0 0 12px", color: "#fff", fontSize: 17 }}>Route Deposits To</h3>
        <div style={{ ...s.infoBox, flexDirection: "column", gap: 10 }}>
          <p style={{ margin: 0, lineHeight: 1.45 }}>
            A preference field exists, but deposit crediting is not wired to it yet.
            Changing a value here would not affect real deposit routing.
          </p>
          <span style={s.comingSoonPill}>NOT ACTIVE</span>
        </div>
      </div>
    );
  }

  if (sub === "notifications" || sub === "email-subs") {
    const isEmail = sub === "email-subs";
    return (
      <div style={s.section}>
        <button type="button" style={{ ...s.secondaryBtn, width: "auto", marginBottom: 12 }} onClick={() => setSub(null)}>
          ← Back
        </button>
        <h3 style={{ margin: "0 0 8px", color: "#fff", fontSize: 17 }}>
          {isEmail ? "Email Subscriptions" : "Notification Settings"}
        </h3>
        <p style={{ color: "#888", fontSize: 12, margin: "0 0 14px", lineHeight: 1.4 }}>
          Only functional backend fields are shown. Decorative/unwired columns are not exposed.
        </p>
        {!isEmail && (
          <div style={s.row}>
            <span style={s.rowLabel}>Push notifications</span>
            <button
              type="button"
              style={{ ...s.toggle, background: notif.notification_push ? GOLD : "#333" }}
              disabled={busy}
              onClick={() => void toggleNotif("notification_push")}
            >
              <span style={{ ...s.toggleKnob, left: notif.notification_push ? 21 : 3 }} />
            </button>
          </div>
        )}
        <div style={s.row}>
          <span style={s.rowLabel}>Email — security</span>
          <button
            type="button"
            style={{ ...s.toggle, background: notif.email_security ? GOLD : "#333" }}
            disabled={busy}
            onClick={() => void toggleNotif("email_security")}
          >
            <span style={{ ...s.toggleKnob, left: notif.email_security ? 21 : 3 }} />
          </button>
        </div>
        <div style={s.row}>
          <span style={s.rowLabel}>Email — trading</span>
          <button
            type="button"
            style={{ ...s.toggle, background: notif.email_trade ? GOLD : "#333" }}
            disabled={busy}
            onClick={() => void toggleNotif("email_trade")}
          >
            <span style={{ ...s.toggleKnob, left: notif.email_trade ? 21 : 3 }} />
          </button>
        </div>
        <div style={s.row}>
          <span style={s.rowLabel}>Email — marketing</span>
          <button
            type="button"
            style={{ ...s.toggle, background: notif.email_marketing ? GOLD : "#333" }}
            disabled={busy}
            onClick={() => void toggleNotif("email_marketing")}
          >
            <span style={{ ...s.toggleKnob, left: notif.email_marketing ? 21 : 3 }} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={s.section}>
      <button type="button" style={s.row} onClick={() => setSub("timezone")}>
        <span style={s.rowIcon}><SIcon name="globe" size={16} /></span>
        <span style={s.rowLabel}>Benchmark Time Zone</span>
        <span style={s.rowValue}>{profile?.time_zone || "System"}</span>
        <span style={s.rowChevron}><SIcon name="chevron" size={16} /></span>
      </button>

      <button type="button" style={s.row} onClick={() => void loadAddresses()}>
        <span style={s.rowIcon}><SIcon name="wallet" size={16} /></span>
        <span style={s.rowLabel}>Withdrawal Address</span>
        <span style={s.rowChevron}><SIcon name="chevron" size={16} /></span>
      </button>

      <button type="button" style={s.row} onClick={() => setSub("limits")}>
        <span style={s.rowIcon}><SIcon name="lock" size={16} /></span>
        <span style={s.rowLabel}>Manage Crypto Withdrawal Limits</span>
        <span style={{ ...s.rowValue, color: GOLD_LIGHT }}>Unavailable</span>
        <span style={s.rowChevron}><SIcon name="chevron" size={16} /></span>
      </button>

      <button type="button" style={s.row} onClick={() => setSub("route")}>
        <span style={s.rowIcon}><SIcon name="wallet" size={16} /></span>
        <span style={s.rowLabel}>Route Deposits To</span>
        <span style={{ ...s.rowValue, color: GOLD_LIGHT }}>Not active</span>
        <span style={s.rowChevron}><SIcon name="chevron" size={16} /></span>
      </button>

      <button type="button" style={s.row} onClick={() => setSub("notifications")}>
        <span style={s.rowIcon}><SIcon name="bell" size={16} /></span>
        <span style={s.rowLabel}>Notification Settings</span>
        <span style={s.rowChevron}><SIcon name="chevron" size={16} /></span>
      </button>

      <button type="button" style={s.row} onClick={() => setSub("email-subs")}>
        <span style={s.rowIcon}><SIcon name="mail" size={16} /></span>
        <span style={s.rowLabel}>Email Subscriptions</span>
        <span style={s.rowChevron}><SIcon name="chevron" size={16} /></span>
      </button>

      {/* Authoritative Always On lives in Preference (deduplicated) */}
      <div style={s.row}>
        <span style={s.rowIcon}><SIcon name="screen" size={16} /></span>
        <span style={s.rowLabel}>Always on (no screen lock)</span>
        <button
          type="button"
          style={{ ...s.toggle, background: alwaysOn ? GOLD : "#333" }}
          disabled={busy}
          onClick={() => void upsertAlwaysOn(!alwaysOn)}
          aria-label="Toggle always-on display"
        >
          <span style={{ ...s.toggleKnob, left: alwaysOn ? 21 : 3 }} />
        </button>
      </div>
      <p style={{ color: "#666", fontSize: 11, margin: "-2px 4px 8px", lineHeight: 1.4 }}>
        Uses the browser Screen Wake Lock API when supported. The preference is saved; the OS may still dim the screen.
      </p>
    </div>
  );
}
