import React, { useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { s, GOLD, GOLD_LIGHT, BORDER, CARD } from "./settingsStyles";
import { SIcon } from "./SettingsIcons";
import type { SettingsData } from "./Settings";
import KycFlow from "./KycFlow";

type Props = {
  data: SettingsData;
  onReload: () => Promise<void>;
  notify: (msg: string) => void;
  onLogout: () => void;
};

function kycLabel(status: string | null) {
  if (!status) return "Unverified";
  const v = status.toLowerCase();
  if (v === "approved" || v === "verified") return "Lv.1 Verified";
  if (v === "pending" || v === "submitted") return "Under review";
  if (v === "rejected") return "Rejected — resubmit";
  return "Unverified";
}
function kycIsVerified(status: string | null) {
  const v = (status || "").toLowerCase();
  return v === "approved" || v === "verified";
}
function kycIsPending(status: string | null) {
  const v = (status || "").toLowerCase();
  return v === "pending" || v === "submitted";
}
function kycColor(status: string | null) {
  const v = (status || "").toLowerCase();
  if (v === "approved" || v === "verified") return "#39d98a";
  if (v === "pending" || v === "submitted") return GOLD;
  if (v === "rejected") return "#ff6574";
  return "#888";
}

export default function MyInfoTab({ data, onReload, notify, onLogout }: Props) {
  const { profile, socials, userId } = data;
  const fileRef = useRef<HTMLInputElement>(null);
  const [editingNick, setEditingNick] = useState(false);
  const [nick, setNick] = useState(profile?.nickname || "");
  const [saving, setSaving] = useState(false);
  const [showKyc, setShowKyc] = useState(false);
  const [linkView, setLinkView] = useState<"list" | "telegram" | "x" | "x-consent" | "x-redirect" | null>(null);
  const [tgCode, setTgCode] = useState("");
  const [tgExpires, setTgExpires] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [xAgree, setXAgree] = useState(false);
  const [xRedirectAgree, setXRedirectAgree] = useState(false);
  const [closePending, setClosePending] = useState(false);

  const tg = socials.find((x) => x.provider === "telegram");
  const tw = socials.find((x) => x.provider === "twitter" || x.provider === "x");

  const uploadAvatar = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      notify("Choose an image file (JPG, PNG, or WebP).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      notify("Image must be under 5 MB.");
      return;
    }
    setSaving(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${userId}/avatar.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const url = `${pub.publicUrl}?t=${Date.now()}`;
      const { error: pe } = await supabase
        .from("profiles")
        .update({ profile_picture_url: url })
        .eq("id", userId);
      if (pe) throw pe;
      notify("Profile picture updated.");
      await onReload();
    } catch (e: any) {
      notify(e?.message || "Could not upload picture. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const saveNickname = async () => {
    const trimmed = nick.trim().slice(0, 32);
    if (!trimmed) {
      notify("Nickname cannot be empty.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ nickname: trimmed })
        .eq("id", userId);
      if (error) throw error;
      notify("Changes saved.");
      setEditingNick(false);
      await onReload();
    } catch (e: any) {
      notify(e?.message || "Could not save nickname.");
    } finally {
      setSaving(false);
    }
  };

  const copyUid = async () => {
    const uid = profile?.uid || "";
    if (!uid) return;
    try {
      await navigator.clipboard.writeText(uid);
      notify("UID copied.");
    } catch {
      notify("Could not copy. Select and copy manually.");
    }
  };

  const requestTelegramCode = async () => {
    setError("");
    setSaving(true);
    try {
      const { data, error: rpcErr } = await supabase.rpc("request_social_link_code", {
        p_provider: "telegram",
      });
      if (rpcErr) throw rpcErr;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row?.code) throw new Error("No link code returned.");
      setTgCode(String(row.code));
      setTgExpires(row.expires_at ? String(row.expires_at) : null);
      notify("Link code ready. Send it to the bot.");
    } catch (e: any) {
      const msg = e?.message || "Could not request Telegram link code.";
      setError(msg);
      notify(msg);
    } finally {
      setSaving(false);
    }
  };

  const startXLink = async () => {
    setError("");
    setSaving(true);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("link-x-oauth", {
        body: { action: "start" },
      });
      if (fnErr) throw fnErr;
      if (data?.error) throw new Error(String(data.error));
      const url = data?.authorize_url;
      if (!url) throw new Error(data?.message || "X linking is not configured yet.");
      window.location.href = url;
    } catch (e: any) {
      const msg = e?.message || "X linking is not configured yet.";
      setError(msg);
      notify(msg);
      setLinkView("list");
    } finally {
      setSaving(false);
    }
  };

  const unlinkSocial = async (provider: string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("user_social_accounts")
        .delete()
        .eq("user_id", userId)
        .eq("provider", provider);
      if (error) throw error;
      notify("Account unlinked.");
      await onReload();
      setLinkView(null);
    } catch (e: any) {
      notify(e?.message || "Could not unlink.");
    } finally {
      setSaving(false);
    }
  };

  if (showKyc) {
    return (
      <KycFlow
        userId={userId}
        currentStatus={profile?.kyc_status ?? null}
        onClose={() => setShowKyc(false)}
        onSubmitted={async () => {
          setShowKyc(false);
          notify("Identity verification submitted.");
          await onReload();
        }}
        notify={notify}
      />
    );
  }

  // ── Link Account screens (reference style) ──
  if (linkView === "list") {
    return (
      <div style={s.section}>
        <button type="button" style={{ ...s.secondaryBtn, width: "auto", marginBottom: 12 }} onClick={() => setLinkView(null)}>
          ← Back
        </button>
        <h3 style={{ margin: "0 0 6px", color: "#fff", fontSize: 17, textAlign: "center" }}>Link Account</h3>
        <p style={{ margin: "0 0 16px", color: "#777", fontSize: 12, textAlign: "center", lineHeight: 1.45 }}>
          Connect a third-party account for quick login or event access.
        </p>

        {/* Telegram */}
        <div style={{ ...s.row, marginBottom: 8 }}>
          <span style={{ ...s.rowIcon, background: "#1a2a3a", borderColor: "#234" }}>
            <span style={{ fontSize: 14 }}>✈</span>
          </span>
          <span style={s.rowLabel}>Telegram</span>
          {tg ? (
            <button
              type="button"
              style={{
                border: `1px solid ${BORDER}`,
                borderRadius: 99,
                background: "transparent",
                color: GOLD_LIGHT,
                fontWeight: 700,
                fontSize: 12,
                padding: "6px 14px",
                cursor: "pointer",
              }}
              disabled={saving}
              onClick={() => void unlinkSocial("telegram")}
            >
              Unlink
            </button>
          ) : (
            <button
              type="button"
              style={{
                border: 0,
                borderRadius: 99,
                background: `linear-gradient(135deg,${GOLD},#d98e00)`,
                color: "#090909",
                fontWeight: 800,
                fontSize: 12,
                padding: "6px 14px",
                cursor: "pointer",
              }}
              onClick={() => setLinkView("telegram")}
            >
              Link
            </button>
          )}
        </div>
        {tg && (
          <p style={{ color: "#666", fontSize: 11, margin: "-4px 4px 12px" }}>
            Linked{tg.handle ? `: ${tg.handle}` : ""}. How to Unlink — use Unlink above.
          </p>
        )}

        {/* X */}
        <p style={{ margin: "16px 0 8px", color: "#777", fontSize: 12, lineHeight: 1.4 }}>
          Connect your X account to interact and earn event rewards.
        </p>
        <div style={{ ...s.row, marginBottom: 8 }}>
          <span style={s.rowIcon}>
            <span style={{ fontWeight: 900, fontSize: 13 }}>𝕏</span>
          </span>
          <span style={s.rowLabel}>{tw ? tw.handle || "Linked" : "Not yet configured"}</span>
          {tw ? (
            <button
              type="button"
              style={{
                border: `1px solid ${BORDER}`,
                borderRadius: 99,
                background: "transparent",
                color: GOLD_LIGHT,
                fontWeight: 700,
                fontSize: 12,
                padding: "6px 14px",
                cursor: "pointer",
              }}
              disabled={saving}
              onClick={() => void unlinkSocial(tw.provider)}
            >
              Unlink
            </button>
          ) : (
            <button
              type="button"
              style={{
                border: 0,
                borderRadius: 99,
                background: `linear-gradient(135deg,${GOLD},#d98e00)`,
                color: "#090909",
                fontWeight: 800,
                fontSize: 12,
                padding: "6px 14px",
                cursor: "pointer",
              }}
              onClick={() => {
                setXAgree(false);
                setLinkView("x-consent");
              }}
            >
              Unconfigured
            </button>
          )}
        </div>
      </div>
    );
  }

  if (linkView === "telegram") {
    return (
      <div style={s.section}>
        <div style={s.infoBox}>
          {tgCode
            ? `Open your Telegram bot and send: /link ${tgCode}`
            : "Request a one-time link code, then send it to the bot with /link <code>."}
          {tgExpires ? ` Code expires at ${new Date(tgExpires).toLocaleString()}.` : ""}
        </div>
        {error && <div style={s.errorBox}>{error}</div>}
        {!tgCode ? (
          <button type="button" style={s.primaryBtn} disabled={saving} onClick={() => void requestTelegramCode()}>
            {saving ? "Requesting…" : "Get Telegram link code"}
          </button>
        ) : (
          <button
            type="button"
            style={s.primaryBtn}
            disabled={saving}
            onClick={async () => {
              await onReload();
              notify("Refreshed linked accounts.");
            }}
          >
            I&apos;ve done it — refresh
          </button>
        )}
        <button
          type="button"
          style={s.secondaryBtn}
          onClick={() => {
            setLinkView("list");
            setTgCode("");
            setError("");
          }}
        >
          Cancel
        </button>
      </div>
    );
  }

  if (linkView === "x-consent") {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 90,
          background: "rgba(0,0,0,0.75)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 16,
        }}
      >
        <div
          style={{
            width: "min(100%, 360px)",
            background: CARD,
            borderRadius: 16,
            border: `1px solid ${BORDER}`,
            padding: "22px 18px",
          }}
        >
          <h3 style={{ margin: "0 0 12px", color: "#fff", fontSize: 17 }}>Connect to X</h3>
          <p style={{ margin: "0 0 12px", color: "#aaa", fontSize: 13, lineHeight: 1.5 }}>
            You&apos;ll be redirected to the X homepage to complete authorization for linking your account.
            By connecting your X account to CEO Exchange, you allow us to access:
          </p>
          <ul style={{ margin: "0 0 14px", paddingLeft: 18, color: "#999", fontSize: 12, lineHeight: 1.6 }}>
            <li>X profile information</li>
            <li>Posts from your timeline (including protected posts)</li>
            <li>Lists and collections (accounts you follow, mute or block)</li>
          </ul>
          <p style={{ margin: "0 0 14px", color: "#777", fontSize: 12 }}>You can unlink your account any time.</p>
          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 16, color: "#ccc", fontSize: 13 }}>
            <input type="checkbox" checked={xAgree} onChange={(e) => setXAgree(e.target.checked)} style={{ marginTop: 3 }} />
            I agree to the terms stated above.
          </label>
          <button
            type="button"
            style={{
              ...s.primaryBtn,
              marginTop: 0,
              opacity: xAgree ? 1 : 0.45,
            }}
            disabled={!xAgree || saving}
            onClick={() => {
              setXRedirectAgree(false);
              setLinkView("x-redirect");
            }}
          >
            Confirm
          </button>
          <button
            type="button"
            style={{ ...s.secondaryBtn, marginTop: 10 }}
            onClick={() => setLinkView("list")}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (linkView === "x-redirect") {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 90,
          background: "rgba(0,0,0,0.75)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 16,
        }}
      >
        <div
          style={{
            width: "min(100%, 360px)",
            background: CARD,
            borderRadius: 16,
            border: `1px solid ${BORDER}`,
            padding: "22px 18px",
          }}
        >
          <h3 style={{ margin: "0 0 12px", color: "#fff", fontSize: 17 }}>Redirect Notice</h3>
          <p style={{ margin: "0 0 14px", color: "#aaa", fontSize: 13, lineHeight: 1.5 }}>
            You are about to access products and services provided by third parties through a web browser.
            These services are not operated or endorsed by CEO Exchange. CEO Exchange is not responsible for
            your access to or use of any third-party websites or applications.
          </p>
          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 16, color: "#ccc", fontSize: 13 }}>
            <input
              type="checkbox"
              checked={xRedirectAgree}
              onChange={(e) => setXRedirectAgree(e.target.checked)}
              style={{ marginTop: 3 }}
            />
            I understand and accept full responsibility for all associated risks.
          </label>
          <button
            type="button"
            style={{
              ...s.primaryBtn,
              marginTop: 0,
              opacity: xRedirectAgree ? 1 : 0.45,
            }}
            disabled={!xRedirectAgree || saving}
            onClick={() => void startXLink()}
          >
            {saving ? "Opening…" : "Confirm"}
          </button>
          <button
            type="button"
            style={{ ...s.secondaryBtn, marginTop: 10 }}
            onClick={() => setLinkView("list")}
          >
            Cancel
          </button>
          {error && <div style={{ ...s.errorBox, marginTop: 12 }}>{error}</div>}
        </div>
      </div>
    );
  }

  if (closePending) {
    return (
      <div style={s.section}>
        <div style={s.infoBox}>
          Account closure is not available as a self-service action yet. Exchange accounts hold financial
          records, KYC data, and compliance history that require a formal retention policy before permanent
          closure can be enabled. Contact support if you need to restrict access to your account.
        </div>
        <button type="button" style={s.secondaryBtn} onClick={() => setClosePending(false)}>
          Back
        </button>
      </div>
    );
  }

  return (
    <div style={s.section}>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void uploadAvatar(f);
          e.target.value = "";
        }}
      />

      <button type="button" style={s.row} onClick={() => fileRef.current?.click()} disabled={saving}>
        <span style={s.rowIcon}><SIcon name="user" size={16} /></span>
        <span style={s.rowLabel}>Profile Picture</span>
        <span style={s.rowValue}>{saving ? "Uploading…" : ""}</span>
        {profile?.profile_picture_url ? (
          <img
            src={profile.profile_picture_url}
            alt=""
            style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", border: `1px solid ${BORDER}` }}
          />
        ) : null}
        <span style={s.rowChevron}><SIcon name="chevron" size={16} /></span>
      </button>

      {editingNick ? (
        <div style={{ ...s.row, flexDirection: "column", alignItems: "stretch", gap: 10 }}>
          <label style={{ ...s.field, margin: 0 }}>
            Nickname
            <input
              style={s.input}
              value={nick}
              onChange={(e) => setNick(e.target.value)}
              maxLength={32}
              autoFocus
            />
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" style={{ ...s.primaryBtn, margin: 0, flex: 1 }} disabled={saving} onClick={() => void saveNickname()}>
              Save changes
            </button>
            <button
              type="button"
              style={{ ...s.secondaryBtn, margin: 0, flex: 1 }}
              onClick={() => {
                setEditingNick(false);
                setNick(profile?.nickname || "");
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button type="button" style={s.row} onClick={() => setEditingNick(true)}>
          <span style={s.rowIcon}><SIcon name="edit" size={16} /></span>
          <span style={s.rowLabel}>Nickname</span>
          <span style={s.rowValue}>{profile?.nickname || "—"}</span>
          <span style={s.rowChevron}><SIcon name="chevron" size={16} /></span>
        </button>
      )}

      <div style={s.row}>
        <span style={s.rowIcon}><SIcon name="id" size={16} /></span>
        <span style={s.rowLabel}>UID</span>
        <span style={s.rowValue}>{profile?.uid || "—"}</span>
        <button
          type="button"
          style={{ border: 0, background: "transparent", color: GOLD, cursor: "pointer", padding: 4 }}
          onClick={() => void copyUid()}
          aria-label="Copy UID"
        >
          <SIcon name="copy" size={16} />
        </button>
      </div>

      {kycIsVerified(profile?.kyc_status ?? null) ? (
        <div style={s.row}>
          <span style={s.rowIcon}><SIcon name="shield" size={16} /></span>
          <span style={s.rowLabel}>Identity Verification</span>
          <span style={{ ...s.rowValue, color: "#39d98a" }}>Lv.1 Verified</span>
        </div>
      ) : kycIsPending(profile?.kyc_status ?? null) ? (
        <div style={s.row}>
          <span style={s.rowIcon}><SIcon name="shield" size={16} /></span>
          <span style={s.rowLabel}>Identity Verification</span>
          <span style={{ ...s.rowValue, color: GOLD }}>Under review</span>
        </div>
      ) : (
        <button type="button" style={s.row} onClick={() => setShowKyc(true)}>
          <span style={s.rowIcon}><SIcon name="shield" size={16} /></span>
          <span style={s.rowLabel}>Identity Verification</span>
          <span style={{ ...s.rowValue, color: kycColor(profile?.kyc_status ?? null) }}>
            {kycLabel(profile?.kyc_status ?? null)}
          </span>
          <span style={s.rowChevron}><SIcon name="chevron" size={16} /></span>
        </button>
      )}

      <div style={s.row}>
        <span style={s.rowIcon}><SIcon name="shield" size={16} /></span>
        <span style={s.rowLabel}>VIP level</span>
        <span style={s.rowValue}>
          {profile?.vip_level != null && profile?.vip_level !== "" ? String(profile.vip_level) : "Non-VIP"}
        </span>
      </div>

      <button type="button" style={s.row} onClick={() => setLinkView("list")}>
        <span style={s.rowIcon}><SIcon name="link" size={16} /></span>
        <span style={s.rowLabel}>Link Account</span>
        <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {tg && <span style={{ fontSize: 12, color: "#4ea1ff" }}>✈</span>}
          {tw && <span style={{ fontSize: 12, color: "#eee" }}>𝕏</span>}
        </span>
        <span style={s.rowChevron}><SIcon name="chevron" size={16} /></span>
      </button>

      {profile?.referral_code ? (
        <div style={s.row}>
          <span style={s.rowIcon}><SIcon name="users" size={16} /></span>
          <span style={s.rowLabel}>Referral code</span>
          <span style={s.rowValue}>{profile.referral_code}</span>
          <button
            type="button"
            style={{ border: 0, background: "transparent", color: GOLD, cursor: "pointer", padding: 4 }}
            onClick={() => {
              void navigator.clipboard.writeText(String(profile.referral_code));
              notify("Referral code copied.");
            }}
            aria-label="Copy referral code"
          >
            <SIcon name="copy" size={16} />
          </button>
        </div>
      ) : null}

      <button type="button" style={s.row} onClick={() => setClosePending(true)}>
        <span style={s.rowIcon}><SIcon name="lock" size={16} /></span>
        <span style={s.rowLabel}>Close Account</span>
        <span style={s.rowValue}>Pending policy</span>
        <span style={s.rowChevron}><SIcon name="chevron" size={16} /></span>
      </button>

      <button type="button" style={s.logoutBtn} onClick={() => void onLogout()}>
        <SIcon name="logout" size={18} /> Log Out
      </button>
    </div>
  );
}
