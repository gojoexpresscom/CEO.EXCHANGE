import { useEffect, useState } from "react";
import AuthScreen from "./components/auth/AuthScreen";
import Home from "./components/home/Home";
import TradingPage from "./components/trade/TradingPage";
import P2PMarketplace from "./components/p2p/P2PMarketplace";
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
  const [route, setRoute] = useState<AppRoute>(() => getRoute());

  useEffect(() => {
    let alive = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;

      setAuthenticated(Boolean(data.session));
      setReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!alive) return;

      if (event === "PASSWORD_RECOVERY") {
        // A recovery session was just created. Don't treat this as a normal
        // login — let AuthScreen take over and show the new-password screen.
        setReady(true);
        return;
      }

      setAuthenticated(Boolean(session));
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

  if (!authenticated) {
    return (
      <AuthScreen
        onAuth={() => {
          setAuthenticated(true);
        }}
      />
    );
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
