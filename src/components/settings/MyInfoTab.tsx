import React, { useEffect, useRef, useState } from "react";
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

type FeeTier = {
  maker_fee: number | null;
  taker_fee: number | null;
  tier_name: string | null;
} | null;

type VerifRow = {
  id: string;
  status: string;
  created_at: string | null;
  notes: string | null;
};

function kycLabel(status: string | null) {
  if (!status) return "Unverified";
  const v = status.toLowerCase();
  if (v === "approved" || v === "verified") return "Lv.1 Verified";
  if (v === "pending" || v === "submitted" || v === "in_review" || v === "reviewing") return "Under review";
  if (v === "rejected" || v === "declined" || v === "failed") return "Rejected — resubmit";
  return "Unverified";
}
function kycIsVerified(status: string | null) {
  const v = (status || "").toLowerCase();
  return v === "approved" || v === "verified";
}
function kycIsPending(status: string | null) {
  const v = (status || "").toLowerCase();
  return v === "pending" || v === "submitted" || v === "in_review" || v === "reviewing";
}
function kycIsRejected(status: string | null) {
  const v = (status || "").toLowerCase();
  return v === "rejected" || v === "declined" || v === "failed";
}
function kycColor(status: string | null) {
  const v = (status || "").toLowerCase();
  if (v === "approved" || v === "verified") return "#39d98a";
  if (v === "pending" || v === "submitted" || v === "in_review" || v === "reviewing") return GOLD;
  if (v === "rejected" || v === "declined" || v === "failed") return "#ff6574";
  return "#888";
}

