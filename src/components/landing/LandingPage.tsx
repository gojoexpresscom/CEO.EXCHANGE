import { useEffect, useState, type CSSProperties } from "react";

type Props = {
  onGetStarted: () => void;
};

/**
 * First-launch / unauthenticated landing.
 * Does not replace AuthScreen — Get Started opens existing login/signup.
 */
export default function LandingPage({ onGetStarted }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  return (
    <div style={S.page}>
      <style>{CSS}</style>

      {/* Ambient background — CSS only, no external proprietary art */}
      <div style={S.bgBase} />
      <div style={S.bgGlow} className={visible ? "ceo-land-in" : undefined} />
      <div style={S.bgGrid} />

      <header style={S.header} className={visible ? "ceo-land-in" : undefined}>
        <div style={S.brand}>
          <img
            src="/ceo-auth-reference-transparent.png"
            alt="CEO Exchange"
            width={140}
            height={42}
            decoding="async"
            fetchPriority="high"
            style={S.logo}
          />
        </div>
        <button type="button" style={S.headerCta} onClick={onGetStarted}>
          Log in
        </button>
      </header>

      <main style={S.main}>
        <section
          style={S.hero}
          className={visible ? "ceo-land-in ceo-land-delay-1" : undefined}
        >
          <p style={S.kicker}>Digital asset spot trading</p>
          <h1 style={S.title}>
            Trade with
            <span style={S.titleGold}> clarity</span>
          </h1>
          <p style={S.sub}>
            Access listed markets, manage your wallet, and move with live data —
            built for a focused mobile trading experience.
          </p>

          <button type="button" style={S.primary} onClick={onGetStarted}>
            Get Started
          </button>

          <p style={S.hint}>
            Already have an account?{" "}
            <button type="button" style={S.linkBtn} onClick={onGetStarted}>
              Log in
            </button>
          </p>
        </section>

        <section
          style={S.features}
          className={visible ? "ceo-land-in ceo-land-delay-2" : undefined}
          aria-label="Platform highlights"
        >
          <Feature
            title="Spot markets"
            body="Browse listed pairs and follow live prices when you are signed in."
          />
          <Feature
            title="Secure account"
            body="Sign in with your CEO Exchange account. Sessions use your existing login."
          />
          <Feature
            title="Wallet tools"
            body="Deposit, withdraw, and track balances from your account after login."
          />
        </section>
      </main>

      <footer style={S.footer} className={visible ? "ceo-land-in ceo-land-delay-3" : undefined}>
        <p style={S.footerText}>
          Support:{" "}
          <a href="mailto:ceo.support.v@gmail.com" style={S.footerLink}>
            ceo.support.v@gmail.com
          </a>
        </p>
        <p style={S.footerFine}>© CEO Exchange</p>
      </footer>
    </div>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div style={S.featureCard}>
      <div style={S.featureDot} />
      <div>
        <h2 style={S.featureTitle}>{title}</h2>
        <p style={S.featureBody}>{body}</p>
      </div>
    </div>
  );
}

