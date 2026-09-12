import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { s, GOLD, GOLD_LIGHT } from "./settingsStyles";
import { SIcon } from "./SettingsIcons";
import type { SettingsData } from "./Settings";
import SupportChat from "./SupportChat";

type Props = {
  data: SettingsData;
  onReload: () => Promise<void>;
  notify: (msg: string) => void;
  localTheme: "dark" | "light";
  setLocalTheme: (t: "dark" | "light") => void;
  onLogout: () => void;
};

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "zh", label: "中文" },
  { code: "es", label: "Español" },
  { code: "pt", label: "Português" },
  { code: "ru", label: "Русский" },
  { code: "ar", label: "العربية" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
  { code: "vi", label: "Tiếng Việt" },
  { code: "tr", label: "Türkçe" },
];

type CurrencyRow = { code: string; name: string | null };

type Sub =
  | null
  | "language"
  | "currency"
  | "help"
  | "support"
  | "about";

export default function GeneralTab({
  data,
  onReload,
  notify,
  localTheme,
  setLocalTheme,
  onLogout,
}: Props) {
  const { profile, userId, prefs } = data;
  const [sub, setSub] = useState<Sub>(null);
  const [currencies, setCurrencies] = useState<CurrencyRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [supportName, setSupportName] = useState("");
  const [supportEmail, setSupportEmail] = useState(profile?.email || "");
  const [candleMode, setCandleMode] = useState(prefs?.candle_color_mode || "green_up");
  const [alwaysOn, setAlwaysOn] = useState(Boolean(prefs?.screen_always_on));
  const [chatOpen, setChatOpen] = useState(false);
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
  const [dbLanguages, setDbLanguages] = useState<{ code: string; name: string }[]>([]);

  useEffect(() => {
    setCandleMode(prefs?.candle_color_mode || "green_up");
    setAlwaysOn(Boolean(prefs?.screen_always_on));
  }, [prefs]);

  useEffect(() => {
    void (async () => {
      const [{ data: rows }, { data: langs }] = await Promise.all([
        supabase.from("supported_currencies").select("code,name").order("code").limit(80),
        supabase.from("supported_languages").select("code,name").eq("is_active", true).order("sort_order"),
      ]);
      setCurrencies((rows as CurrencyRow[]) ?? []);
      setDbLanguages((langs as { code: string; name: string }[]) ?? []);
    })();
  }, []);

  const saveLang = async (code: string) => {
    setBusy(true);
    try {
      const { error } = await supabase.rpc("set_preferred_language", { p_lang: code });
      if (error) throw error;
      notify("Changes saved.");
      setSub(null);
      await onReload();
    } catch (e: any) {
      // Fallback if RPC missing
      try {
        const { error: e2 } = await supabase.from("profiles").update({ preferred_language: code }).eq("id", userId);
        if (e2) throw e2;
        notify("Changes saved.");
        setSub(null);
        await onReload();
      } catch (e3: any) {
        notify(e3?.message || e?.message || "Could not save language.");
      }
    } finally {
      setBusy(false);
    }
  };

  const saveCurrency = async (code: string) => {
    setBusy(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ preferred_currency: code })
        .eq("id", userId);
      if (error) throw error;
      notify("Changes saved.");
      setSub(null);
      await onReload();
    } catch (e: any) {
      notify(e?.message || "Could not save currency.");
    } finally {
      setBusy(false);
    }
  };

  const upsertPrefs = async (patch: { candle_color_mode?: string; screen_always_on?: boolean }) => {
    setBusy(true);
    try {
      const { error } = await supabase.from("user_preferences").upsert(
        { user_id: userId, ...patch, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
      if (error) throw error;
      notify("Changes saved.");
      await onReload();
    } catch (e: any) {
      notify(e?.message || "Could not save.");
    } finally {
      setBusy(false);
    }
  };

  const openSupportTicket = () => {
    if (!supportName.trim() || !supportEmail.trim()) {
      notify("Enter your name and email first.");
      return;
    }
    setChatOpen(true);
  };

  const langLabel =
    LANGUAGES.find((l) => l.code === (profile?.preferred_language || "en"))?.label || "English";
  const curLabel = profile?.preferred_currency || "USD";
  const greenUp = candleMode === "green_up" || candleMode === "green";

  if (sub === "language") {
    return (
      <div style={s.section}>
        <div style={s.infoBox}>
          Language is stored on your profile. String tables / i18n library can be added later without redesigning this picker.
        </div>
        {(dbLanguages.length ? dbLanguages.map((l) => ({ code: l.code, label: l.name })) : LANGUAGES).map((l) => (
          <button
            key={l.code}
            type="button"
            style={{
              ...s.row,
              borderColor: profile?.preferred_language === l.code ? GOLD : "transparent",
            }}
            disabled={busy}
            onClick={() => void saveLang(l.code)}
          >
            <span style={s.rowLabel}>{l.label}</span>
            {profile?.preferred_language === l.code && (
              <SIcon name="check" size={16} />
            )}
          </button>
        ))}
        <button type="button" style={s.secondaryBtn} onClick={() => setSub(null)}>
          Back
        </button>
      </div>
    );
  }

  if (sub === "currency") {
    return (
      <div style={s.section}>
        <div style={s.infoBox}>
          Display currency only. Balances stay in USD; conversion uses the live{" "}
          <code style={{ color: GOLD }}>convert_usd_amount</code> RPC.
        </div>
        {(currencies.length ? currencies : [{ code: "USD", name: "US Dollar" }]).map((c) => (
          <button
            key={c.code}
            type="button"
            style={s.row}
            disabled={busy}
            onClick={() => void saveCurrency(c.code)}
          >
            <span style={s.rowLabel}>{c.code}</span>
            <span style={s.rowValue}>{c.name || ""}</span>
          </button>
        ))}
        <button type="button" style={s.secondaryBtn} onClick={() => setSub(null)}>
          Back
        </button>
      </div>
    );
  }

  if (sub === "help") {
    return (
      <div style={s.section}>
        <a href="mailto:ceo.support.v@gmail.com" style={{ ...s.row, textDecoration: "none" }}>
          <span style={s.rowIcon}><SIcon name="mail" size={16} /></span>
          <span style={s.rowLabel}>Email support</span>
          <span style={s.rowValue}>ceo.support.v@gmail.com</span>
        </a>
        <a
          href="https://t.me/ceomarket_bot"
          target="_blank"
          rel="noopener noreferrer"
          style={{ ...s.row, textDecoration: "none" }}
        >
          <span style={s.rowIcon}><SIcon name="headset" size={16} /></span>
          <span style={s.rowLabel}>Telegram bot</span>
          <span style={s.rowValue}>t.me/ceomarket_bot</span>
        </a>
        <button type="button" style={s.row} onClick={() => setSub("support")}>
          <span style={s.rowIcon}><SIcon name="headset" size={16} /></span>
          <span style={s.rowLabel}>Live Chat</span>
          <span style={s.rowChevron}><SIcon name="chevron" size={16} /></span>
        </button>
        <button type="button" style={s.secondaryBtn} onClick={() => setSub(null)}>
          Back
        </button>
      </div>
    );
  }

  if (sub === "support") {
    return (
      <div style={s.section}>
        <div style={s.infoBox}>
          Live chat tickets auto-close after 15 minutes of inactivity (server cron). Keep this screen open while chatting.
        </div>
        <label style={s.field}>
          Full name
          <input style={s.input} value={supportName} onChange={(e) => setSupportName(e.target.value)} />
        </label>
        <label style={s.field}>
          Email
          <input style={s.input} type="email" value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} />
        </label>
        <button type="button" style={s.primaryBtn} disabled={busy} onClick={() => void openSupportTicket()}>
          {busy ? "Opening…" : "Start live chat"}
        </button>
        <button type="button" style={s.secondaryBtn} onClick={() => setSub(null)}>
          Cancel
        </button>
      </div>
    );
  }

  if (sub === "about") {
    return (
      <div style={s.section}>
        <div style={{ ...s.infoBox, flexDirection: "column", gap: 10 }}>
          <strong style={{ color: GOLD_LIGHT }}>CEO Exchange</strong>
          <p style={{ margin: 0, lineHeight: 1.5 }}>
            Crypto exchange product with spot markets, P2P marketplace, custodial deposits via
            provisioned wallet addresses, withdrawals, social feed, referrals, and live support tickets.
          </p>
          <p style={{ margin: 0, lineHeight: 1.5, color: "#999" }}>
            Built on Supabase Auth, Storage (avatars public, kyc-documents private), and Edge Functions
            for OTP, 2FA (TOTP), KYC submission, and notifications. No regulatory licenses, partnerships,
            or user counts are claimed here — only features present in the codebase and live project.
          </p>
        </div>
        <button type="button" style={s.secondaryBtn} onClick={() => setSub(null)}>
          Back
        </button>
      </div>
    );
  }

  if (chatOpen) {
    return (
      <SupportChat
        userId={userId}
        ticketId={activeTicketId}
        contactName={supportName.trim()}
        contactEmail={supportEmail.trim()}
        onClose={() => setChatOpen(false)}
        onTicketCreated={(id) => setActiveTicketId(id)}
        notify={notify}
      />
    );
  }

  return (
    <div style={s.section}>
      <button type="button" style={s.row} onClick={() => setSub("language")}>
        <span style={s.rowIcon}><SIcon name="globe" size={16} /></span>
        <span style={s.rowLabel}>Language</span>
        <span style={s.rowValue}>{langLabel}</span>
        <span style={s.rowChevron}><SIcon name="chevron" size={16} /></span>
      </button>

      <button type="button" style={s.row} onClick={() => setSub("currency")}>
        <span style={s.rowIcon}><SIcon name="currency" size={16} /></span>
        <span style={s.rowLabel}>Currency Display</span>
        <span style={s.rowValue}>{curLabel}</span>
        <span style={s.rowChevron}><SIcon name="chevron" size={16} /></span>
      </button>

      <div style={s.row}>
        <span style={s.rowIcon}><SIcon name="sun" size={16} /></span>
        <span style={s.rowLabel}>Color Theme</span>
        <span style={s.rowValue}>{localTheme === "dark" ? "Dark Mode" : "Light Mode"}</span>
        <button
          type="button"
          style={{ ...s.toggle, background: localTheme === "dark" ? GOLD : "#555" }}
          onClick={() => {
            setLocalTheme(localTheme === "dark" ? "light" : "dark");
            notify("Theme is session-only — no backend column yet.");
          }}
          aria-label="Toggle color theme"
        >
          <span style={{ ...s.toggleKnob, left: localTheme === "dark" ? 21 : 3 }} />
        </button>
      </div>
      <p style={{ color: "#666", fontSize: 11, margin: "-6px 6px 10px" }}>
        No dark/light column exists yet. Toggle works for this session only.
      </p>

      <div style={s.row}>
        <span style={s.rowIcon}><SIcon name="palette" size={16} /></span>
        <span style={s.rowLabel}>Color Preferences</span>
        <div style={{ display: "flex", gap: 5 }}>
          <span style={{ width: 12, height: 12, borderRadius: 2, background: greenUp ? "#1ecf8a" : "#ff5c6c" }} />
          <span style={{ width: 12, height: 12, borderRadius: 2, background: greenUp ? "#ff5c6c" : "#1ecf8a" }} />
        </div>
        <button
          type="button"
          style={{ border: 0, background: "transparent", color: GOLD, fontSize: 12, cursor: "pointer" }}
          disabled={busy}
          onClick={() => {
            const next = greenUp ? "red_up" : "green_up";
            setCandleMode(next);
            void upsertPrefs({ candle_color_mode: next });
          }}
        >
          Swap
        </button>
      </div>

      <div style={s.row}>
        <span style={s.rowIcon}><SIcon name="screen" size={16} /></span>
        <span style={s.rowLabel}>Always on (no screen lock)</span>
        <button
          type="button"
          style={{ ...s.toggle, background: alwaysOn ? GOLD : "#333" }}
          disabled={busy}
          onClick={() => {
            const next = !alwaysOn;
            setAlwaysOn(next);
            void upsertPrefs({ screen_always_on: next });
          }}
        >
          <span style={{ ...s.toggleKnob, left: alwaysOn ? 21 : 3 }} />
        </button>
      </div>

      <button type="button" style={s.row} onClick={() => setSub("help")}>
        <span style={s.rowIcon}><SIcon name="help" size={16} /></span>
        <span style={s.rowLabel}>Help Center</span>
        <span style={s.rowChevron}><SIcon name="chevron" size={16} /></span>
      </button>

      <button
        type="button"
        style={s.row}
        onClick={() => {
          window.history.pushState({}, "", "/");
          window.dispatchEvent(new PopStateEvent("popstate"));
          notify("Open markets from the home screen.");
        }}
      >
        <span style={s.rowIcon}><SIcon name="chart" size={16} /></span>
        <span style={s.rowLabel}>Trade market overview</span>
        <span style={s.rowChevron}><SIcon name="chevron" size={16} /></span>
      </button>

      <button type="button" style={s.row} onClick={() => setSub("support")}>
        <span style={s.rowIcon}><SIcon name="headset" size={16} /></span>
        <span style={s.rowLabel}>Contact Support</span>
        <span style={s.rowChevron}><SIcon name="chevron" size={16} /></span>
      </button>

      <a
        href="mailto:ceo.exchange.web@gmail.com?subject=CEO%20Exchange%20Feedback"
        style={{ ...s.row, textDecoration: "none" }}
      >
        <span style={s.rowIcon}><SIcon name="edit" size={16} /></span>
        <span style={s.rowLabel}>User feedback</span>
        <span style={s.rowChevron}><SIcon name="chevron" size={16} /></span>
      </a>

      <button type="button" style={s.row} onClick={() => setSub("about")}>
        <span style={s.rowIcon}><SIcon name="info" size={16} /></span>
        <span style={s.rowLabel}>About Us</span>
        <span style={s.rowChevron}><SIcon name="chevron" size={16} /></span>
      </button>

      {/* Storage management intentionally removed per spec */}

      <div style={s.row}>
        <span style={s.rowIcon}><SIcon name="thumb" size={16} /></span>
        <span style={s.rowLabel}>Rate Our App</span>
        <span style={s.rowValue}>Coming Soon</span>
      </div>

      <button type="button" style={s.logoutBtn} onClick={() => void onLogout()}>
        <SIcon name="logout" size={18} /> Log Out
      </button>
    </div>
  );
}
