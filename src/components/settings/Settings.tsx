import React, { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { s, GOLD } from "./settingsStyles";
import { SIcon } from "./SettingsIcons";
import MyInfoTab from "./MyInfoTab";
import SecurityTab from "./SecurityTab";
import GeneralTab from "./GeneralTab";
import PreferenceTab from "./PreferenceTab";

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
  vip_level: string | number | null;
  referral_code: string | null;
  color_theme: string | null;
  time_zone: string | null;
  deposit_to: string | null;
  app_lock_enabled: boolean | null;
  notification_push: boolean | null;
  email_security: boolean | null;
  email_trade: boolean | null;
  email_marketing: boolean | null;
  anti_phishing_code: string | null;
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

function applyThemeClass(theme: string) {
  const root = document.documentElement;
  root.classList.remove("theme-light", "theme-dark", "theme-classic");
  if (theme === "light") root.classList.add("theme-light");
  else if (theme === "classic") root.classList.add("theme-classic");
  else if (theme === "system") {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (!prefersDark) root.classList.add("theme-light");
  }
  // dark is default (no class needed)
}

export default function Settings({ initialTab = "My Info", onClose, onLogout }: Props) {
  const [tab, setTab] = useState<SettingsTab>(initialTab);
  const [data, setData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
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
          "id,uid,nickname,email,phone,phone_verified,country_code,profile_picture_url,kyc_status,preferred_language,preferred_currency,withdrawal_lock_until,security_level,warning_count,role,vip_level,referral_code,color_theme,time_zone,deposit_to,app_lock_enabled,notification_push,email_security,email_trade,email_marketing,anti_phishing_code"
        )
        .eq("id", uid)
        .maybeSingle(),
      supabase.from("two_factor_auth").select("is_enabled").eq("user_id", uid).maybeSingle(),
      supabase.from("user_preferences").select("candle_color_mode,screen_always_on").eq("user_id", uid).maybeSingle(),
      supabase.from("user_social_accounts").select("provider,handle").eq("user_id", uid),
    ]);

    const p = (profile as ProfileRow) ?? null;
    if (p?.color_theme) applyThemeClass(p.color_theme);

    setData({
      userId: uid,
      profile: p,
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
  const displayName = p?.nickname || maskEmail(p?.email ?? null);
  const themeIcon =
    (p?.color_theme || "dark") === "light" || (p?.color_theme || "dark") === "classic"
      ? "sun"
      : "moon";

  return (
    <div style={s.overlay} className="ceo-fullscreen-overlay">
      <style>{`
        @keyframes ceoFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes ucTabIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @media (prefers-reduced-motion: reduce) {
          * { animation: none !important; transition: none !important; }
        }
      `}</style>
      <div style={s.header}>
        <button type="button" style={s.headerBtn} onClick={onClose} aria-label="Back">
          <SIcon name="back" size={22} />
        </button>
        <h2 style={s.headerTitle}>User Center</h2>
        <div style={{ display: "flex", gap: 2 }}>
          <button
            type="button"
            style={s.headerBtn}
            onClick={() => setTab("General")}
            aria-label="Theme (open General)"
            title="Change color theme in General"
          >
            <SIcon name={themeIcon} size={18} />
          </button>
          <button type="button" style={s.headerBtn} aria-label="Language" onClick={() => void openLangPicker()}>
            <SIcon name="globe" size={18} />
          </button>
        </div>
      </div>

      <div style={s.body}>
        <div style={s.profileBlock}>
          <div style={s.avatarWrap}>
            {p?.profile_picture_url ? (
              <img src={p.profile_picture_url} alt="" style={s.avatar} />
            ) : (
              <div style={s.avatarPlaceholder}>
                {(p?.nickname || "CE").slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>
          <div style={s.profileMeta}>
            <div style={s.profileEmail}>{displayName}</div>
            <span style={s.sitePill}>Site: CEO Exchange</span>
          </div>
        </div>

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

        <div key={tab} style={{ animation: "ucTabIn 0.28s ease-out both" }}>
          {tab === "My Info" && (
            <MyInfoTab data={data} onReload={reload} notify={notify} onLogout={handleLogout} />
          )}
          {tab === "Security" && (
            <SecurityTab
              data={data}
              onReload={reload}
              notify={notify}
              maskEmail={maskEmail}
              maskPhone={maskPhone}
            />
          )}
          {tab === "Preference" && (
            <PreferenceTab data={data} onReload={reload} notify={notify} />
          )}
          {tab === "General" && (
            <GeneralTab
              data={data}
              onReload={reload}
              notify={notify}
              onLogout={handleLogout}
            />
          )}
        </div>
      </div>

      {showLangPicker && (
        <div style={s.sheetOverlay} onClick={() => setShowLangPicker(false)}>
          <div style={s.sheet} onClick={(e) => e.stopPropagation()}>
            <div style={s.sheetHandle} />
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
            <button type="button" style={s.secondaryBtn} onClick={() => setShowLangPicker(false)}>
              Close
            </button>
          </div>
        </div>
      )}
      {toast && <div style={s.toast}>{toast}</div>}
    </div>
  );
}
