import { useEffect, useRef, useState } from "react";
import AuthScreen from "./components/auth/AuthScreen";
import Home from "./components/home/Home";
import TradingPage from "./components/trade/TradingPage";
import P2PMarketplace from "./components/p2p/P2PMarketplace";
import AdminPortal from "./components/admin/AdminPortal";
import { supabase } from "./lib/supabase";

type AppRoute =
  | { page: "home" }
  | { page: "trade"; symbol: string }
  | { page: "p2p" };

const SPLASH_VIDEO_SRC = "/branding/ceo-exchange-refresh.mp4";
const SPLASH_MAX_MS = 12000;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getRoute(): AppRoute {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";

  const tradeMatch = path.match(/^\/trade\/(.+)$/i);

  if (tradeMatch) {
    return {
      page: "trade",
      symbol: decodeURIComponent(tradeMatch[1]).toUpperCase(),
    };
  }

  if (path === "/p2p") {
    return {
      page: "p2p",
    };
  }

  return { page: "home" };
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [splashDone, setSplashDone] = useState(() => prefersReducedMotion());
  const [authenticated, setAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isBanned, setIsBanned] = useState(false);
  const [route, setRoute] = useState<AppRoute>(() => getRoute());
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const splashFinishedRef = useRef(false);

  const finishSplash = () => {
    if (splashFinishedRef.current) return;
    splashFinishedRef.current = true;
    setSplashDone(true);
  };

  useEffect(() => {
    let alive = true;

    async function checkSession() {
      const { data } = await supabase.auth.getSession();
      if (!alive) return;

      const session = data.session;
      setAuthenticated(Boolean(session));

      if (session?.user?.id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role, is_banned")
          .eq("id", session.user.id)
          .maybeSingle();

        if (!alive) return;

        const banned = Boolean(profile?.is_banned);
        setIsBanned(banned);

        if (banned) {
          // Force sign-out so the session cannot be reused
          await supabase.auth.signOut();
          setAuthenticated(false);
          setIsAdmin(false);
        } else {
          const role = profile?.role;
          setIsAdmin(role === "admin" || role === "owner");
        }
      }

      setReady(true);
    }

    void checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!alive) return;

      if (event === "PASSWORD_RECOVERY") {
        setReady(true);
        return;
      }

      setAuthenticated(Boolean(session));

      if (session?.user?.id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role, is_banned")
          .eq("id", session.user.id)
          .maybeSingle();

        if (!alive) return;

        const banned = Boolean(profile?.is_banned);
        setIsBanned(banned);

        if (banned) {
          await supabase.auth.signOut();
          setAuthenticated(false);
          setIsAdmin(false);
        } else {
          const role = profile?.role;
          setIsAdmin(role === "admin" || role === "owner");
        }
      } else {
        setIsAdmin(false);
        setIsBanned(false);
      }

      setReady(true);
    });

    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, []);

  // Splash video: play once on load/refresh; never block the app if it fails
  useEffect(() => {
    if (splashDone) return;

    const timeout = window.setTimeout(finishSplash, SPLASH_MAX_MS);

    const video = videoRef.current;
    if (video) {
      const tryPlay = () => {
        const p = video.play();
        if (p && typeof p.catch === "function") {
          p.catch(() => finishSplash());
        }
      };
      tryPlay();
    }

    return () => {
      window.clearTimeout(timeout);
    };
  }, [splashDone]);

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
    const normalizedSymbol = symbol.toUpperCase();

    window.history.pushState(
      {},
      "",
      `/trade/${encodeURIComponent(normalizedSymbol)}`
    );

    setRoute({
      page: "trade",
      symbol: normalizedSymbol,
    });

    window.scrollTo({
      top: 0,
      behavior: "instant",
    });
  }

  function openP2P() {
    window.history.pushState({}, "", "/p2p");

    setRoute({
      page: "p2p",
    });

    window.scrollTo({
      top: 0,
      behavior: "instant",
    });
  }

  function goHome() {
    window.history.pushState({}, "", "/");

    setRoute({
      page: "home",
    });

    window.scrollTo({
      top: 0,
      behavior: "instant",
    });
  }

  // Startup / refresh splash: play the branding video once, then hand off to the app.
  // Never leave the user stuck if the video fails to load or play.
  if (!splashDone || !ready) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          width: "100%",
          maxWidth: "100vw",
          height: "100%",
          maxHeight: "100dvh",
          margin: 0,
          padding: 0,
          overflow: "hidden",
          overscrollBehavior: "none",
          background: "#050505",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          touchAction: "none",
        }}
        aria-busy="true"
        aria-label="CEO Exchange loading"
      >
        {!splashDone && (
          <video
            ref={videoRef}
            src={SPLASH_VIDEO_SRC}
            autoPlay
            muted
            playsInline
            preload="auto"
            onEnded={finishSplash}
            onError={finishSplash}
            onStalled={finishSplash}
            style={{
              width: "100%",
              height: "100%",
              maxWidth: "100vw",
              maxHeight: "100dvh",
              objectFit: "contain",
              objectPosition: "center",
              display: "block",
              background: "#050505",
              pointerEvents: "none",
            }}
          />
        )}
      </div>
    );
  }

  // Banned users see a clean blocked screen (session already signed out)
  if (isBanned) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 18,
          padding: 24,
          background: "#050505",
          color: "#eee",
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            background: "rgba(239,68,68,0.12)",
            border: "1.5px solid rgba(239,68,68,0.35)",
            display: "grid",
            placeItems: "center",
            fontSize: 28,
          }}
        >
          ⛔
        </div>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#fff" }}>
          Account suspended
        </h1>
        <p style={{ margin: 0, maxWidth: 340, color: "#999", lineHeight: 1.55, fontSize: 14 }}>
          This account has been suspended by the platform. If you believe this is a mistake,
          contact support with your registered email.
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

  // Admin / Owner → Admin Portal
  if (isAdmin) {
    return <AdminPortal />;
  }

  if (route.page === "trade") {
    return (
      <TradingPage
        symbol={route.symbol}
        onBack={goHome}
      />
    );
  }

  if (route.page === "p2p") {
    return <P2PMarketplace onBack={goHome} />;
  }

  return (
    <Home
      onLogout={() => {
        setAuthenticated(false);
        goHome();
      }}
      onTrade={openTrade}
      onP2P={openP2P}
    />
  );
}
