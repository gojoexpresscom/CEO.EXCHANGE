import React, { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { s, GOLD } from "./settingsStyles";
import { SIcon } from "./SettingsIcons";
import type { SettingsData } from "./Settings";

type Props = {
  data: SettingsData;
  onReload: () => Promise<void>;
  notify: (msg: string) => void;
};

/**
 * Preference tab — trading-related prefs live here.
 * candle_color_mode + screen_always_on come from user_preferences (real columns).
 * Theme is session-only until a backend column exists.
 */
export default function PreferenceTab({ data, onReload, notify }: Props) {
  const { prefs, userId } = data;
  const [mode, setMode] = useState(prefs?.candle_color_mode || "green_up");
  const [alwaysOn, setAlwaysOn] = useState(Boolean(prefs?.screen_always_on));
  const [busy, setBusy] = useState(false);
  const [wakeLock, setWakeLock] = useState<WakeLockSentinel | null>(null);

  useEffect(() => {
    setMode(prefs?.candle_color_mode || "green_up");
    setAlwaysOn(Boolean(prefs?.screen_always_on));
  }, [prefs]);

  // Apply Screen Wake Lock when preference is on
  useEffect(() => {
    let cancelled = false;
    async function apply() {
      if (!alwaysOn) {
        if (wakeLock) {
          try {
            await wakeLock.release();
          } catch {
            /* ignore */
          }
          setWakeLock(null);
        }
        return;
      }
      if (!("wakeLock" in navigator)) return;
      try {
        const lock = await (navigator as any).wakeLock.request("screen");
        if (cancelled) {
          await lock.release();
          return;
        }
        setWakeLock(lock);
        lock.addEventListener("release", () => setWakeLock(null));
      } catch {
        // Not supported or permission denied — preference still saved.
      }
    }
    void apply();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alwaysOn]);

  const upsertPrefs = async (patch: { candle_color_mode?: string; screen_always_on?: boolean }) => {
    setBusy(true);
    try {
      const { error } = await supabase.from("user_preferences").upsert(
        {
          user_id: userId,
          ...patch,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
      if (error) throw error;
      notify("Changes saved.");
      await onReload();
    } catch (e: any) {
      notify(e?.message || "Could not save preferences.");
    } finally {
      setBusy(false);
    }
  };

  const greenUp = mode === "green_up" || mode === "green";

  return (
    <div style={s.section}>
      <div style={s.infoBox}>
        These preferences control trading chart colors and screen behavior. They are stored in{" "}
        <code style={{ color: GOLD }}>user_preferences</code>.
      </div>

      <div style={s.row}>
        <span style={s.rowIcon}><SIcon name="palette" size={16} /></span>
        <span style={s.rowLabel}>Color Preferences</span>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span
            style={{
              width: 14,
              height: 14,
              borderRadius: 3,
              background: greenUp ? "#1ecf8a" : "#ff5c6c",
            }}
          />
          <span
            style={{
              width: 14,
              height: 14,
              borderRadius: 3,
              background: greenUp ? "#ff5c6c" : "#1ecf8a",
            }}
          />
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, padding: "0 2px 8px" }}>
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
          onClick={() => {
            setMode("green_up");
            void upsertPrefs({ candle_color_mode: "green_up" });
          }}
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
          onClick={() => {
            setMode("red_up");
            void upsertPrefs({ candle_color_mode: "red_up" });
          }}
        >
          Red up / Green down
        </button>
      </div>

      <div style={s.row}>
        <span style={s.rowIcon}><SIcon name="screen" size={16} /></span>
        <span style={s.rowLabel}>Always on (no screen lock)</span>
        <button
          type="button"
          style={{
            ...s.toggle,
            background: alwaysOn ? GOLD : "#333",
          }}
          disabled={busy}
          onClick={() => {
            const next = !alwaysOn;
            setAlwaysOn(next);
            void upsertPrefs({ screen_always_on: next });
          }}
          aria-label="Toggle always-on display"
        >
          <span style={{ ...s.toggleKnob, left: alwaysOn ? 21 : 3 }} />
        </button>
      </div>
      <p style={{ color: "#666", fontSize: 11, margin: "-4px 4px 12px", lineHeight: 1.4 }}>
        Uses the browser Screen Wake Lock API when supported. The preference is saved; the device may still dim if the OS overrides it.
      </p>
    </div>
  );
}
