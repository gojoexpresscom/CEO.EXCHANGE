import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import TermsScreen from "../legal/TermsScreen";
import PrivacyScreen from "../legal/PrivacyScreen";

type Screen =
  | "login"
  | "signup"
  | "verify-signup"
  | "create-signup-password"
  | "confirm-signup-password";

type LegalPage = "terms" | "privacy" | null;

type TurnstileAPI = {
  render: (
    element: HTMLElement,
    options: {
      sitekey: string;
      theme: "dark";
      callback?: (token: string) => void;
      "expired-callback"?: () => void;
      "error-callback"?: () => void;
    },
  ) => string;
  reset: (widgetId?: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileAPI;
  }
}

type Props = {
  onAuth: () => void;
};

const TEMP_PASSWORD = "Tmp-CEO-Exchange-2026!";
const TERMS_VERSION = 2;

const GOLD = "#f5b51b";
const GOLD_LIGHT = "#ffca3a";

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function normalizePhone(value: string) {
  const v = value.trim();
  if (v.startsWith("+")) return `+${v.slice(1).replace(/\D/g, "")}`;
  return `+${v.replace(/\D/g, "")}`;
}

function validPassword(value: string) {
  return (
    value.length >= 8 &&
    value.length <= 30 &&
    /[a-z]/.test(value) &&
    /[A-Z]/.test(value) &&
    /\d/.test(value)
  );
}

function passwordChecks(value: string) {
  return {
    length: value.length >= 8 && value.length <= 30,
    lower: /[a-z]/.test(value),
    upper: /[A-Z]/.test(value),
    number: /\d/.test(value),
  };
}

function Arrow({ left = false }: { left?: boolean }) {
  return <span aria-hidden="true">{left ? "←" : "→"}</span>;
}

function Eye({ open }: { open: boolean }) {
  return <span aria-hidden="true">{open ? "◉" : "◌"}</span>;
}

function Turnstile({
  siteKey,
  onToken,
}: {
  siteKey?: string;
  onToken: (token: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const widget = useRef<string | undefined>(undefined);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!siteKey) return;

    const mount = () => {
      if (!host.current || !window.turnstile || widget.current) return;

      widget.current = window.turnstile.render(host.current, {
        sitekey: siteKey,
        theme: "dark",
        callback: onToken,
        "expired-callback": () => onToken(""),
        "error-callback": () => onToken(""),
      });
      setLoaded(true);
    };

    if (window.turnstile) {
      mount();
      return;
    }

    const src =
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

    let script = document.querySelector<HTMLScriptElement>(
      `script[src="${src}"]`,
    );

    if (!script) {
      script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.defer = true;
      script.onload = mount;
      document.head.appendChild(script);
    } else {
      const timer = window.setInterval(() => {
        if (window.turnstile) {
          window.clearInterval(timer);
          mount();
        }
      }, 100);
      return () => window.clearInterval(timer);
    }
  }, [siteKey, onToken]);

  if (!siteKey) {
    return (
      <div style={styles.turnstileMissing}>
        Turnstile is not configured yet. Add VITE_TURNSTILE_SITE_KEY in Vercel.
      </div>
    );
  }

  return (
    <div
      ref={host}
      style={{ ...styles.turnstile, opacity: loaded ? 1 : 0.65 }}
    />
  );
}

function Rule({
  ok,
  children,
}: {
  ok: boolean;
  children: React.ReactNode;
}) {
  return (
    <div style={styles.rule}>
      <span style={{ color: ok ? GOLD_LIGHT : "#666", fontSize: 21 }}>
        {ok ? "✓" : "○"}
      </span>
      <span>{children}</span>
    </div>
  );
}