export default function MyInfoTab({ data, onReload, notify, onLogout }: Props) {
  const { profile, socials, userId } = data;
  const fileRef = useRef<HTMLInputElement>(null);
  const [editingNick, setEditingNick] = useState(false);
  const [nick, setNick] = useState(profile?.nickname || "");
  const [saving, setSaving] = useState(false);
  const [showKyc, setShowKyc] = useState(false);
  // Community links (read-only from public.community_links)
  const [communityLinks, setCommunityLinks] = useState<Array<{
    id: string;
    title: string;
    description: string | null;
    url: string;
    icon: string | null;
    sort_order: number | null;
  }>>([]);
  const [communityLoading, setCommunityLoading] = useState(false);
  const [communityError, setCommunityError] = useState("");
  const [linkView, setLinkView] = useState<"list" | "telegram" | "x" | "x-consent" | "x-redirect" | null>(null);
  const [tgCode, setTgCode] = useState("");
  const [tgExpires, setTgExpires] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [xAgree, setXAgree] = useState(false);
  const [xRedirectAgree, setXRedirectAgree] = useState(false);
  const [subView, setSubView] = useState<"fees" | "additional" | "subaccount" | "community" | null>(null);
  const [feeTier, setFeeTier] = useState<FeeTier>(null);
  const [feeLoading, setFeeLoading] = useState(false);
  const [verifs, setVerifs] = useState<VerifRow[]>([]);
  const [verifLoading, setVerifLoading] = useState(false);
  const [verifFile, setVerifFile] = useState<File | null>(null);
  const [verifNotes, setVerifNotes] = useState("");

  const tg = socials.find((x) => x.provider === "telegram");
  const tw = socials.find((x) => x.provider === "twitter" || x.provider === "x");

  useEffect(() => {
    setNick(profile?.nickname || "");
  }, [profile?.nickname]);

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

  const loadFees = async () => {
    setFeeLoading(true);
    setSubView("fees");
    try {
      // Prefer user_fee_tiers then fall back to fee_schedules default
      const { data: tiers } = await supabase
        .from("user_fee_tiers")
        .select("maker_fee,taker_fee,tier_name")
        .eq("user_id", userId)
        .maybeSingle();
      if (tiers) {
        setFeeTier(tiers as FeeTier);
      } else {
        const { data: sched } = await supabase
          .from("fee_schedules")
          .select("maker_fee,taker_fee,name")
          .eq("is_default", true)
          .maybeSingle();
        if (sched) {
          setFeeTier({
            maker_fee: (sched as any).maker_fee,
            taker_fee: (sched as any).taker_fee,
            tier_name: (sched as any).name || "Regular",
          });
        } else {
          setFeeTier(null);
        }
      }
    } catch {
      setFeeTier(null);
    } finally {
      setFeeLoading(false);
    }
  };

  const loadVerifs = async () => {
    setVerifLoading(true);
    setSubView("additional");
    try {
      const { data: rows } = await supabase
        .from("account_verifications")
        .select("id,status,created_at,notes")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10);
      setVerifs((rows as VerifRow[]) ?? []);
    } catch {
      setVerifs([]);
    } finally {
      setVerifLoading(false);
    }
  };

  const submitAdditionalVerif = async () => {
    if (!verifFile) {
      notify("Please select a document to upload.");
      return;
    }
    setSaving(true);
    try {
      const ext = verifFile.name.split(".").pop() || "pdf";
      const path = `${userId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("account-verification-documents")
        .upload(path, verifFile, { contentType: verifFile.type, upsert: false });
      if (upErr) throw upErr;

      const { error: insErr } = await supabase.from("account_verifications").insert({
        user_id: userId,
        status: "pending",
        document_path: path,
        notes: verifNotes.trim() || null,
      });
      if (insErr) throw insErr;

      notify("Additional verification submitted.");
      setVerifFile(null);
      setVerifNotes("");
      await loadVerifs();
    } catch (e: any) {
      notify(e?.message || "Could not submit verification.");
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

  // ── Fee rates screen ──
  if (subView === "fees") {
    return (
      <div style={s.section}>
        <button type="button" style={{ ...s.secondaryBtn, width: "auto", marginBottom: 12 }} onClick={() => setSubView(null)}>
          ← Back
        </button>
        <h3 style={{ margin: "0 0 12px", color: "#fff", fontSize: 17 }}>My Fee Rates</h3>
        {feeLoading ? (
          <p style={{ color: "#777" }}>Loading…</p>
        ) : feeTier ? (
          <div style={{ ...s.infoBox, flexDirection: "column", gap: 10 }}>
            <div>
              <span style={{ color: GOLD_LIGHT, fontWeight: 700 }}>{feeTier.tier_name || "Regular"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Maker</span>
              <span style={{ color: "#fff", fontWeight: 700 }}>
                {feeTier.maker_fee != null ? `${Number(feeTier.maker_fee).toFixed(4)}%` : "—"}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Taker</span>
              <span style={{ color: "#fff", fontWeight: 700 }}>
                {feeTier.taker_fee != null ? `${Number(feeTier.taker_fee).toFixed(4)}%` : "—"}
              </span>
            </div>
            <p style={{ margin: 0, color: "#666", fontSize: 11 }}>
              Fees are determined by your VIP level and trading volume. Updated by the platform.
            </p>
          </div>
        ) : (
          <div style={s.infoBox}>Fee schedule data is not available yet.</div>
        )}
      </div>
    );
  }

  // ── Additional verification ──
  if (subView === "additional") {
    return (
      <div style={s.section}>
        <button type="button" style={{ ...s.secondaryBtn, width: "auto", marginBottom: 12 }} onClick={() => setSubView(null)}>
          ← Back
        </button>
        <h3 style={{ margin: "0 0 8px", color: "#fff", fontSize: 17 }}>Additional Verification</h3>
        <p style={{ color: "#777", fontSize: 12, margin: "0 0 14px", lineHeight: 1.45 }}>
          Enhanced / EDD verification. Separate from basic KYC. Approval does not automatically change withdrawal or P2P limits.
        </p>
        {verifLoading ? (
          <p style={{ color: "#777" }}>Loading…</p>
        ) : (
          <>
            {verifs.length === 0 && (
              <div style={s.infoBox}>No previous additional verification cases.</div>
            )}
            {verifs.map((v) => (
              <div key={v.id} style={{ ...s.rowStatic, marginBottom: 6 }}>
                <span style={s.rowLabel}>Case</span>
                <span
                  style={{
                    ...s.statusPill,
                    background:
                      v.status === "approved"
                        ? "#0d2a1a"
                        : v.status === "rejected"
                          ? "#2a1012"
                          : "#1a1508",
                    color:
                      v.status === "approved"
                        ? "#39d98a"
                        : v.status === "rejected"
                          ? "#ff6574"
                          : GOLD_LIGHT,
                  }}
                >
                  {v.status}
                </span>
              </div>
            ))}
            <label style={s.field}>
              Document
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => setVerifFile(e.target.files?.[0] || null)}
                style={{ color: "#ccc", fontSize: 13 }}
              />
            </label>
            <label style={s.field}>
              Notes (optional)
              <input
                style={s.input}
                value={verifNotes}
                onChange={(e) => setVerifNotes(e.target.value)}
                placeholder="Reason or context"
              />
            </label>
            <button type="button" style={s.primaryBtn} disabled={saving || !verifFile} onClick={() => void submitAdditionalVerif()}>
              {saving ? "Submitting…" : "Submit application"}
            </button>
          </>
        )}
      </div>
    );
  }

  // ── Subaccount coming soon ──
  if (subView === "subaccount") {
    return (
      <div style={s.section}>
        <button type="button" style={{ ...s.secondaryBtn, width: "auto", marginBottom: 12 }} onClick={() => setSubView(null)}>
          ← Back
        </button>
        <h3 style={{ margin: "0 0 12px", color: "#fff", fontSize: 17 }}>Subaccount</h3>
        <div style={{ ...s.infoBox, flexDirection: "column", alignItems: "center", textAlign: "center", gap: 12, padding: "28px 16px" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>Coming soon</div>
          <div style={{ color: "#aaa", fontSize: 13, lineHeight: 1.5 }}>
            Subaccounts are not available yet. No balances or switchable accounts are created on the backend.
          </div>
          <span style={s.comingSoonPill}>UNAVAILABLE</span>
        </div>
      </div>
    );
  }


  const openCommunity = () => {
    setSubView("community");
    setCommunityLoading(true);
    setCommunityError("");
    void (async () => {
      try {
        const { data, error } = await supabase
          .from("community_links")
          .select("id,title,description,url,icon,sort_order,created_at,is_active")
          .eq("is_active", true)
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true });
        if (error) throw error;
        setCommunityLinks(
          (data ?? []).map((row: any) => ({
            id: String(row.id),
            title: String(row.title ?? "Channel"),
            description: row.description ?? null,
            url: String(row.url ?? ""),
            icon: row.icon ?? null,
            sort_order: row.sort_order ?? 0,
          }))
        );
      } catch (e: any) {
        setCommunityLinks([]);
        setCommunityError(e?.message || "Could not load community links. Please try again.");
      } finally {
        setCommunityLoading(false);
      }
    })();
  };

  const communityIconName = (icon: string | null, title: string) => {
    const key = `${icon || ""} ${title}`.toLowerCase();
    if (key.includes("telegram") || key.includes("tg")) return "headset";
    if (key.includes("twitter") || key.includes("x.com") || key === "x") return "link";
    if (key.includes("discord")) return "users";
    if (key.includes("youtube") || key.includes("video")) return "globe";
    if (key.includes("web") || key.includes("site")) return "globe";
    return "community";
  };

  // ── Join Our Community (premium promotion) ──
  if (subView === "community") {
    return (
      <div style={{ ...s.section, animation: "secIn 0.28s ease-out both" }}>
        <style>{`
          @keyframes secIn {
            from { opacity: 0; transform: translateY(8px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes communityCardIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>

        <button
          type="button"
          style={{ ...s.secondaryBtn, width: "auto", marginBottom: 16 }}
          onClick={() => setSubView(null)}
        >
          ← Back
        </button>

        {/* Hero */}
        <div
          style={{
            position: "relative",
            borderRadius: 18,
            padding: "22px 18px 20px",
            marginBottom: 22,
            background: "linear-gradient(145deg, #16120a 0%, #0a0a0a 55%, #050505 100%)",
            border: `1px solid ${BORDER}`,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: -40,
              right: -30,
              width: 140,
              height: 140,
              borderRadius: "50%",
              background: "radial-gradient(circle, rgba(245,181,27,0.18) 0%, transparent 70%)",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 16,
              marginBottom: 14,
              display: "grid",
              placeItems: "center",
              background: "linear-gradient(135deg, rgba(245,181,27,0.22), rgba(245,181,27,0.06))",
              border: `1px solid ${BORDER}`,
              color: GOLD,
            }}
          >
            <SIcon name="community" size={24} />
          </div>
          <div
            style={{
              color: GOLD_LIGHT,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 1.4,
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            CEO Exchange
          </div>
          <h2
            style={{
              margin: "0 0 8px",
              color: "#fff",
              fontSize: 22,
              fontWeight: 800,
              lineHeight: 1.2,
              letterSpacing: -0.3,
            }}
          >
            Join Our Community
          </h2>
          <p style={{ margin: 0, color: "#999", fontSize: 13.5, lineHeight: 1.5, maxWidth: 320 }}>
            Connect with the CEO Exchange community. Official channels, updates, and support — in one place.
          </p>
        </div>

        <div
          style={{
            color: "#aaa",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 0.8,
            textTransform: "uppercase",
            marginBottom: 12,
          }}
        >
          Official Channels
        </div>

        {communityLoading && (
          <div style={{ ...s.infoBox, textAlign: "center" }}>Loading community…</div>
        )}

        {!communityLoading && communityError && (
          <div style={s.errorBox}>
            {communityError}
            <button
              type="button"
              style={{ ...s.secondaryBtn, marginTop: 10 }}
              onClick={() => openCommunity()}
            >
              Try again
            </button>
          </div>
        )}

        {!communityLoading && !communityError && communityLinks.length === 0 && (
          <div
            style={{
              borderRadius: 16,
              padding: "28px 18px",
              textAlign: "center",
              background: "#0c0c0c",
              border: "1px dashed #2a2a2a",
            }}
          >
            <div style={{ color: GOLD, marginBottom: 10, display: "grid", placeItems: "center" }}>
              <SIcon name="community" size={28} />
            </div>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: 15, marginBottom: 6 }}>
              Coming soon
            </div>
            <div style={{ color: "#777", fontSize: 13, lineHeight: 1.45 }}>
              Official community channels are coming soon.
            </div>
          </div>
        )}

        {!communityLoading &&
          !communityError &&
          communityLinks.map((link, idx) => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "14px 14px",
                marginBottom: 10,
                borderRadius: 16,
                textDecoration: "none",
                background: "linear-gradient(180deg, #121212 0%, #0c0c0c 100%)",
                border: `1px solid ${BORDER}`,
                animation: `communityCardIn 0.35s ease-out ${idx * 0.05}s both`,
                cursor: "pointer",
              }}
            >
              <span
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  flexShrink: 0,
                  display: "grid",
                  placeItems: "center",
                  background: "linear-gradient(135deg, rgba(245,181,27,0.18), rgba(245,181,27,0.05))",
                  border: `1px solid ${BORDER}`,
                  color: GOLD,
                }}
              >
                <SIcon name={communityIconName(link.icon, link.title) as any} size={20} />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span
                  style={{
                    display: "block",
                    color: "#fff",
                    fontWeight: 700,
                    fontSize: 15,
                    marginBottom: link.description ? 3 : 0,
                  }}
                >
                  {link.title}
                </span>
                {link.description && (
                  <span
                    style={{
                      display: "block",
                      color: "#888",
                      fontSize: 12.5,
                      lineHeight: 1.35,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {link.description}
                  </span>
                )}
              </span>
              <span style={{ color: GOLD_LIGHT, flexShrink: 0 }}>
                <SIcon name="chevron" size={18} />
              </span>
            </a>
          ))}
      </div>
    );
  }


  // ── Link Account screens ──
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
            Linked{tg.handle ? `: ${tg.handle}` : ""}.
          </p>
        )}

        <p style={{ margin: "16px 0 8px", color: "#777", fontSize: 12, lineHeight: 1.4 }}>
          Connect your X account to interact and earn event rewards.
        </p>
        <div style={{ ...s.row, marginBottom: 8 }}>
          <span style={s.rowIcon}>
            <span style={{ fontWeight: 900, fontSize: 13 }}>𝕏</span>
          </span>
          <span style={s.rowLabel}>{tw ? tw.handle || "Linked" : "Not linked"}</span>
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
              Link
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
            style={{ ...s.primaryBtn, marginTop: 0, opacity: xAgree ? 1 : 0.45 }}
            disabled={!xAgree || saving}
            onClick={() => {
              setXRedirectAgree(false);
              setLinkView("x-redirect");
            }}
          >
            Confirm
          </button>
          <button type="button" style={{ ...s.secondaryBtn, marginTop: 10 }} onClick={() => setLinkView("list")}>
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
            style={{ ...s.primaryBtn, marginTop: 0, opacity: xRedirectAgree ? 1 : 0.45 }}
            disabled={!xRedirectAgree || saving}
            onClick={() => void startXLink()}
          >
            {saving ? "Opening…" : "Confirm"}
          </button>
          <button type="button" style={{ ...s.secondaryBtn, marginTop: 10 }} onClick={() => setLinkView("list")}>
            Cancel
          </button>
          {error && <div style={{ ...s.errorBox, marginTop: 12 }}>{error}</div>}
        </div>
      </div>
    );
  }

  // ── Main My Info list ──
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

      <div style={s.rowStatic}>
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
        <div style={s.rowStatic}>
          <span style={s.rowIcon}><SIcon name="shield" size={16} /></span>
          <span style={s.rowLabel}>Identity Verification</span>
          <span style={{ ...s.rowValue, color: "#39d98a" }}>Lv.1 Verified</span>
        </div>
      ) : kycIsPending(profile?.kyc_status ?? null) ? (
        <div style={s.rowStatic}>
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

      <div style={s.rowStatic}>
        <span style={s.rowIcon}><SIcon name="shield" size={16} /></span>
        <span style={s.rowLabel}>VIP level</span>
        <span style={s.rowValue}>
          {profile?.vip_level != null && profile?.vip_level !== "" ? String(profile.vip_level) : "Non-VIP"}
        </span>
      </div>

      <button type="button" style={s.row} onClick={() => void loadFees()}>
        <span style={s.rowIcon}><SIcon name="chart" size={16} /></span>
        <span style={s.rowLabel}>My Fee Rates</span>
        <span style={s.rowChevron}><SIcon name="chevron" size={16} /></span>
      </button>

      <button type="button" style={s.row} onClick={() => void loadVerifs()}>
        <span style={s.rowIcon}><SIcon name="id" size={16} /></span>
        <span style={s.rowLabel}>Additional Verification</span>
        <span style={s.rowValue}>{verifs.length ? `${verifs.length} case(s)` : ""}</span>
        <span style={s.rowChevron}><SIcon name="chevron" size={16} /></span>
      </button>

      <button type="button" style={s.row} onClick={() => setSubView("subaccount")}>
        <span style={s.rowIcon}><SIcon name="users" size={16} /></span>
        <span style={s.rowLabel}>Subaccount</span>
        <span style={{ ...s.rowValue, color: GOLD_LIGHT }}>Coming soon</span>
        <span style={s.rowChevron}><SIcon name="chevron" size={16} /></span>
      </button>

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
        <div style={s.rowStatic}>
          <span style={s.rowIcon}><SIcon name="users" size={16} /></span>
          <span style={s.rowLabel}>Affiliate&apos;s community</span>
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
      ) : (
        <button type="button" style={s.row} onClick={() => openCommunity()}>
          <span style={s.rowIcon}><SIcon name="users" size={16} /></span>
          <span style={s.rowLabel}>Affiliate&apos;s community</span>
          <span style={s.rowChevron}><SIcon name="chevron" size={16} /></span>
        </button>
      )}

      <button type="button" style={s.row} onClick={() => openCommunity()}>
        <span style={s.rowIcon}><SIcon name="community" size={16} /></span>
        <span style={s.rowLabel}>Join Our Community</span>
        <span style={s.rowChevron}><SIcon name="chevron" size={16} /></span>
      </button>

      <button type="button" style={s.logoutBtn} onClick={() => void onLogout()}>
        <SIcon name="logout" size={18} /> Log Out
      </button>
    </div>
  );
}