const S: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#050505",
    color: "#f2f2f2",
    fontFamily:
      'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    position: "relative",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  },
  bgBase: {
    position: "absolute",
    inset: 0,
    background:
      "radial-gradient(120% 80% at 50% -10%, #1a1408 0%, #050505 55%, #050505 100%)",
    zIndex: 0,
  },
  bgGlow: {
    position: "absolute",
    top: "-8%",
    left: "50%",
    transform: "translateX(-50%)",
    width: "120%",
    height: 320,
    background:
      "radial-gradient(ellipse at center, rgba(245,181,27,0.22) 0%, transparent 70%)",
    zIndex: 0,
    pointerEvents: "none",
    opacity: 0,
  },
  bgGrid: {
    position: "absolute",
    inset: 0,
    backgroundImage:
      "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
    backgroundSize: "48px 48px",
    maskImage: "linear-gradient(to bottom, rgba(0,0,0,0.45), transparent 70%)",
    zIndex: 0,
    pointerEvents: "none",
  },
  header: {
    position: "relative",
    zIndex: 2,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 18px",
    paddingTop: "calc(14px + env(safe-area-inset-top))",
    opacity: 0,
  },
  brand: { display: "flex", alignItems: "center" },
  logo: { height: 36, width: "auto", objectFit: "contain" },
  headerCta: {
    border: "1px solid rgba(245,181,27,0.35)",
    background: "rgba(245,181,27,0.08)",
    color: "#f5b51b",
    borderRadius: 999,
    padding: "8px 14px",
    fontSize: 13,
    fontWeight: 700,
    cursor: "pointer",
  },
  main: {
    position: "relative",
    zIndex: 2,
    flex: 1,
    display: "flex",
    flexDirection: "column",
    padding: "12px 20px 24px",
    maxWidth: 480,
    margin: "0 auto",
    width: "100%",
    boxSizing: "border-box",
  },
  hero: { opacity: 0, marginTop: 28 },
  kicker: {
    margin: "0 0 10px",
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: "0.12em",
    textTransform: "uppercase",
    color: "#f5b51b",
  },
  title: {
    margin: "0 0 14px",
    fontSize: "clamp(28px, 8vw, 36px)",
    fontWeight: 800,
    lineHeight: 1.15,
    letterSpacing: -0.5,
    color: "#fff",
  },
  titleGold: { color: "#f5b51b" },
  sub: {
    margin: "0 0 28px",
    fontSize: 15,
    lineHeight: 1.55,
    color: "#a3a3a3",
    maxWidth: 360,
  },
  primary: {
    width: "100%",
    maxWidth: 360,
    border: 0,
    borderRadius: 14,
    padding: "16px 20px",
    fontSize: 16,
    fontWeight: 800,
    color: "#111",
    background: "linear-gradient(180deg, #ffca3a 0%, #f5b51b 55%, #d4a017 100%)",
    boxShadow: "0 8px 28px rgba(245,181,27,0.28)",
    cursor: "pointer",
  },
  hint: {
    margin: "16px 0 0",
    fontSize: 13,
    color: "#888",
  },
  linkBtn: {
    border: 0,
    background: "transparent",
    color: "#f5b51b",
    fontWeight: 700,
    fontSize: 13,
    padding: 0,
    cursor: "pointer",
  },
  features: {
    marginTop: 36,
    display: "flex",
    flexDirection: "column",
    gap: 10,
    opacity: 0,
  },
  featureCard: {
    display: "flex",
    gap: 12,
    alignItems: "flex-start",
    padding: "14px 14px",
    borderRadius: 14,
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.06)",
  },
  featureDot: {
    width: 8,
    height: 8,
    marginTop: 6,
    borderRadius: "50%",
    background: "#f5b51b",
    flexShrink: 0,
  },
  featureTitle: {
    margin: "0 0 4px",
    fontSize: 14,
    fontWeight: 700,
    color: "#eee",
  },
  featureBody: {
    margin: 0,
    fontSize: 12,
    lineHeight: 1.45,
    color: "#8a8a8a",
  },
  footer: {
    position: "relative",
    zIndex: 2,
    padding: "16px 20px",
    paddingBottom: "calc(20px + env(safe-area-inset-bottom))",
    textAlign: "center",
    opacity: 0,
  },
  footerText: { margin: "0 0 6px", fontSize: 12, color: "#777" },
  footerLink: { color: "#f5b51b", textDecoration: "none" },
  footerFine: { margin: 0, fontSize: 11, color: "#555" },
};

const CSS = `
  .ceo-land-in {
    animation: ceoLandIn 0.55s ease-out forwards;
  }
  .ceo-land-delay-1 { animation-delay: 0.08s; }
  .ceo-land-delay-2 { animation-delay: 0.16s; }
  .ceo-land-delay-3 { animation-delay: 0.24s; }
  @keyframes ceoLandIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  button:active { transform: scale(0.98); }
`;
