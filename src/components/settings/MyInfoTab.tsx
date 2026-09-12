import React, { useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { s, GOLD } from "./settingsStyles";
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
  if (!status) return "Not started";
  const v = status.toLowerCase();
  if (v === "approved" || v === "verified") return "Lv.1 Verified";
  if (v === "pending" || v === "submitted") return "Under review";
  if (v === "rejected") return "Rejected";
  return status;
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
  const [linkProvider, setLinkProvider] = useState<"telegram" | "twitter" | null>(null);
  const [linkHandle, setLinkHandle] = useState("");

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

  const saveSocial = async () => {
    if (!linkProvider) return;
    const handle = linkHandle.trim().replace(/^@/, "");
    if (!handle) {
      notify("Enter a handle.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("user_social_accounts").upsert(
        {
          user_id: userId,
          provider: linkProvider,
          handle,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,provider" }
      );
      if (error) throw error;
      notify(`${linkProvider === "telegram" ? "Telegram" : "X"} linked.`);
      setLinkProvider(null);
      setLinkHandle("");
      await onReload();
    } catch (e: any) {
      notify(e?.message || "Could not link account.");
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

  if (linkProvider) {
    return (
      <div style={s.section}>
        <div style={s.infoBox}>
          Link is stored on your account. Ownership verification is not yet enforced by the backend —
          do not treat this as a verified identity link.
        </div>
        <label style={s.field}>
          {linkProvider === "telegram" ? "Telegram handle" : "X (Twitter) handle"}
          <input
            style={s.input}
            value={linkHandle}
            onChange={(e) => setLinkHandle(e.target.value)}
            placeholder="@username"
            autoFocus
          />
        </label>
        <button type="button" style={s.primaryBtn} disabled={saving} onClick={() => void saveSocial()}>
          {saving ? "Saving…" : "Link account"}
        </button>
        <button type="button" style={s.secondaryBtn} onClick={() => setLinkProvider(null)}>
          Cancel
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
            <button type="button" style={{ ...s.secondaryBtn, margin: 0, flex: 1 }} onClick={() => { setEditingNick(false); setNick(profile?.nickname || ""); }}>
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

      <button type="button" style={s.row} onClick={() => setShowKyc(true)}>
        <span style={s.rowIcon}><SIcon name="shield" size={16} /></span>
        <span style={s.rowLabel}>Identity Verification</span>
        <span style={{ ...s.rowValue, color: kycColor(profile?.kyc_status ?? null) }}>
          {kycLabel(profile?.kyc_status ?? null)}
        </span>
        <span style={s.rowChevron}><SIcon name="chevron" size={16} /></span>
      </button>

      <button
        type="button"
        style={s.row}
        onClick={() => {
          // Open a small chooser
          const next = window.prompt("Link which account? Type telegram or x");
          if (next === "telegram" || next === "x" || next === "twitter") {
            setLinkProvider(next === "x" || next === "twitter" ? "twitter" : "telegram");
            setLinkHandle("");
          }
        }}
      >
        <span style={s.rowIcon}><SIcon name="link" size={16} /></span>
        <span style={s.rowLabel}>Link Account</span>
        <span style={s.rowValue}>
          {tg || tw
            ? [tg && `TG @${tg.handle}`, tw && `X @${tw.handle}`].filter(Boolean).join(" · ")
            : "Not linked"}
        </span>
        <span style={s.rowChevron}><SIcon name="chevron" size={16} /></span>
      </button>

      {(tg || tw) && (
        <div style={{ display: "flex", gap: 8, padding: "0 4px" }}>
          {tg && (
            <button type="button" style={{ ...s.secondaryBtn, margin: 0, flex: 1, fontSize: 12 }} onClick={() => void unlinkSocial("telegram")}>
              Unlink Telegram
            </button>
          )}
          {tw && (
            <button type="button" style={{ ...s.secondaryBtn, margin: 0, flex: 1, fontSize: 12 }} onClick={() => void unlinkSocial(tw.provider)}>
              Unlink X
            </button>
          )}
        </div>
      )}

      <a
        href="https://t.me/ceomarket_bot"
        target="_blank"
        rel="noopener noreferrer"
        style={{ ...s.row, textDecoration: "none" }}
      >
        <span style={s.rowIcon}><SIcon name="users" size={16} /></span>
        <span style={s.rowLabel}>Affiliate&apos;s Community</span>
        <span style={s.rowValue}>Join</span>
        <span style={s.rowChevron}><SIcon name="chevron" size={16} /></span>
      </a>

      <a
        href="https://t.me/ceomarket_bot"
        target="_blank"
        rel="noopener noreferrer"
        style={{ ...s.row, textDecoration: "none" }}
      >
        <span style={s.rowIcon}><SIcon name="community" size={16} /></span>
        <span style={s.rowLabel}>Join Our Community</span>
        <span style={s.rowChevron}><SIcon name="chevron" size={16} /></span>
      </a>

      <button type="button" style={s.logoutBtn} onClick={() => void onLogout()}>
        <SIcon name="logout" size={18} /> Log Out
      </button>
    </div>
  );
}
