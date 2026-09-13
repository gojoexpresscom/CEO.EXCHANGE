import { useEffect, useState } from "react";
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
  const [authenticated, setAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isBanned, setIsBanned] = useState(false);
  const [route, setRoute] = useState<AppRoute>(() => getRoute());

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

  if (!ready) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          background:
            "radial-gradient(ellipse at 50% 30%, rgba(245,181,27,.08), transparent 50%), #050505",
          color: "#f5b51b",
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        }}
      >
        <img
          src="/ceo-auth-reference-transparent.png"
          alt="CEO Exchange"
          style={{
            width: 72,
            height: 72,
            objectFit: "contain",
            filter: "drop-shadow(0 8px 24px rgba(245,181,27,.25))",
          }}
        />
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
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
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
