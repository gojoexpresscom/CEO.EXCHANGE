/**
 * CEO Exchange — Social Personal Center / Profile
 * Uses get_public_profile / follow RPCs from Cloud. Not Settings.
 */

import React, { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

const GOLD = "#f5b51b";
const BG = "#050505";
const CARD = "#121212";
const BORDER = "#2a2a2a";

type Profile = {
  id: string;
  nickname: string | null;
  profile_picture_url: string | null;
  uid?: string | null;
  bio?: string | null;
};

type Post = {
  id: string;
  user_id: string | null;
  content: string | null;
  image_url: string | null;
  created_at: string | null;
  likes_count?: number | null;
  shares_count?: number | null;
};

type ListUser = {
  user_id: string;
  nickname: string | null;
  profile_picture_url: string | null;
  uid?: string | null;
  followed_at?: string | null;
  is_followed_by_me?: boolean | null;
};

type Props = {
  profileUserId: string;
  currentUserId: string;
  onClose: () => void;
  notify?: (m: string) => void;
};

function parseBackendTs(value: string): number {
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(s) && !/[zZ]|[+\-]\d{2}:?\d{2}$/.test(s)) {
    return new Date(s.replace(" ", "T") + "Z").getTime();
  }
  return new Date(s).getTime();
}

function timeAgo(value: string | null | undefined, nowMs = Date.now()) {
  if (!value) return "";
  const t = parseBackendTs(value);
  if (!Number.isFinite(t)) return "";
  const diff = Math.max(0, nowMs - t);
  const seconds = Math.floor(diff / 1000);
  if (seconds < 45) return "now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  return new Date(t).toLocaleDateString();
}

