import { useEffect, useState } from "react";
import AuthScreen from "./components/auth/AuthScreen";
import Home from "./components/home/Home";
import TradingPage from "./components/trade/TradingPage";
import TradeHubPage from "./components/trade/TradeHubPage";
import P2PMarketplace from "./components/p2p/P2PMarketplace";
import AdminPortal from "./components/admin/AdminPortal";
import { PromotionsPage } from "./components/promotion";
import MarketsPage from "./components/markets/MarketsPage";
import AssetsPage from "./components/assets/AssetsPage";
import EarnPage from "./components/earn/EarnPage";
import { supabase } from "./lib/supabase";
import type { NavPage } from "./lib/types";

type AppRoute =
  | { page: "home" }
  | { page: "trade"; symbol: string }
  | { page: "trade-hub" }
  | { page: "p2p" }
  | { page: "experience" }
  | { page: "markets" }
  | { page: "assets" }
  | { page: "earn" }
  | { page: "convert" };

function getRoute(): AppRoute {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";

  const tradeMatch = path.match(/^\/trade\/(.+)$/i);
  if (tradeMatch) {
    return {
      page: "trade",
      symbol: decodeURIComponent(tradeMatch[1]).toUpperCase(),
    };
  }

  if (path === "/trade" || path === "/trade-hub") {
    return { page: "trade-hub" };
  }

  if (path === "/p2p") return { page: "p2p" };
  if (path === "/experience" || path === "/promotions")
    return { page: "experience" };
  if (path === "/markets") return { page: "markets" };
  if (path === "/assets") return { page: "assets" };
  if (path === "/earn") return { page: "earn" };
  if (path === "/convert") return { page: "convert" };

  return { page: "home" };
}

/**
 * Auth bootstrap:
 * - ready = true as soon as session presence is known (do NOT wait on profiles)
 * - profile/role/ban load asynchronously after the shell can render
 * - isAdmin stays false until role is verified (AdminPortal never shows optimistically)
 */
