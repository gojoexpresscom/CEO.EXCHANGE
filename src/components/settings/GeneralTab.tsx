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
  onLogout: () => void;
};

type CurrencyRow = { code: string; name: string | null };

type Sub =
  | null
  | "language"
  | "currency"
  | "theme"
  | "colors"
  | "help"
  | "support"
  | "about"
  | "storage"
  | "feedback";

const THEMES = [
  { value: "dark", label: "Dark Mode" },
  { value: "light", label: "Light Mode" },
  { value: "classic", label: "Classic" },
  { value: "system", label: "System" },
];

function applyThemeClass(theme: string) {
  const root = document.documentElement;
  root.classList.remove("theme-light", "theme-dark", "theme-classic");
  if (theme === "light") root.classList.add("theme-light");
  else if (theme === "classic") root.classList.add("theme-classic");
  else if (theme === "system") {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (!prefersDark) root.classList.add("theme-light");
  }
}

export default function GeneralTab({ data, onReload, notify, onLogout }: Props) {
  const { profile, userId, prefs } = data;
  const [sub, setSub] = useState<Sub>(null);
  const [currencies, setCurrencies] = useState<CurrencyRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [supportName, setSupportName] = useState("");
  const [supportEmail, setSupportEmail] = useState(profile?.email || "");
  const [candleMode, setCandleMode] = useState(prefs?.candle_color_mode || "green_up");
  const [chatOpen, setChatOpen] = useState(false);
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
  const [dbLanguages, setDbLanguages] = useState<{ code: string; name: string }[]>([]);
  const [storageInfo, setStorageInfo] = useState("Calculating…");

  useEffect(() => {
    setCandleMode(prefs?.candle_color_mode || "green_up");
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
      // Prefer RPC if present
      const { error: rpcErr } = await supabase.rpc("set_preferred_currency", { p_currency: code });
      if (rpcErr) {
        const { error } = await supabase.from("profiles").update({ preferred_currency: code }).eq("id", userId);
        if (error) throw error;
      }
      notify("Changes saved.");
      setSub(null);
      await onReload();
    } catch (e: any) {
      notify(e?.message || "Could not save currency.");
    } finally {
      setBusy(false);
    }
  };

  const saveTheme = async (theme: string) => {
    setBusy(true);
    try {
      const { error } = await supabase.from("profiles").update({ color_theme: theme }).eq("id", userId);
      if (error) throw error;
      applyThemeClass(theme);
      notify("Theme saved.");
      setSub(null);
      await onReload();
    } catch (e: any) {
      notify(e?.message || "Could not save theme.");
    } finally {
      setBusy(false);
    }
  };

  const upsertCandle = async (mode: string) => {
    setBusy(true);
    try {
      const { error } = await supabase.from("user_preferences").upsert(
        { user_id: userId, candle_color_mode: mode, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
      if (error) throw error;
      setCandleMode(mode);
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
    // Must clear sub BEFORE/with chatOpen so the chatOpen branch wins render
    setSub(null);
    setChatOpen(true);
  };

  const estimateStorage = () => {
    setSub("storage");
    try {
      let total = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k) total += (localStorage.getItem(k) || "").length;
      }
      setStorageInfo(`Approx. client storage: ${(total / 1024).toFixed(1)} KB (localStorage only). Cache/clear is device-side.`);
    } catch {
      setStorageInfo("Unable to measure client storage in this browser.");
    }
  };

  const langLabel =
    dbLanguages.find((l) => l.code === (profile?.preferred_language || "en"))?.name ||
    profile?.preferred_language ||
    "English";
  const curLabel = profile?.preferred_currency || "USD";
  const themeLabel = THEMES.find((t) => t.value === (profile?.color_theme || "dark"))?.label || "Dark Mode";
  const greenUp = candleMode === "green_up" || candleMode === "green";

  // Live chat must win over every sub-view (was inverted: Cancel opened chat)
  if (chatOpen) {
    return (
      <SupportChat
        userId={userId}
        ticketId={activeTicketId}
        contactName={supportName.trim()}
        contactEmail={supportEmail.trim()}
        onClose={() => {
          setChatOpen(false);
          setActiveTicketId(null);
        }}
        onTicketCreated={(id) => setActiveTicketId(id)}
        notify={notify}
      />
    );
  }

  if (sub === "language") {
    return (
      <div style={s.section}>
        <button type="button" style={{ ...s.secondaryBtn, width: "auto", marginBottom: 12 }} onClick={() => setSub(null)}>
          ← Back
        </button>
        <h3 style={{ margin: "0 0 12px", color: "#fff", fontSize: 17 }}>Language</h3>
        {(dbLanguages.length
          ? dbLanguages.map((l) => ({ code: l.code, label: l.name }))
          : [{ code: "en", label: "English" }]
        ).map((l) => (
          <button
            key={l.code}
            type="button"
            style={{
              ...s.row,
              border: profile?.preferred_language === l.code ? `1px solid ${GOLD}` : "0",
            }}
            disabled={busy}
            onClick={() => void saveLang(l.code)}
          >
            <span style={s.rowLabel}>{l.label}</span>
            {profile?.preferred_language === l.code && <SIcon name="check" size={16} />}
          </button>
        ))}
      </div>
    );
  }

  if (sub === "currency") {
    return (
      <div style={s.section}>
        <button type="button" style={{ ...s.secondaryBtn, width: "auto", marginBottom: 12 }} onClick={() => setSub(null)}>
          ← Back
        </button>
        <h3 style={{ margin: "0 0 12px", color: "#fff", fontSize: 17 }}>Currency Display</h3>
        <div style={s.infoBox}>Display currency only. Balances remain in native units.</div>
        {(currencies.length ? currencies : [{ code: "USD", name: "US Dollar" }]).map((c) => (
          <button key={c.code} type="button" style={s.row} disabled={busy} onClick={() => void saveCurrency(c.code)}>
            <span style={s.rowLabel}>{c.code}</span>
            <span style={s.rowValue}>{c.name || ""}</span>
            {profile?.preferred_currency === c.code && <SIcon name="check" size={16} />}
          </button>
        ))}
      </div>
    );
  }

  if (sub === "theme") {
    return (
      <div style={s.section}>
        <button type="button" style={{ ...s.secondaryBtn, width: "auto", marginBottom: 12 }} onClick={() => setSub(null)}>
          ← Back
        </button>
        <h3 style={{ margin: "0 0 12px", color: "#fff", fontSize: 17 }}>Color Theme</h3>
        <div style={s.infoBox}>Theme is persisted on your profile and survives refresh and login.</div>
        {THEMES.map((t) => (
          <button
            key={t.value}
            type="button"
            style={{
              ...s.row,
              border: (profile?.color_theme || "dark") === t.value ? `1px solid ${GOLD}` : "0",
            }}
            disabled={busy}
            onClick={() => void saveTheme(t.value)}
          >
            <span style={s.rowLabel}>{t.label}</span>
            {(profile?.color_theme || "dark") === t.value && <SIcon name="check" size={16} />}
          </button>
        ))}
      </div>
    );
  }

  if (sub === "colors") {
    return (
      <div style={s.section}>
        <button type="button" style={{ ...s.secondaryBtn, width: "auto", marginBottom: 12 }} onClick={() => setSub(null)}>
          ← Back
        </button>
        <h3 style={{ margin: "0 0 12px", color: "#fff", fontSize: 17 }}>Color Preferences</h3>
        <p style={{ color: "#888", fontSize: 12, margin: "0 0 12px" }}>Candle / chart color mode (client preference).</p>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            style={{
              ...s.secondaryBtn,
              margin: 0,
              flex: 1,
              borderColor: greenUp ? GOLD : "#333",
              color: greenUp ? GOLD : "#aaa",
            }}
            disabled={busy}
            onClick={() => void upsertCandle("green_up")}
          >
            Green up / Red down
          </button>
          <button
            type="button"
            style={{
              ...s.secondaryBtn,
              margin: 0,
              flex: 1,
              borderColor: !greenUp ? GOLD : "#333",
              color: !greenUp ? GOLD : "#aaa",
            }}
            disabled={busy}
            onClick={() => void upsertCandle("red_up")}
          >
            Red up / Green down
          </button>
        </div>
      </div>
    );
  }

  if (sub === "help") {
    return (
      <div style={s.section}>
        <button type="button" style={{ ...s.secondaryBtn, width: "auto", marginBottom: 12 }} onClick={() => setSub(null)}>
          ← Back
        </button>
        <h3 style={{ margin: "0 0 12px", color: "#fff", fontSize: 17 }}>Help Center</h3>
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
        <button type="button" style={{ ...s.secondaryBtn, width: "auto", marginBottom: 12 }} onClick={() => setSub(null)}>
          ← Back
        </button>
        <div style={{ ...s.infoBox, flexDirection: "column", gap: 10 }}>
          <strong style={{ color: GOLD_LIGHT }}>CEO Exchange</strong>
          <p style={{ margin: 0, lineHeight: 1.5 }}>
            Crypto exchange product with spot markets, P2P marketplace, custodial deposits, withdrawals,
            social features, referrals, and live support.
          </p>
        </div>
      </div>
    );
  }

  if (sub === "storage") {
    return (
      <div style={s.section}>
        <button type="button" style={{ ...s.secondaryBtn, width: "auto", marginBottom: 12 }} onClick={() => setSub(null)}>
          ← Back
        </button>
        <h3 style={{ margin: "0 0 12px", color: "#fff", fontSize: 17 }}>Storage management</h3>
        <div style={s.infoBox}>{storageInfo}</div>
        <button
          type="button"
          style={s.secondaryBtn}
          onClick={() => {
            try {
              // Clear only non-essential keys if any app-specific cache keys exist
              notify("Client cache clear is limited in browser. Use browser settings for full clear.");
            } catch {
              notify("Unable to clear.");
            }
          }}
        >
          Clear local cache (limited)
        </button>
      </div>
    );
  }

  if (sub === "feedback") {
    return (
      <div style={s.section}>
        <button type="button" style={{ ...s.secondaryBtn, width: "auto", marginBottom: 12 }} onClick={() => setSub(null)}>
          ← Back
        </button>
        <h3 style={{ margin: "0 0 12px", color: "#fff", fontSize: 17 }}>User feedback</h3>
        <div style={{ ...s.infoBox, flexDirection: "column", gap: 10 }}>
          <p style={{ margin: 0, lineHeight: 1.45 }}>
            There is currently no feedback submission backend. A form that pretends messages were saved would be misleading.
          </p>
          <a
            href="mailto:ceo.exchange.web@gmail.com?subject=CEO%20Exchange%20Feedback"
            style={{ color: GOLD_LIGHT, fontWeight: 700 }}
          >
            Email feedback instead
          </a>
          <span style={s.comingSoonPill}>NO BACKEND YET</span>
        </div>
      </div>
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

      <button type="button" style={s.row} onClick={() => setSub("theme")}>
        <span style={s.rowIcon}><SIcon name="sun" size={16} /></span>
        <span style={s.rowLabel}>Color Theme</span>
        <span style={s.rowValue}>{themeLabel}</span>
        <span style={s.rowChevron}><SIcon name="chevron" size={16} /></span>
      </button>

      <button type="button" style={s.row} onClick={() => setSub("colors")}>
        <span style={s.rowIcon}><SIcon name="palette" size={16} /></span>
        <span style={s.rowLabel}>Color Preferences</span>
        <span style={{ display: "flex", gap: 4 }}>
          <span style={{ width: 12, height: 12, borderRadius: 2, background: greenUp ? "#1ecf8a" : "#ff5c6c" }} />
          <span style={{ width: 12, height: 12, borderRadius: 2, background: greenUp ? "#ff5c6c" : "#1ecf8a" }} />
        </span>
        <span style={s.rowChevron}><SIcon name="chevron" size={16} /></span>
      </button>

      <button type="button" style={s.row} onClick={() => setSub("help")}>
        <span style={s.rowIcon}><SIcon name="help" size={16} /></span>
        <span style={s.rowLabel}>Help Center</span>
        <span style={s.rowChevron}><SIcon name="chevron" size={16} /></span>
      </button>

      <button type="button" style={s.row} onClick={() => setSub("support")}>
        <span style={s.rowIcon}><SIcon name="headset" size={16} /></span>
        <span style={s.rowLabel}>Contact Support</span>
        <span style={s.rowChevron}><SIcon name="chevron" size={16} /></span>
      </button>

      <button type="button" style={s.row} onClick={() => setSub("feedback")}>
        <span style={s.rowIcon}><SIcon name="edit" size={16} /></span>
        <span style={s.rowLabel}>User feedback</span>
        <span style={s.rowChevron}><SIcon name="chevron" size={16} /></span>
      </button>

      <button type="button" style={s.row} onClick={() => setSub("about")}>
        <span style={s.rowIcon}><SIcon name="info" size={16} /></span>
        <span style={s.rowLabel}>About Us</span>
        <span style={s.rowChevron}><SIcon name="chevron" size={16} /></span>
      </button>

      <button type="button" style={s.row} onClick={estimateStorage}>
        <span style={s.rowIcon}><SIcon name="screen" size={16} /></span>
        <span style={s.rowLabel}>Storage management</span>
        <span style={s.rowChevron}><SIcon name="chevron" size={16} /></span>
      </button>

      <a
        href="https://ceo-exchange.vercel.app"
        target="_blank"
        rel="noopener noreferrer"
        style={{ ...s.row, textDecoration: "none" }}
      >
        <span style={s.rowIcon}><SIcon name="thumb" size={16} /></span>
        <span style={s.rowLabel}>Rate Our App</span>
        <span style={s.rowChevron}><SIcon name="chevron" size={16} /></span>
      </a>

      <button type="button" style={s.logoutBtn} onClick={() => void onLogout()}>
        <SIcon name="logout" size={18} /> Log Out
      </button>
    </div>
  );
}