export default function SocialProfile({ profileUserId, currentUserId, onClose, notify }: Props) {
  const isSelf = profileUserId === currentUserId;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [likesTotal, setLikesTotal] = useState(0);
  const [sharesTotal, setSharesTotal] = useState(0);
  const [iFollow, setIFollow] = useState(false);
  const [tab, setTab] = useState<"posts" | "portfolio" | "followers" | "following">("posts");
  const [list, setList] = useState<ListUser[]>([]);
  const [busy, setBusy] = useState(false);
  const [bioDraft, setBioDraft] = useState("");
  const [editingBio, setEditingBio] = useState(false);

  const load = useCallback(async () => {
    const profilePromise = isSelf
      ? supabase
          .from("profiles")
          .select("id,nickname,profile_picture_url,bio,uid")
          .eq("id", profileUserId)
          .maybeSingle()
          .then((r) => ({ data: r.data as Profile | null, error: r.error }))
      : supabase.rpc("get_public_profile", { p_id: profileUserId }).then((r) => ({
          data: (Array.isArray(r.data) ? r.data[0] : r.data) as Profile | null,
          error: r.error,
        }));

    const [{ data: p }, { data: postraws }, countsRes, followingRes] = await Promise.all([
      profilePromise,
      supabase
        .from("posts")
        .select("id,user_id,content,image_url,created_at,likes_count,shares_count")
        .eq("user_id", profileUserId)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase.rpc("get_follow_counts", { p_user_id: profileUserId }),
      !isSelf
        ? supabase.rpc("is_following", { p_target_user_id: profileUserId })
        : Promise.resolve({ data: false, error: null }),
    ]);

    setProfile(p ?? null);
    setBioDraft((p as any)?.bio || "");
    const pr = (postraws ?? []) as Post[];
    setPosts(pr);
    setLikesTotal(pr.reduce((a, x) => a + (x.likes_count || 0), 0));
    setSharesTotal(pr.reduce((a, x) => a + (x.shares_count || 0), 0));

    const counts = Array.isArray(countsRes.data) ? countsRes.data[0] : countsRes.data;
    setFollowers(Number(counts?.followers_count ?? 0));
    setFollowing(Number(counts?.following_count ?? 0));
    setIFollow(Boolean(followingRes.data));
  }, [profileUserId, currentUserId, isSelf]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadList = async (kind: "followers" | "following") => {
    setTab(kind);
    const rpc = kind === "followers" ? "get_followers" : "get_following";
    const { data, error } = await supabase.rpc(rpc, {
      p_user_id: profileUserId,
      p_limit: 50,
      p_offset: 0,
    });
    if (error) {
      notify?.(error.message);
      setList([]);
      return;
    }
    setList((data as ListUser[]) ?? []);
  };

  const toggleFollow = async () => {
    if (isSelf || busy) return;
    setBusy(true);
    try {
      if (iFollow) {
        const { error } = await supabase.rpc("unfollow_user", { p_target_user_id: profileUserId });
        if (error) throw error;
        setIFollow(false);
        setFollowers((n) => Math.max(0, n - 1));
      } else {
        const { error } = await supabase.rpc("follow_user", { p_target_user_id: profileUserId });
        if (error) throw error;
        setIFollow(true);
        setFollowers((n) => n + 1);
      }
    } catch (e: any) {
      notify?.(e?.message || "Could not update follow.");
    } finally {
      setBusy(false);
    }
  };

  const saveBio = async () => {
    if (!isSelf) return;
    setBusy(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ bio: bioDraft.trim() || null })
        .eq("id", currentUserId);
      if (error) throw error;
      setEditingBio(false);
      await load();
      notify?.("Bio updated.");
    } catch (e: any) {
      notify?.(e?.message || "Could not save bio.");
    } finally {
      setBusy(false);
    }
  };

  const name =
    (profile?.nickname && String(profile.nickname).trim()) ||
    (profile?.uid ? `User ${profile.uid}` : "User");
  const avatar = profile?.profile_picture_url;

  return (
    <div style={shell}>
      <header style={header}>
        <button type="button" style={iconBtn} onClick={onClose} aria-label="Back">
          ←
        </button>
        <h2 style={title}>Personal center</h2>
        <span style={{ width: 40 }} />
      </header>

      <div style={body}>
        <div style={hero}>
          {avatar ? (
            <img src={avatar} alt="" style={avatarStyle} />
          ) : (
            <div style={avatarFallback}>{name.slice(0, 2).toUpperCase()}</div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={nameStyle}>{name}</div>
            {profile?.uid && <div style={uidStyle}>UID {profile.uid}</div>}
            {isSelf ? (
              editingBio ? (
                <div style={{ marginTop: 8 }}>
                  <textarea
                    value={bioDraft}
                    onChange={(e) => setBioDraft(e.target.value.slice(0, 160))}
                    placeholder="Add a bio…"
                    style={bioInput}
                  />
                  <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                    <button type="button" style={primaryBtn} disabled={busy} onClick={() => void saveBio()}>
                      Save
                    </button>
                    <button type="button" style={ghostBtn} onClick={() => setEditingBio(false)}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" style={bioBtn} onClick={() => setEditingBio(true)}>
                  {bioDraft || "Click here to add a bio…"} ✎
                </button>
              )
            ) : (
              <p style={bioText}>{bioDraft || ""}</p>
            )}
          </div>
          {isSelf ? (
            <button type="button" style={editChip} onClick={() => setEditingBio(true)}>
              Edit
            </button>
          ) : (
            <button type="button" style={iFollow ? ghostBtn : primaryBtn} disabled={busy} onClick={() => void toggleFollow()}>
              {iFollow ? "Following" : "Follow"}
            </button>
          )}
        </div>

        <div style={stats}>
          <button type="button" style={stat} onClick={() => setTab("posts")}>
            <b>{likesTotal}</b>
            <span>Likes</span>
          </button>
          <button type="button" style={stat} onClick={() => setTab("posts")}>
            <b>{sharesTotal}</b>
            <span>Shares</span>
          </button>
          <button type="button" style={stat} onClick={() => void loadList("following")}>
            <b>{following}</b>
            <span>Following</span>
          </button>
          <button type="button" style={stat} onClick={() => void loadList("followers")}>
            <b>{followers}</b>
            <span>Followers</span>
          </button>
        </div>

        <div style={tabs}>
          <button type="button" style={{ ...tabBtn, ...(tab === "posts" ? tabActive : {}) }} onClick={() => setTab("posts")}>
            Posts
          </button>
          <button
            type="button"
            style={{ ...tabBtn, ...(tab === "portfolio" ? tabActive : {}) }}
            onClick={() => setTab("portfolio")}
          >
            Portfolio
          </button>
        </div>

        {(tab === "followers" || tab === "following") && (
          <div>
            {list.length === 0 && <p style={empty}>No users yet.</p>}
            {list.map((u) => (
              <div key={u.user_id} style={userRow}>
                {u.profile_picture_url ? (
                  <img src={u.profile_picture_url} alt="" style={smallAv} />
                ) : (
                  <div style={smallAvFb}>{(u.nickname || u.uid || "U").slice(0, 1).toUpperCase()}</div>
                )}
                <span style={{ fontWeight: 700 }}>
                  {(u.nickname && u.nickname.trim()) || (u.uid ? `User ${u.uid}` : "User")}
                </span>
              </div>
            ))}
          </div>
        )}

        {tab === "portfolio" && (
          <p style={empty}>Portfolio balances are on the Assets tab (not shown here for privacy).</p>
        )}

        {tab === "posts" && (
          <div>
            {posts.length === 0 && <p style={empty}>No posts yet.</p>}
            {posts.map((p) => (
              <article key={p.id} style={postCard}>
                <div style={{ color: "#777", fontSize: 12, marginBottom: 6 }}>{timeAgo(p.created_at)}</div>
                {p.content && (
                  <div style={{ color: "#eee", fontSize: 14, lineHeight: 1.45, whiteSpace: "pre-wrap" }}>{p.content}</div>
                )}
                {p.image_url && <img src={p.image_url} alt="" style={postImg} />}
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const shell: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 94,
  background: BG,
  display: "flex",
  flexDirection: "column",
  fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif",
};
const header: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "12px 14px",
  paddingTop: "calc(12px + env(safe-area-inset-top))",
  borderBottom: "1px solid #1a1a1a",
};
const title: React.CSSProperties = { margin: 0, fontSize: 17, fontWeight: 800, color: "#f5f5f5" };
const iconBtn: React.CSSProperties = {
  width: 40,
  height: 40,
  border: 0,
  borderRadius: 12,
  background: "transparent",
  color: "#eee",
  fontSize: 20,
  cursor: "pointer",
};
const body: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "16px 14px calc(28px + env(safe-area-inset-bottom))",
};
const hero: React.CSSProperties = { display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 18 };
const avatarStyle: React.CSSProperties = {
  width: 64,
  height: 64,
  borderRadius: "50%",
  objectFit: "cover",
  border: `1px solid ${BORDER}`,
  flexShrink: 0,
};
const avatarFallback: React.CSSProperties = {
  ...avatarStyle,
  display: "grid",
  placeItems: "center",
  background: CARD,
  color: GOLD,
  fontWeight: 800,
};
const nameStyle: React.CSSProperties = { fontSize: 20, fontWeight: 800, color: "#fff" };
const uidStyle: React.CSSProperties = { fontSize: 12, color: "#777", marginTop: 2 };
const bioBtn: React.CSSProperties = {
  border: 0,
  background: "transparent",
  color: "#888",
  fontSize: 13,
  padding: 0,
  marginTop: 6,
  cursor: "pointer",
  textAlign: "left",
};
const bioText: React.CSSProperties = { color: "#999", fontSize: 13, margin: "6px 0 0" };
const bioInput: React.CSSProperties = {
  width: "100%",
  minHeight: 64,
  borderRadius: 12,
  border: `1px solid ${BORDER}`,
  background: CARD,
  color: "#fff",
  padding: 10,
  fontFamily: "inherit",
};
const primaryBtn: React.CSSProperties = {
  border: 0,
  borderRadius: 20,
  padding: "8px 14px",
  background: GOLD,
  color: "#0a0a0a",
  fontWeight: 800,
  fontSize: 13,
  cursor: "pointer",
};
const ghostBtn: React.CSSProperties = {
  border: `1px solid ${BORDER}`,
  borderRadius: 20,
  padding: "8px 14px",
  background: CARD,
  color: "#ddd",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
};
const editChip: React.CSSProperties = { ...ghostBtn, flexShrink: 0 };
const stats: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: 8,
  marginBottom: 16,
  padding: 12,
  borderRadius: 16,
  background: CARD,
  border: `1px solid ${BORDER}`,
};
const stat: React.CSSProperties = {
  border: 0,
  background: "transparent",
  color: "#eee",
  display: "flex",
  flexDirection: "column",
  gap: 2,
  cursor: "pointer",
  alignItems: "center",
};
const tabs: React.CSSProperties = { display: "flex", gap: 18, borderBottom: "1px solid #1a1a1a", marginBottom: 14 };
const tabBtn: React.CSSProperties = {
  border: 0,
  background: "transparent",
  color: "#777",
  fontWeight: 700,
  fontSize: 14,
  padding: "10px 0",
  cursor: "pointer",
};
const tabActive: React.CSSProperties = { color: "#fff", boxShadow: "inset 0 -2px 0 #fff" };
const empty: React.CSSProperties = { color: "#666", textAlign: "center", padding: 28, fontSize: 13 };
const postCard: React.CSSProperties = { padding: "14px 0", borderBottom: `1px solid ${BORDER}` };
const postImg: React.CSSProperties = {
  width: "100%",
  maxHeight: 220,
  objectFit: "cover",
  borderRadius: 12,
  marginTop: 10,
};
const userRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "12px 0",
  borderBottom: `1px solid ${BORDER}`,
  color: "#eee",
};
const smallAv: React.CSSProperties = { width: 40, height: 40, borderRadius: "50%", objectFit: "cover" };
const smallAvFb: React.CSSProperties = {
  ...smallAv,
  display: "grid",
  placeItems: "center",
  background: CARD,
  color: GOLD,
  fontWeight: 800,
};
