import { useEffect, useState } from "react";
import AuthScreen from "./components/auth/AuthScreen";
import Home from "./components/home/Home";
import TradingPage from "./components/trading/TradingPage";
import { supabase } from "./lib/supabase";

type AppRoute =
  | { page: "home" }
  | { page: "trade"; symbol: string };

function getRoute(): AppRoute {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";

  const tradeMatch = path.match(/^\/trade\/(.+)$/i);

  if (tradeMatch) {
    return {
      page: "trade",
      symbol: decodeURIComponent(tradeMatch[1]).toUpperCase(),
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
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!alive) return;

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
          display: "grid",
          placeItems: "center",
          background: "#050505",
          color: "#f5b51b",
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        }}
      >
        Loading CEO Exchange…
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

  return (
    <Home
      onLogout={() => {
        setAuthenticated(false);
        goHome();
      }}
      onTrade={openTrade}
    />
  );
}