export default function AuthScreen({ onAuth }: Props) {
  const [screen, setScreen] = useState<Screen>("login");
  const [legal, setLegal] = useState<LegalPage>(null);

  const [identifier, setIdentifier] = useState("");
  const [referral, setReferral] = useState("");
  const [showReferral, setShowReferral] = useState(false);
  const [accepted, setAccepted] = useState(false);

  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [turnstileToken, setTurnstileToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [countdown, setCountdown] = useState(60);

  const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as
    | string
    | undefined;

  const checks = useMemo(() => passwordChecks(password), [password]);

  useEffect(() => {
    if (screen !== "verify-signup") return;

    setCountdown(60);
    const timer = window.setInterval(() => {
      setCountdown((value) => Math.max(0, value - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [screen]);

  const clearNotice = () => {
    setError("");
    setMessage("");
  };

  const goLogin = () => {
    clearNotice();
    setScreen("login");
  };

  const goSignup = () => {
    clearNotice();
    setScreen("signup");
  };

  const requireTurnstile = () => {
    if (turnstileSiteKey && !turnstileToken) {
      setError("Please complete the security check.");
      return false;
    }
    return true;
  };

  async function createAccount() {
    clearNotice();

    if (!identifier.trim()) {
      setError("Enter your email or mobile number.");
      return;
    }

    if (!accepted) {
      setError("Please accept the Terms of Service and Privacy Policy.");
      return;
    }

    if (!requireTurnstile()) return;

    const email = isEmail(identifier)
      ? identifier.trim().toLowerCase()
      : undefined;
    const phone = email ? undefined : normalizePhone(identifier);

    if (!email && (!phone || phone.replace(/\D/g, "").length < 8)) {
      setError("Enter a valid email or mobile number.");
      return;
    }

    setLoading(true);

    try {
      const { data, error: authError } = await supabase.auth.signUp({
        ...(email ? { email } : { phone: phone! }),
        password: TEMP_PASSWORD,
        options: {
          captchaToken: turnstileSiteKey ? turnstileToken : undefined,
          data: {
            signup_method: email ? "email" : "phone",
            referral_code: referral.trim() || null,
          },
        },
      });

      if (authError) throw authError;
      if (!data.user) throw new Error("Account creation failed.");

      sessionStorage.setItem(
        "ceo_exchange_signup_identifier",
        email || phone || "",
      );
      sessionStorage.setItem(
        "ceo_exchange_signup_method",
        email ? "email" : "phone",
      );

      setOtp("");
      setCountdown(60);
      setMessage(
        email
          ? `A 6-digit code has been sent to ${email}.`
          : `A 6-digit code has been sent to ${phone}.`,
      );
      setScreen("verify-signup");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyAccount() {
    clearNotice();

    if (!/^\d{6}$/.test(otp)) {
      setError("Enter the 6-digit verification code.");
      return;
    }

    const saved =
      sessionStorage.getItem("ceo_exchange_signup_identifier") ||
      identifier;
    const method =
      sessionStorage.getItem("ceo_exchange_signup_method") ||
      (isEmail(saved) ? "email" : "phone");

    setLoading(true);

    try {
      const result =
        method === "email"
          ? await supabase.auth.verifyOtp({
              email: saved,
              token: otp,
              type: "signup",
            })
          : await supabase.auth.verifyOtp({
              phone: saved,
              token: otp,
              type: "sms",
            });

      if (result.error) throw result.error;

      setPassword("");
      setConfirmPassword("");
      setScreen("create-signup-password");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Verification failed.",
      );
    } finally {
      setLoading(false);
    }
  }

  function continueToConfirm() {
    clearNotice();

    if (!validPassword(password)) {
      setError("Your password does not meet all the requirements.");
      return;
    }

    setConfirmPassword("");
    setScreen("confirm-signup-password");
  }

  async function finishAccount() {
    clearNotice();

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!validPassword(password)) {
      setError("Your password does not meet all the requirements.");
      return;
    }

    setLoading(true);

    try {
      const { data, error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) throw updateError;

      if (data.user) {
        // The current database has terms_acceptances with document_version.
        // Privacy Policy is displayed and accepted together with the Terms.
        await supabase.from("terms_acceptances").insert({
          user_id: data.user.id,
          document_version: TERMS_VERSION,
        });
      }

      sessionStorage.removeItem("ceo_exchange_signup_identifier");
      sessionStorage.removeItem("ceo_exchange_signup_method");

      setMessage("Account created successfully. You can now sign in.");
      setPassword("");
      setConfirmPassword("");
      setOtp("");
      setScreen("login");
      onAuth();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not finish account setup.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function resendCode() {
    if (countdown > 0 || loading) return;

    clearNotice();

    const saved =
      sessionStorage.getItem("ceo_exchange_signup_identifier") ||
      identifier;
    const method =
      sessionStorage.getItem("ceo_exchange_signup_method") ||
      (isEmail(saved) ? "email" : "phone");

    setLoading(true);

    try {
      const result =
        method === "email"
          ? await supabase.auth.resend({
              type: "signup",
              email: saved,
              options: {
                captchaToken: turnstileSiteKey ? turnstileToken : undefined,
              },
            })
          : await supabase.auth.resend({
              type: "sms",
              phone: saved,
            });

      if (result.error) throw result.error;

      setCountdown(60);
      setMessage("A new verification code has been sent.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resend code.");
    } finally {
      setLoading(false);
    }
  }

  async function login() {
    clearNotice();

    if (!isEmail(identifier)) {
      setError("Enter the email address you used to register.");
      return;
    }

    if (!password) {
      setError("Enter your password.");
      return;
    }

    if (!requireTurnstile()) return;

    setLoading(true);

    try {
      const { error: authError } =
        await supabase.auth.signInWithPassword({
          email: identifier.trim().toLowerCase(),
          password,
          options: {
            captchaToken: turnstileSiteKey ? turnstileToken : undefined,
          },
        });

      if (authError) throw authError;

      onAuth();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  async function oauth(provider: "google" | "x") {
    clearNotice();

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: window.location.origin,
      },
    });

    if (oauthError) setError(oauthError.message);
  }

  if (legal) {
    return (
      <main style={styles.page}>
        <div style={styles.legalWrap}>
          <button style={styles.circleBack} onClick={() => setLegal(null)}>
            <Arrow left />
          </button>
          {legal === "terms" ? <TermsScreen /> : <PrivacyScreen />}
        </div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.logoWrap}>
        <img
          src="/ceo-auth-reference-transparent.png"
          alt="CEO Exchange"
          style={styles.logo}
        />
      </div>

      <section style={styles.card}>
        {screen === "login" && (
          <>
            <div style={styles.headerRow}>
              <div>
                <h1 style={styles.title}>Welcome Back</h1>
                <p style={styles.subtitle}>Sign in to continue</p>
              </div>
              <button style={styles.goldLink} onClick={goSignup}>
                Sign Up <Arrow />
              </button>
            </div>

            <div style={styles.field}>
              <span style={styles.icon}>✉</span>
              <input
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Enter your email"
                type="email"
                autoComplete="email"
                style={styles.input}
              />
            </div>

            <div style={styles.field}>
              <span style={styles.icon}>♙</span>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                style={styles.input}
              />
              <button
                type="button"
                style={styles.eyeButton}
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                <Eye open={showPassword} />
              </button>
            </div>

            <Turnstile
              siteKey={turnstileSiteKey}
              onToken={setTurnstileToken}
            />

            <button
              style={styles.forgot}
              onClick={() =>
                setError("Password recovery will be added after sign up.")
              }
            >
              Forgot Password?
            </button>

            <button
              style={styles.primaryButton}
              disabled={loading}
              onClick={login}
            >
              {loading ? "Signing in..." : "Login Now"} <Arrow />
            </button>

            <button
              style={styles.outlineButton}
              onClick={() =>
                setError(
                  "Passkey sign-in will be connected after Supabase Passkeys are enabled.",
                )
              }
            >
              ◉ &nbsp; Login with Passkey
            </button>

            <div style={styles.divider}>
              <span>Or continue with</span>
            </div>

            <button style={styles.socialButton} onClick={() => oauth("google")}>
              <b style={{ color: "#4285F4", fontSize: 23 }}>G</b>
              Continue with Google
            </button>

            <button style={styles.socialButton} onClick={() => oauth("x")}>
              <b style={{ fontSize: 23 }}>𝕏</b>
              Continue with X (Twitter)
            </button>
          </>
        )}

        {screen === "signup" && (
          <>
            <div style={styles.headerRow}>
              <button style={styles.circleBack} onClick={goLogin}>
                <Arrow left />
              </button>
              <button style={styles.goldLink} onClick={goLogin}>
                Login Now
              </button>
            </div>

            <h1 style={styles.signupTitle}>
              Create your <span>account</span>
            </h1>

            <div style={styles.globalRow}>
              <span style={{ fontSize: 25 }}>◎</span>
              <span>CEO Exchange Global</span>
              <span style={{ marginLeft: "auto" }}>↔</span>
            </div>

            <label style={styles.label}>Email / Mobile Number</label>

            <div style={styles.field}>
              <span style={styles.icon}>♙</span>
              <input
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Enter email/mobile (without code)"
                type="text"
                autoComplete="email tel"
                style={styles.input}
              />
            </div>

            <button
              style={styles.referral}
              onClick={() => setShowReferral((v) => !v)}
            >
              Referral Code (Optional)
              <span>{showReferral ? "⌃" : "⌄"}</span>
            </button>

            {showReferral && (
              <div style={styles.field}>
                <input
                  value={referral}
                  onChange={(e) => setReferral(e.target.value)}
                  placeholder="Enter referral code"
                  style={styles.input}
                />
              </div>
            )}

            <label style={styles.agreeRow}>
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                style={styles.checkbox}
              />
              <span>
                I have read and agree to the CEO Exchange{" "}
                <button
                  type="button"
                  style={styles.inlineLink}
                  onClick={() => setLegal("terms")}
                >
                  Terms of Service
                </button>{" "}
                and{" "}
                <button
                  type="button"
                  style={styles.inlineLink}
                  onClick={() => setLegal("privacy")}
                >
                  Privacy Policy
                </button>
              </span>
            </label>

            <Turnstile
              siteKey={turnstileSiteKey}
              onToken={setTurnstileToken}
            />

            <button
              style={styles.primaryButton}
              disabled={loading}
              onClick={createAccount}
            >
              {loading ? "Creating..." : "Create Account"} <Arrow />
            </button>

            <div style={styles.divider}>
              <span>OR</span>
            </div>

            <div style={styles.socialGrid}>
              <button
                style={styles.socialButton}
                onClick={() => oauth("google")}
              >
                <b style={{ color: "#4285F4", fontSize: 22 }}>G</b>
                Google
              </button>

              <button style={styles.socialButton} onClick={() => oauth("x")}>
                <b style={{ fontSize: 22 }}>𝕏</b>
                X (Twitter)
              </button>
            </div>
          </>
        )}

        {screen === "verify-signup" && (
          <>
            <div style={styles.headerRow}>
              <button style={styles.circleBack} onClick={goSignup}>
                <Arrow left />
              </button>
            </div>

            <h1 style={styles.centerTitle}>
              Verify Your <span>Email</span>
            </h1>

            <p style={styles.centerText}>
              A 6-digit code has been sent to:
            </p>
            <p style={styles.emailText}>{identifier}</p>
            <p style={styles.centerText}>
              Your verification code is valid for five (5) minutes.
            </p>

            <div style={styles.otpRow}>
              {Array.from({ length: 6 }).map((_, index) => (
                <input
                  key={index}
                  value={otp[index] || ""}
                  maxLength={1}
                  inputMode="numeric"
                  style={styles.otpBox}
                  onChange={(e) => {
                    const digit = e.target.value.replace(/\D/g, "");
                    const chars = otp.padEnd(6, " ").split("");
                    chars[index] = digit || " ";
                    const next = chars.join("").replace(/\s/g, "").slice(0, 6);
                    setOtp(next);

                    if (digit) {
                      const nextInput =
                        e.currentTarget.parentElement?.children[
                          index + 1
                        ] as HTMLInputElement | undefined;
                      nextInput?.focus();
                    }
                  }}
                />
              ))}
            </div>

            <button
              style={styles.outlineButton}
              disabled={countdown > 0 || loading}
              onClick={resendCode}
            >
              ◷ &nbsp;
              {countdown > 0
                ? `00:${String(countdown).padStart(2, "0")} Resend`
                : "Resend"}
            </button>

            <button
              style={styles.primaryButton}
              disabled={loading}
              onClick={verifyAccount}
            >
              {loading ? "Verifying..." : "Verify Email"} <Arrow />
            </button>
          </>
        )}

        {screen === "create-signup-password" && (
          <>
            <div style={styles.headerRow}>
              <button
                style={styles.circleBack}
                onClick={() => setScreen("verify-signup")}
              >
                <Arrow left />
              </button>
            </div>

            <h1 style={styles.centerTitle}>Create Password</h1>
            <p style={styles.centerText}>
              Set a login password to complete your sign-up.
            </p>

            <div style={styles.field}>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                style={styles.input}
              />
              <button
                type="button"
                style={styles.eyeButton}
                onClick={() => setShowPassword((v) => !v)}
              >
                <Eye open={showPassword} />
              </button>
            </div>

            <div style={styles.rules}>
              <Rule ok={checks.length}>8–30 Characters</Rule>
              <Rule ok={checks.lower}>At least one lowercase letter</Rule>
              <Rule ok={checks.upper}>At least one uppercase letter</Rule>
              <Rule ok={checks.number}>At least one number</Rule>
            </div>

            <button style={styles.primaryButton} onClick={continueToConfirm}>
              Continue <Arrow />
            </button>
          </>
        )}

        {screen === "confirm-signup-password" && (
          <>
            <div style={styles.headerRow}>
              <button
                style={styles.circleBack}
                onClick={() => setScreen("create-signup-password")}
              >
                <Arrow left />
              </button>
            </div>

            <h1 style={styles.centerTitle}>Confirm Password</h1>
            <p style={styles.centerText}>
              Enter your password again to finish creating your account.
            </p>

            <div style={styles.field}>
              <input
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                type={showConfirm ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Confirm password"
                style={styles.input}
              />
              <button
                type="button"
                style={styles.eyeButton}
                onClick={() => setShowConfirm((v) => !v)}
              >
                <Eye open={showConfirm} />
              </button>
            </div>

            <button
              style={styles.primaryButton}
              disabled={loading}
              onClick={finishAccount}
            >
              {loading ? "Finishing..." : "Sign Up Now"} <Arrow />
            </button>
          </>
        )}

        {(error || message) && (
          <div style={error ? styles.error : styles.message}>
            {error || message}
          </div>
        )}
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: "26px 14px 60px",
    background:
      "radial-gradient(circle at 50% 20%, rgba(245,181,27,.08), transparent 34%), #090909",
    color: "#f5f5f5",
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  logoWrap: {
  width: "100%",
  maxWidth: 460,
  margin: "0 auto 14px",
  textAlign: "center",
},
  logo: {
  width: "min(70vw, 280px)",
  maxHeight: 220,
    objectFit: "contain",
    display: "block",
    margin: "0 auto",
  },
  card: {
  width: "calc(100% - 32px)",
  maxWidth: 460,
  padding: "22px 18px",
  borderRadius: 22,
    border: "1px solid rgba(245,181,27,.60)",
    background: "linear-gradient(145deg,#171717,#101010)",
    boxShadow: "0 0 40px rgba(245,181,27,.08)",
  },
  headerRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 24,
  },
  title: {
    margin: 0,
    fontSize: 30,
    lineHeight: 1.15,
    fontWeight: 700,
  },
  signupTitle: {
    margin: "0 0 22px",
    fontSize: 34,
    lineHeight: 1.15,
    fontWeight: 700,
  },
  subtitle: {
    margin: "7px 0 0",
    color: "#858585",
    fontSize: 18,
  },
  centerTitle: {
    margin: "10px 0 14px",
    textAlign: "center",
    fontSize: 30,
    fontWeight: 700,
  },
  centerText: {
    margin: "8px 0",
    color: "#999",
    fontSize: 17,
    lineHeight: 1.55,
    textAlign: "center",
  },
  emailText: {
    margin: "8px 0",
    textAlign: "center",
    color: "#fff",
    fontSize: 18,
  },
  goldLink: {
    border: 0,
    background: "transparent",
    color: GOLD_LIGHT,
    fontSize: 18,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    whiteSpace: "nowrap",
  },
  circleBack: {
    width: 58,
    height: 58,
    borderRadius: "50%",
    border: "1px solid rgba(245,181,27,.35)",
    background: "#171717",
    color: GOLD_LIGHT,
    cursor: "pointer",
    fontSize: 25,
  },
  field: {
    minHeight: 76,
    marginBottom: 16,
    padding: "0 20px",
    display: "flex",
    alignItems: "center",
    borderRadius: 18,
    border: "1px solid rgba(245,181,27,.34)",
    background: "rgba(255,255,255,.015)",
  },
  icon: {
    width: 32,
    flexShrink: 0,
    color: GOLD_LIGHT,
    fontSize: 23,
  },
  input: {
    width: "100%",
    minWidth: 0,
    border: 0,
    outline: 0,
    background: "transparent",
    color: "#fff",
    fontSize: 18,
    padding: "4px 0",
  },
  eyeButton: {
    border: 0,
    background: "transparent",
    color: "#aaa",
    cursor: "pointer",
    padding: 5,
    fontSize: 19,
  },
  turnstile: {
    minHeight: 76,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "4px 0 12px",
    overflow: "hidden",
  },
  turnstileMissing: {
    minHeight: 58,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "4px 0 12px",
    padding: "10px 14px",
    borderRadius: 14,
    border: "1px dashed rgba(245,181,27,.35)",
    color: "#999",
    fontSize: 13,
    textAlign: "center",
  },
  forgot: {
    display: "block",
    margin: "4px 4px 20px auto",
    border: 0,
    background: "transparent",
    color: GOLD_LIGHT,
    fontSize: 17,
    cursor: "pointer",
  },
  primaryButton: {
    width: "100%",
    minHeight: 72,
    marginTop: 14,
    border: 0,
    borderRadius: 18,
    background: "linear-gradient(135deg,#ffca3a,#f1a900)",
    color: "#111",
    fontSize: 21,
    fontWeight: 700,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  outlineButton: {
    width: "100%",
    minHeight: 64,
    marginTop: 16,
    border: "1px solid rgba(245,181,27,.55)",
    borderRadius: 18,
    background: "transparent",
    color: GOLD_LIGHT,
    fontSize: 18,
    cursor: "pointer",
  },
  divider: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    margin: "28px 0 16px",
    color: "#888",
    fontSize: 16,
  },
  socialButton: {
    width: "100%",
    minHeight: 62,
    marginTop: 12,
    border: "1px solid #303030",
    borderRadius: 17,
    background: "#171717",
    color: "#eee",
    fontSize: 17,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  socialGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  },
  globalRow: {
    display: "flex",
    alignItems: "center",
    gap: 14,
    color: "#aaa",
    fontSize: 18,
    marginBottom: 36,
  },
  label: {
    display: "block",
    marginBottom: 10,
    fontSize: 17,
  },
  referral: {
    width: "100%",
    padding: "10px 0 22px",
    border: 0,
    background: "transparent",
    color: "#eee",
    fontSize: 17,
    textAlign: "left",
    cursor: "pointer",
    display: "flex",
    justifyContent: "space-between",
  },
  agreeRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    margin: "10px 0 18px",
    color: "#aaa",
    fontSize: 16,
    lineHeight: 1.6,
  },
  checkbox: {
    width: 22,
    height: 22,
    marginTop: 2,
    accentColor: GOLD_LIGHT,
    flexShrink: 0,
  },
  inlineLink: {
    padding: 0,
    border: 0,
    background: "transparent",
    color: GOLD_LIGHT,
    cursor: "pointer",
    fontSize: "inherit",
  },
  otpRow: {
    display: "grid",
    gridTemplateColumns: "repeat(6, 1fr)",
    gap: 9,
    margin: "30px 0 20px",
  },
  otpBox: {
    width: "100%",
    minWidth: 0,
    aspectRatio: "1 / 1.12",
    border: "1px solid rgba(245,181,27,.45)",
    borderRadius: 13,
    background: "#101010",
    color: "#fff",
    textAlign: "center",
    fontSize: 28,
    outline: "none",
  },
  rules: {
    display: "grid",
    gap: 17,
    margin: "24px 0 32px",
  },
  rule: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    color: "#aaa",
    fontSize: 17,
  },
  error: {
    marginTop: 18,
    padding: 14,
    borderRadius: 12,
    background: "rgba(255,70,70,.10)",
    border: "1px solid rgba(255,70,70,.35)",
    color: "#ff9d9d",
  },
  message: {
    marginTop: 18,
    padding: 14,
    borderRadius: 12,
    background: "rgba(245,181,27,.08)",
    border: "1px solid rgba(245,181,27,.30)",
    color: "#f8cf67",
  },
  legalWrap: {
    width: "100%",
    maxWidth: 900,
    margin: "0 auto",
  },
};

