import React, { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { s, GOLD, GOLD_LIGHT } from "./settingsStyles";
import { SIcon } from "./SettingsIcons";
import MyInfoTab from "./MyInfoTab";
import SecurityTab from "./SecurityTab";
import PreferenceTab from "./PreferenceTab";
import GeneralTab from "./GeneralTab";

export type SettingsTab = "My Info" | "Security" | "Preference" | "General";

type ProfileRow = {
  id: string;
  uid: string | null;
  nickname: string | null;
  email: string | null;
  phone: string | null;
  phone_verified: boolean | null;
  country_code: string | null;
  profile_picture_url: string | null;
  kyc_status: string | null;
  preferred_language: string | null;
  preferred_currency: string | null;
  withdrawal_lock_until: string | null;
  security_level: string | null;
  warning_count: number | null;
  role: string | null;
};

type TwoFaRow = {
  is_enabled: boolean | null;
};

type PrefsRow = {
  candle_color_mode: string | null;
  screen_always_on: boolean | null;
};

type SocialRow = {
  provider: string;
  handle: string | null;
};

export type SettingsData = {
  profile: ProfileRow | null;
  twoFaEnabled: boolean;
  prefs: PrefsRow | null;
  socials: SocialRow[];
  userId: string;
};

type Props = {
  initialTab?: SettingsTab;
  onClose: () => void;
  onLogout: () => void;
};

function maskEmail(email: string | null) {
  if (!email) return "—";
  const [local, domain] = email.split("@");
  if (!domain) return email;
  const shown = local.slice(0, Math.min(3, local.length));
  return `${shown}***@***`;
}

function maskPhone(phone: string | null) {
  if (!phone) return "Not set";
  if (phone.length < 6) return phone;
  return `${phone.slice(0, 2)}****${phone.slice(-3)}`;
}

export default function Settings({ initialTab = "My Info", onClose, onLogout }: Props) {
  const [tab, setTab] = useState<SettingsTab>(initialTab);
  const [data, setData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [localTheme, setLocalTheme] = useState<"dark" | "light">("dark");
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [languages, setLanguages] = useState<{ code: string; name: string }[]>([]);
  const [langBusy, setLangBusy] = useState(false);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(""), 3200);
  }, []);

  const reload = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const uid = sessionData.session?.user?.id;
    if (!uid) {
      setLoading(false);
      return;
    }

    const [
      { data: profile },
      { data: twoFa },
      { data: prefs },
      { data: socials },
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select(
          "id,uid,nickname,email,phone,phone_verified,country_code,profile_picture_url,kyc_status,preferred_language,preferred_currency,withdrawal_lock_until,security_level,warning_count,role"
        )
        .eq("id", uid)
        .maybeSingle(),
      supabase.from("two_factor_auth").select("is_enabled").eq("user_id", uid).maybeSingle(),
      supabase.from("user_preferences").select("candle_color_mode,screen_always_on").eq("user_id", uid).maybeSingle(),
      supabase.from("user_social_accounts").select("provider,handle").eq("user_id", uid),
    ]);

    setData({
      userId: uid,
      profile: (profile as ProfileRow) ?? null,
      twoFaEnabled: Boolean((twoFa as TwoFaRow | null)?.is_enabled),
      prefs: (prefs as PrefsRow) ?? null,
      socials: (socials as SocialRow[]) ?? [],
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const openLangPicker = async () => {
    setShowLangPicker(true);
    if (languages.length) return;
    const { data: rows } = await supabase
      .from("supported_languages")
      .select("code,name")
      .eq("is_active", true)
      .order("sort_order");
    setLanguages((rows as { code: string; name: string }[]) ?? []);
  };

  const setLanguage = async (code: string) => {
    setLangBusy(true);
    try {
      const { error } = await supabase.rpc("set_preferred_language", { p_lang: code });
      if (error) throw error;
      notify("Language updated.");
      setShowLangPicker(false);
      await reload();
    } catch (e: any) {
      notify(e?.message || "Could not save language.");
    } finally {
      setLangBusy(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    onLogout();
  };

  if (loading || !data) {
    return (
      <div style={s.overlay}>
        <div style={s.header}>
          <button type="button" style={s.headerBtn} onClick={onClose} aria-label="Back">
            <SIcon name="back" size={22} />
          </button>
          <h2 style={s.headerTitle}>User Center</h2>
          <span style={{ width: 40 }} />
        </div>
        <div style={{ ...s.body, display: "grid", placeItems: "center", color: "#777" }}>
          Loading…
        </div>
      </div>
    );
  }

  const p = data.profile;
  const securityLabel = (p?.security_level || "Medium").toString();
  const isHigh = /high/i.test(securityLabel);

  return (
    <div style={s.overlay} className="ceo-fullscreen-overlay">
      <div style={s.header}>
        <button type="button" style={s.headerBtn} onClick={onClose} aria-label="Back">
          <SIcon name="back" size={22} />
        </button>
        <h2 style={s.headerTitle}>User Center</h2>
        <div style={{ display: "flex", gap: 2 }}>
          <button
            type="button"
            style={s.headerBtn}
            onClick={() => setLocalTheme((t) => (t === "dark" ? "light" : "dark"))}
            aria-label="Toggle theme (session only)"
            title="Theme is session-only until backend column exists"
          >
            <SIcon name={localTheme === "dark" ? "moon" : "sun"} size={18} />
          </button>
          <button type="button" style={s.headerBtn} aria-label="Language" onClick={() => void openLangPicker()}>
            <SIcon name="globe" size={18} />
          </button>
        </div>
      </div>

      <div style={s.body}>
        {/* Profile header */}
        <div style={s.profileBlock}>
          <div style={s.avatarWrap}>
            {p?.profile_picture_url ? (
              <img src={p.profile_picture_url} alt="" style={s.avatar} />
            ) : (
              <div style={s.avatarPlaceholder}>
                {(p?.nickname || "CE").slice(0, 2).toUpperCase()}
              </div>
            )}
            <div style={s.cameraBadge} title="Change photo in My Info">
              <SIcon name="camera" size={12} />
            </div>
          </div>
          <div style={s.profileMeta}>
            <div style={s.profileEmail}>{maskEmail(p?.email ?? null)}</div>
            <div style={s.securityRow}>
              Security Level{" "}
              <span style={isHigh ? s.securityHigh : { color: GOLD_LIGHT, fontWeight: 700 }}>
                {securityLabel}
              </span>
              <span style={{ color: isHigh ? "#39d98a" : GOLD, letterSpacing: 1 }}>■■■</span>
            </div>
            <span style={s.sitePill}>Site: CEO Exchange</span>
          </div>
        </div>

        {/* Tabs */}
        <div style={s.tabs}>
          {(["My Info", "Security", "Preference", "General"] as SettingsTab[]).map((t) => (
            <button
              key={t}
              type="button"
              style={{ ...s.tab, ...(tab === t ? s.tabActive : {}) }}
              onClick={() => setTab(t)}
            >
              {t}
              {tab === t && <span style={s.tabUnderline} />}
            </button>
          ))}
        </div>

        {tab === "My Info" && (
          <MyInfoTab data={data} onReload={reload} notify={notify} onLogout={handleLogout} />
        )}
        {tab === "Security" && (
          <SecurityTab data={data} onReload={reload} notify={notify} maskEmail={maskEmail} maskPhone={maskPhone} />
        )}
        {tab === "Preference" && (
          <PreferenceTab data={data} onReload={reload} notify={notify} />
        )}
        {tab === "General" && (
          <GeneralTab
            data={data}
            onReload={reload}
            notify={notify}
            localTheme={localTheme}
            setLocalTheme={setLocalTheme}
            onLogout={handleLogout}
          />
        )}
      </div>

      {showLangPicker && (
        <div style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(0,0,0,0.72)", display: "flex", alignItems: "flex-end" }} onClick={() => setShowLangPicker(false)}>
          <div style={{ width: "100%", maxHeight: "70%", overflowY: "auto", background: "#0a0a0a", borderTop: "1px solid #2a2110", borderRadius: "16px 16px 0 0", padding: "16px 14px calc(20px + env(safe-area-inset-bottom))" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ width: 42, height: 4, borderRadius: 99, background: "#3a3220", margin: "0 auto 14px" }} />
            <h3 style={{ margin: "0 0 12px", color: "#fff", fontSize: 16 }}>Language</h3>
            {(languages.length ? languages : [{ code: "en", name: "English" }]).map((l) => (
              <button
                key={l.code}
                type="button"
                style={{ ...s.row, marginBottom: 6 }}
                disabled={langBusy}
                onClick={() => void setLanguage(l.code)}
              >
                <span style={s.rowLabel}>{l.name}</span>
                {data.profile?.preferred_language === l.code && <SIcon name="check" size={16} />}
              </button>
            ))}
            <button type="button" style={s.secondaryBtn} onClick={() => setShowLangPicker(false)}>Close</button>
          </div>
        </div>
      )}
      {toast && <div style={s.toast}>{toast}</div>}
    </div>
  );
}
