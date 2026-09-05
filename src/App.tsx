import { useEffect, useState } from "react";
import AuthScreen from "./components/auth/AuthScreen";
import Home from "./components/home/Home";
import { supabase } from "./lib/supabase";

export default function App() {
  const [ready, setReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    let alive = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setAuthenticated(Boolean(data.session));
      setReady(true);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!alive) return;
      setAuthenticated(Boolean(session));
      setReady(true);
    });

    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);

  if (!ready) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#050505",
          color: "#f5b51b",
          fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
        }}
      >
        Loading CEO Exchange…
      </div>
    );
  }

  return authenticated ? (
    <Home onLogout={() => setAuthenticated(false)} />
  ) : (
    <AuthScreen onAuth={() => setAuthenticated(true)} />
  );
}