export default function App() {
  const [ready, setReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isBanned, setIsBanned] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [route, setRoute] = useState<AppRoute>(() => getRoute());

  useEffect(() => {
    let alive = true;
    let profileSeq = 0;

    async function loadProfileFlags(userId: string) {
      const seq = ++profileSeq;
      setProfileError(null);
      const PROFILE_TIMEOUT_MS = 8000;
      try {
        const profilePromise = supabase
          .from("profiles")
          .select("role, is_banned")
          .eq("id", userId)
          .maybeSingle();

        const timeoutPromise = new Promise<{ data: null; error: { message: string } }>(
          (resolve) =>
            setTimeout(
              () =>
                resolve({
                  data: null,
                  error: { message: `profiles timed out after ${PROFILE_TIMEOUT_MS}ms` },
                }),
              PROFILE_TIMEOUT_MS,
            ),
        );

        const { data: profile, error } = await Promise.race([
          profilePromise,
          timeoutPromise,
        ]);

        if (!alive || seq !== profileSeq) return;

        if (error) {
          console.error("[App] profiles lookup failed:", error.message);
          setProfileError(error.message);
          // Fail safe: not admin; do not block the app
          setIsAdmin(false);
          // Retry once in background after a short delay
          window.setTimeout(() => {
            if (alive) void loadProfileFlags(userId);
          }, 5000);
          return;
        }

        const banned = Boolean(profile?.is_banned);
        setIsBanned(banned);

        if (banned) {
          await supabase.auth.signOut();
          if (!alive || seq !== profileSeq) return;
          setAuthenticated(false);
          setIsAdmin(false);
          return;
        }

        const role = profile?.role;
        setIsAdmin(role === "admin" || role === "owner");
      } catch (e) {
        if (!alive || seq !== profileSeq) return;
        console.error("[App] profiles lookup exception:", e);
        setProfileError(e instanceof Error ? e.message : "Profile lookup failed");
        setIsAdmin(false);
      }
    }

    // Initial session — mark ready immediately after getSession (no profile wait)
    void (async () => {
      const started = performance.now();
      const { data } = await supabase.auth.getSession();
      if (!alive) return;

      const session = data.session;
      setAuthenticated(Boolean(session));
      setReady(true);
      console.log("[App] session resolved", {
        authenticated: Boolean(session),
        ms: Math.round(performance.now() - started),
      });

      if (session?.user?.id) {
        void loadProfileFlags(session.user.id);
      } else {
        setIsAdmin(false);
        setIsBanned(false);
      }
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!alive) return;

      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
        return;
      }

      // SIGNED_OUT / TOKEN_REFRESHED / SIGNED_IN — update auth without blocking UI
      setAuthenticated(Boolean(session));
      setReady(true);

      if (session?.user?.id) {
        // Avoid treating INITIAL_SESSION as a second full bootstrap if getSession already ran;
        // still refresh profile flags on real sign-in / token events.
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
          void loadProfileFlags(session.user.id);
        } else if (event === "INITIAL_SESSION") {
          // Profile already requested by getSession path; skip duplicate if possible.
          // Still safe to load once — loadProfileFlags is sequenced.
          void loadProfileFlags(session.user.id);
        }
      } else {
        setIsAdmin(false);
        setIsBanned(false);
        setProfileError(null);
      }
    });

    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      setRoute(getRoute());
    };
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  function openTrade(symbol: string) {
    const sym = (symbol || "BTCUSDT").toUpperCase();
    window.history.pushState({}, "", `/trade/${encodeURIComponent(sym)}`);
    setRoute({ page: "trade", symbol: sym });
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function goHome() {
    window.history.pushState({}, "", "/");
    setRoute({ page: "home" });
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function goMarkets() {
    window.history.pushState({}, "", "/markets");
    setRoute({ page: "markets" });
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function goAssets() {
    window.history.pushState({}, "", "/assets");
    setRoute({ page: "assets" });
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function goEarn() {
    window.history.pushState({}, "", "/earn");
    setRoute({ page: "earn" });
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function goTradeHub() {
    window.history.pushState({}, "", "/trade-hub");
    setRoute({ page: "trade-hub" });
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function openP2P() {
    window.history.pushState({}, "", "/p2p");
    setRoute({ page: "p2p" });
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function openExperience() {
    window.history.pushState({}, "", "/experience");
    setRoute({ page: "experience" });
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function onNav(page: NavPage) {
    if (page === "home") goHome();
    else if (page === "markets") goMarkets();
    else if (page === "trade") goTradeHub();
    else if (page === "earn") goEarn();
    else if (page === "assets") goAssets();
  }

  if (!ready) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 14,
          background: "#050505",
          color: "#c9a227",
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        }}
      >
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: "50%",
            border: "2.5px solid #2a2110",
            borderTopColor: "#f5b51b",
            animation: "spin 0.85s linear infinite",
          }}
        />
        <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: "0.02em" }}>
          Loading…
        </span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (isBanned) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          background: "#050505",
          color: "#eee",
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
          padding: 24,
          textAlign: "center",
        }}
      >
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#fff" }}>
          Account suspended
        </h1>
        <p
          style={{
            margin: 0,
            maxWidth: 340,
            color: "#999",
            lineHeight: 1.55,
            fontSize: 14,
          }}
        >
          This account has been suspended by the platform. If you believe this
          is a mistake, contact support with your registered email.
        </p>
        <button
          type="button"
          onClick={() => {
            setIsBanned(false);
            window.location.href = "/";
          }}
          style={{
            marginTop: 8,
            minHeight: 44,
            padding: "0 22px",
            borderRadius: 12,
            border: "1px solid #2a2110",
            background: "transparent",
            color: "#f5b51b",
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          Back to login
        </button>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <AuthScreen
        onAuth={() => {
          setAuthenticated(true);
        }}
      />
    );
  }

  // AdminPortal only after role is verified — never optimistic
  if (isAdmin) {
    return <AdminPortal />;
  }

  if (route.page === "trade") {
    return (
      <TradingPage
        symbol={route.symbol}
        onBack={() => {
          goMarkets();
        }}
      />
    );
  }

  if (route.page === "trade-hub") {
    return <TradeHubPage onNavigate={onNav} onOpenPair={openTrade} />;
  }

  if (route.page === "p2p") {
    return <P2PMarketplace onBack={goHome} />;
  }

  if (route.page === "experience") {
    return (
      <PromotionsPage
        onBack={goHome}
        onTrade={(symbol) => openTrade(symbol || "BTCUSDT")}
        onP2P={openP2P}
      />
    );
  }

  if (route.page === "markets") {
    return <MarketsPage onTrade={openTrade} onNavigate={onNav} />;
  }

  if (route.page === "assets") {
    return (
      <AssetsPage
        onNavigate={onNav}
        onOpenEarn={goEarn}
        onOpenConvert={goTradeHub}
      />
    );
  }

  if (route.page === "earn") {
    return <EarnPage onNavigate={onNav} />;
  }

  if (route.page === "convert") {
    return <TradeHubPage onNavigate={onNav} onOpenPair={openTrade} />;
  }

  return (
    <>
      {profileError ? (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 9999,
            background: "rgba(120,40,0,0.92)",
            color: "#fff",
            fontSize: 12,
            padding: "6px 12px",
            textAlign: "center",
          }}
        >
          Profile lookup failed ({profileError}). Running as non-admin.{" "}
          <button
            type="button"
            style={{
              marginLeft: 8,
              border: "1px solid #fff",
              background: "transparent",
              color: "#fff",
              borderRadius: 6,
              padding: "2px 8px",
              cursor: "pointer",
            }}
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      ) : null}
      <Home
        onLogout={() => {
          setAuthenticated(false);
          setIsAdmin(false);
          goHome();
        }}
        onTrade={openTrade}
        onP2P={openP2P}
        onExperience={openExperience}
        onNavigate={onNav}
      />
    </>
  );
}
