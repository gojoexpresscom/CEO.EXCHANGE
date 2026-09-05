import React, { FormEvent, useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import TermsScreen from "../legal/TermsScreen";
import PrivacyScreen from "../legal/PrivacyScreen";

type Screen =
  | "login"
  | "signup"
  | "verify-signup"
  | "create-signup-password"
  | "confirm-signup-password"
  | "forgot"
  | "recovery-sent"
  | "password-reset-success"
  | "create-recovery-password"
  | "confirm-recovery-password"
  | "oauth-password"
  | "oauth-confirm";

type LegalPage = "terms" | "privacy" | null;
type SignupMethod = "email" | "phone";
type PasswordKind = "signup" | "recovery" | "oauth";
type Props = { onAuth: () => void };

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

const GOLD = "#f5b51b";
const GOLD_LIGHT = "#ffca3a";
const TERMS_VERSION = 2;

const PASSWORD_RULES = [
  ["8–30 characters", (p: string) => p.length >= 8 && p.length <= 30],
  ["At least one lowercase letter", (p: string) => /[a-z]/.test(p)],
  ["At least one uppercase letter", (p: string) => /[A-Z]/.test(p)],
  ["At least one number", (p: string) => /\d/.test(p)],
  ["At least one special character (#, $ or @)", (p: string) => /[#@$]/.test(p)],
] as const;

function validPassword(value: string) {
  return PASSWORD_RULES.every(([, test]) => test(value));
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function normalizePhone(value: string) {
  const v = value.trim();
  if (v.startsWith("+")) return `+${v.slice(1).replace(/\D/g, "")}`;
  return `+${v.replace(/\D/g, "")}`;
}

function makeTempPassword() {
  const random = typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `Tmp-${random}Aa1!`;
}

function Arrow({ left = false }: { left?: boolean }) {
  return <span aria-hidden="true">{left ? "←" : "→"}</span>;
}

function Eye({ open }: { open: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      {open ? (
        <>
          <path d="M2.5 12s3.2-5 9.5-5 9.5 5 9.5 5-3.2 5-9.5 5-9.5-5-9.5-5Z" fill="none" stroke="currentColor" strokeWidth="1.8"/>
          <circle cx="12" cy="12" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.8"/>
        </>
      ) : (
        <>
          <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          <path d="M5.2 8.2C3.5 9.4 2.5 12 2.5 12s3.2 5 9.5 5c1.7 0 3.2-.35 4.5-.88" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          <path d="M9.4 5.42C10.08 5.15 10.8 5 12 5c6.3 0 9.5 5 9.5 5s-.7 1.1-1.9 2.4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
        </>
      )}
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3.2" y="5.2" width="17.6" height="13.6" rx="2.2" fill="none" stroke="currentColor" strokeWidth="1.9"/>
      <path d="m4.3 7 7.7 5.7L19.7 7" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4.1" y="10" width="15.8" height="10.5" rx="2" fill="none" stroke="currentColor" strokeWidth="1.9"/>
      <path d="M7.5 10V7.2a4.5 4.5 0 0 1 9 0V10" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"/>
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M21.35 12.23c0-.71-.06-1.4-.18-2.06H12v3.9h5.24a4.48 4.48 0 0 1-1.94 2.94v2.44h3.14c1.84-1.69 2.91-4.18 2.91-7.22Z" />
      <path fill="#34A853" d="M12 21.72c2.63 0 4.84-.87 6.45-2.36l-3.14-2.44c-.87.58-1.98.92-3.31.92-2.55 0-4.71-1.72-5.49-4.03H3.27v2.52A9.74 9.74 0 0 0 12 21.72Z" />
      <path fill="#FBBC05" d="M6.51 13.81A5.85 5.85 0 0 1 6.2 12c0-.63.11-1.25.31-1.81V7.67H3.27A9.72 9.72 0 0 0 2.25 12c0 1.57.38 3.05 1.02 4.33l3.24-2.52Z" />
      <path fill="#EA4335" d="M12 6.16c1.43 0 2.71.49 3.72 1.45l2.79-2.79C16.84 3.24 14.63 2.28 12 2.28a9.74 9.74 0 0 0-8.73 5.39l3.24 2.52c.78-2.31 2.94-4.03 5.49-4.03Z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M18.9 2H22l-6.77 7.74L23.2 22h-6.25l-4.9-6.41L6.44 22H3.33l7.24-8.28L3 2h6.41l4.43 5.86L18.9 2Zm-1.1 17.98h1.73L8.47 3.9H6.61L17.8 19.98Z" />
    </svg>
  );
}

function Rule({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <div style={styles.rule}>
      <span style={{ color: ok ? GOLD_LIGHT : "#666", fontSize: 18 }}>{ok ? "✓" : "○"}</span>
      <span>{children}</span>
    </div>
  );
}

function Turnstile({ siteKey, onToken }: { siteKey?: string; onToken: (token: string) => void }) {
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

    const src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    let script = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);

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
        Security check is not configured. Add <b>VITE_TURNSTILE_SITE_KEY</b> in Vercel.
      </div>
    );
  }

  return <div ref={host} style={{ ...styles.turnstile, opacity: loaded ? 1 : 0.65 }} />;
}

export default function AuthScreen({ onAuth }: Props) {
  const [screen, setScreen] = useState<Screen>("login");
  const [legal, setLegal] = useState<LegalPage>(null);
  const [identifier, setIdentifier] = useState("");
  const [email, setEmail] = useState("");
  const [signupMethod, setSignupMethod] = useState<SignupMethod>("email");
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

  const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;


  const clearNotice = () => {
    setError("");
    setMessage("");
  };

  const resetPasswordFields = () => {
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirm(false);
  };

  const goLogin = () => {
    clearNotice();
    resetPasswordFields();
    setOtp("");
    setScreen("login");
  };

  const goSignup = () => {
    clearNotice();
    resetPasswordFields();
    setScreen("signup");
  };

  const requireTurnstile = () => {
    if (turnstileSiteKey && !turnstileToken) {
      setError("Please complete the security check.");
      return false;
    }
    return true;
  };

  useEffect(() => {
    if (screen !== "verify-signup") return;
    setCountdown(60);
    const timer = window.setInterval(() => setCountdown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [screen]);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        clearNotice();
        resetPasswordFields();
        setScreen("create-recovery-password");
      }
    });

    const params = new URLSearchParams(window.location.search);
    const referralFromUrl = params.get("ref");
    if (referralFromUrl) setReferral(referralFromUrl.trim().toUpperCase());

    if (params.get("oauth") === "1") void handleOAuthReturn();
    if (params.get("reset") === "1") void handleRecoveryLinkReturn();

    return () => data.subscription.unsubscribe();
  }, []);

  async function createAccount() {
    clearNotice();
    if (!identifier.trim()) return setError("Enter your email or mobile number.");
    if (!accepted) return setError("Please accept the Terms of Service and Privacy Policy.");
    if (!requireTurnstile()) return;

    const emailValue = isEmail(identifier) ? identifier.trim().toLowerCase() : undefined;
    const phoneValue = emailValue ? undefined : normalizePhone(identifier);

    if (!emailValue && phoneValue.replace(/\D/g, "").length < 8) {
      return setError("Enter a valid email or mobile number.");
    }

    const method: SignupMethod = emailValue ? "email" : "phone";
    setSignupMethod(method);
    setLoading(true);

    try {
      const { data, error: authError } = await supabase.auth.signUp({
        ...(emailValue ? { email: emailValue } : { phone: phoneValue! }),
        password: makeTempPassword(),
        options: {
          ...(phoneValue ? { channel: "sms" } : {}),
          captchaToken: turnstileSiteKey ? turnstileToken : undefined,
          data: {
            signup_method: method,
            referral_code: referral.trim().toUpperCase() || null,
            password_initialized: false,
            auth_onboarding_required: true,
          },
        },
      });

      if (authError) throw authError;
      if (!data.user) throw new Error("Account creation failed.");

      const savedIdentifier = emailValue || phoneValue!;
      sessionStorage.setItem("ceo_exchange_signup_identifier", savedIdentifier);
      sessionStorage.setItem("ceo_exchange_signup_method", method);
      setEmail(emailValue || "");
      setOtp("");
      setCountdown(60);
      setMessage(`A 6-digit code has been sent to ${savedIdentifier}.`);
      setScreen("verify-signup");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed.");
    } finally {
      setLoading(false);
      setTurnstileToken("");
    }
  }

  async function verifySignup() {
    clearNotice();
    if (!/^\d{6}$/.test(otp)) return setError("Enter the 6-digit verification code.");

    const saved = sessionStorage.getItem("ceo_exchange_signup_identifier") || identifier;
    const method = (sessionStorage.getItem("ceo_exchange_signup_method") as SignupMethod | null) || (isEmail(saved) ? "email" : "phone");

    setLoading(true);
    try {
      const result = method === "email"
        ? await supabase.auth.verifyOtp({ email: saved, token: otp, type: "email" })
        : await supabase.auth.verifyOtp({ phone: saved, token: otp, type: "sms" });

      if (result.error) throw result.error;
      if (!result.data.session) throw new Error("Verification succeeded, but no session was created.");

      setIdentifier(saved);
      setSignupMethod(method);
      resetPasswordFields();
      setScreen("create-signup-password");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setLoading(false);
    }
  }

  async function resendSignup() {
    if (countdown > 0 || loading) return;
    clearNotice();

    const saved = sessionStorage.getItem("ceo_exchange_signup_identifier") || identifier;
    const method = (sessionStorage.getItem("ceo_exchange_signup_method") as SignupMethod | null) || (isEmail(saved) ? "email" : "phone");

    setLoading(true);
    try {
      const result = method === "email"
        ? await supabase.auth.resend({
            type: "signup",
            email: saved,
            options: { captchaToken: turnstileSiteKey ? turnstileToken : undefined },
          })
        : await supabase.auth.resend({ type: "sms", phone: saved });

      if (result.error) throw result.error;
      setCountdown(60);
      setMessage("A new verification code has been sent.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resend code.");
    } finally {
      setLoading(false);
      setTurnstileToken("");
    }
  }

  async function login(e?: FormEvent) {
    e?.preventDefault();
    clearNotice();
    if (!identifier.trim()) return setError("Enter your email or mobile number.");
    if (!password) return setError("Enter your password.");
    if (!requireTurnstile()) return;

    const emailValue = isEmail(identifier) ? identifier.trim().toLowerCase() : undefined;
    const phoneValue = emailValue ? undefined : normalizePhone(identifier);
    if (!emailValue && phoneValue.replace(/\D/g, "").length < 8) return setError("Enter a valid email or mobile number.");

    setLoading(true);
    try {
      const result = emailValue
        ? await supabase.auth.signInWithPassword({
            email: emailValue,
            password,
            options: { captchaToken: turnstileSiteKey ? turnstileToken : undefined },
          })
        : await supabase.auth.signInWithPassword({
            phone: phoneValue!,
            password,
            options: { captchaToken: turnstileSiteKey ? turnstileToken : undefined },
          });

      if (result.error) throw result.error;
      onAuth();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setLoading(false);
      setTurnstileToken("");
    }
  }

  async function forgotStart(e: FormEvent) {
    e.preventDefault();
    clearNotice();
    const emailValue = identifier.trim().toLowerCase();
    if (!isEmail(emailValue)) return setError("Enter a valid email address.");
    if (!requireTurnstile()) return;

    setLoading(true);
    try {
      const { error: recoveryError } = await supabase.auth.resetPasswordForEmail(emailValue, {
        redirectTo: `${window.location.origin}/?reset=1`,
      });
      if (recoveryError) throw recoveryError;

      setEmail(emailValue);
      setTurnstileToken("");
      setMessage("If an account exists for this email, a secure password-reset link has been sent.");
      setScreen("recovery-sent");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start password recovery.");
    } finally {
      setLoading(false);
      setTurnstileToken("");
    }
  }

  async function resendRecovery() {
    if (countdown > 0 || loading || !email.trim()) return;
    clearNotice();
    setLoading(true);
    try {
      const { error: recoveryError } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/?reset=1`,
      });
      if (recoveryError) throw recoveryError;
      setCountdown(60);
      setMessage("A new password-reset link has been sent.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resend the password-reset link.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRecoveryLinkReturn() {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      setError(error.message);
      return;
    }
    if (data.session) {
      clearNotice();
      resetPasswordFields();
      setScreen("create-recovery-password");
    } else {
      setError("This password-reset link is invalid or has expired. Please request a new one.");
      setScreen("forgot");
    }
  }

  async function oauth(provider: "google" | "x") {
    clearNotice();
    sessionStorage.setItem("ceo_oauth_started", "1");

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/?oauth=1` },
    });

    if (oauthError) {
      sessionStorage.removeItem("ceo_oauth_started");
      setError(oauthError.message);
    }
  }

  async function handleOAuthReturn() {
    if (sessionStorage.getItem("ceo_oauth_started") !== "1") return;
    sessionStorage.removeItem("ceo_oauth_started");

    const { data, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !data.session) {
      setError(sessionError?.message || "Social sign-in completed without a session.");
      return;
    }

    const user = data.session.user;
    const provider = user.app_metadata?.provider;
    const initialized = user.user_metadata?.password_initialized === true;

    setEmail(user.email || "");
    if ((provider === "google" || provider === "x") && !initialized) {
      setAccepted(false);
      resetPasswordFields();
      setScreen("oauth-password");
    } else {
      onAuth();
    }
  }

  async function continuePassword() {
    clearNotice();
    if (!validPassword(password)) {
      setError("Password must be 8–30 characters and include lowercase, uppercase, a number, and #, $ or @.");
      return;
    }

    setConfirmPassword("");
    if (screen === "create-signup-password") setScreen("confirm-signup-password");
    else if (screen === "create-recovery-password") setScreen("confirm-recovery-password");
    else setScreen("oauth-confirm");
  }

  async function savePassword(kind: PasswordKind) {
    clearNotice();
    if (!validPassword(password)) return setError("Password does not meet all requirements.");
    if (password !== confirmPassword) return setError("Passwords do not match.");
    if (kind === "oauth" && !accepted) return setError("Please accept the Terms of Service and Privacy Policy.");

    setLoading(true);
    try {
      const { data, error: updateError } = await supabase.auth.updateUser({
        password,
        data: {
          password_initialized: true,
          auth_onboarding_required: false,
        },
      });

      if (updateError) throw updateError;
      if (!data.user) throw new Error("Password was not saved.");

      if (kind === "signup" || kind === "oauth") {
        const { error: termsError } = await supabase.from("terms_acceptances").insert({
          user_id: data.user.id,
          document_version: TERMS_VERSION,
        });
        if (termsError) throw new Error(`Password saved, but terms acceptance was not recorded: ${termsError.message}`);
      }

      if ((kind === "signup" || kind === "oauth") && referral.trim()) {
        const { error: referralError } = await supabase.rpc("apply_referral_code", {
          p_user_id: data.user.id,
          p_referral_code: referral.trim().toUpperCase(),
        });
        if (referralError) throw new Error(`Password saved, but referral code was not applied: ${referralError.message}`);
      }

      if (kind === "recovery") {
        const { error: signOutError } = await supabase.auth.signOut();
        if (signOutError) throw new Error(`Password changed, but we could not finish the recovery session: ${signOutError.message}`);
        resetPasswordFields();
        setOtp("");
        setLoading(false);
        setScreen("password-reset-success");
        return;
      }

      sessionStorage.removeItem("ceo_exchange_signup_identifier");
      sessionStorage.removeItem("ceo_exchange_signup_method");
      resetPasswordFields();
      setOtp("");
      setLoading(false);
      onAuth();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save password.");
      setLoading(false);
    }
  }

  const title: Record<Screen, React.ReactNode> = {
    login: <>Welcome <span>Back</span></>,
    signup: <>Create your <span>account</span></>,
    "verify-signup": <>Verify Your <span>{signupMethod === "phone" ? "Mobile" : "Email"}</span></>,
    "create-signup-password": <>Create <span>Password</span></>,
    "confirm-signup-password": <>Confirm <span>Password</span></>,
    forgot: <>Forgot <span>Password?</span></>,
    "recovery-sent": <>Check Your <span>Email</span></>,
    "create-recovery-password": <>Create New <span>Password</span></>,
    "confirm-recovery-password": <>Confirm New <span>Password</span></>,
    "oauth-password": <>Create <span>Password</span></>,
    "oauth-confirm": <>Confirm <span>Password</span></>,
  };

  const passwordCreateScreen = ["create-signup-password", "create-recovery-password", "oauth-password"].includes(screen);
  const passwordConfirmScreen = ["confirm-signup-password", "confirm-recovery-password", "oauth-confirm"].includes(screen);
  const passwordScreen = passwordCreateScreen || passwordConfirmScreen;
  const passwordKind: PasswordKind = screen.includes("signup") ? "signup" : screen.includes("recovery") ? "recovery" : "oauth";

  if (legal) {
    return (
      <main style={{ ...styles.page, padding: 0 }}>
        <div style={styles.legalWrap}>
          <button type="button" style={styles.circleBack} onClick={() => setLegal(null)} aria-label="Back">
            <Arrow left />
          </button>
          {legal === "terms" ? <TermsScreen /> : <PrivacyScreen />}
        </div>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <div style={styles.glow} />

      <div style={styles.logoWrap}>
        <img src="/ceo-auth-reference-transparent.png" alt="CEO Exchange" style={styles.logo} />
      </div>

      <section style={{ ...styles.card, ...(passwordScreen ? styles.passwordCard : {}) }}>
        {screen === "login" && (
          <form onSubmit={login}>
            <div style={styles.headerRow}>
              <div>
                <h1 style={styles.title}>{title.login}</h1>
                <p style={styles.subtitle}>Sign in to continue to CEO Exchange</p>
              </div>
              <button type="button" style={styles.goldLink} onClick={goSignup}>Sign Up <Arrow /></button>
            </div>

            <label style={styles.label}>Email / Mobile Number</label>
            <div style={styles.field}>
              <span style={styles.icon}><MailIcon /></span>
              <input
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Enter your email or mobile"
                type="text"
                autoComplete="username"
                style={styles.input}
              />
            </div>

            <label style={styles.label}>Password</label>
            <div style={styles.field}>
              <span style={styles.icon}><LockIcon /></span>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                style={styles.input}
              />
              <button type="button" style={styles.eyeButton} onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Hide password" : "Show password"}>
                <Eye open={showPassword} />
              </button>
            </div>

            <Turnstile siteKey={turnstileSiteKey} onToken={setTurnstileToken} />

            <button type="button" style={styles.forgot} onClick={() => { clearNotice(); setScreen("forgot"); }}>
              Forgot Password?
            </button>

            <button type="submit" style={styles.primaryButton} disabled={loading}>
              {loading ? "Signing in…" : "Login Now"} <Arrow />
            </button>
          </form>
        )}

        {screen === "login" && (
          <>
            <div style={styles.divider}><span>Or continue with</span></div>

            <div style={styles.socialGrid}>
              <button type="button" style={styles.socialButton} onClick={() => void oauth("google")}>
                <GoogleIcon /> Google
              </button>
              <button type="button" style={styles.socialButton} onClick={() => void oauth("x")}>
                <XIcon /> X
              </button>
            </div>
          </>
        )}

        {screen === "signup" && (
          <>
            <div style={styles.headerRow}>
              <button type="button" style={styles.circleBack} onClick={goLogin} aria-label="Back to login"><Arrow left /></button>
              <button type="button" style={styles.goldLink} onClick={goLogin}>Login Now</button>
            </div>

            <h1 style={styles.signupTitle}>{title.signup}</h1>
            <div style={styles.globalRow}><span style={{ fontSize: 22 }}>◎</span><span>CEO Exchange Global</span><span style={{ marginLeft: "auto" }}>↔</span></div>

            <label style={styles.label}>Email / Mobile Number</label>
            <div style={styles.field}>
              <span style={styles.icon}><MailIcon /></span>
              <input
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="Enter email/mobile (without code)"
                type="text"
                autoComplete="email tel"
                style={styles.input}
              />
            </div>

            <button type="button" style={styles.referral} onClick={() => setShowReferral((v) => !v)}>
              Referral Code (Optional)<span>{showReferral ? "⌃" : "⌄"}</span>
            </button>

            {showReferral && (
              <div style={styles.field}>
                <input value={referral} onChange={(e) => setReferral(e.target.value.toUpperCase())} placeholder="Enter referral code" style={styles.input} />
              </div>
            )}

            <label style={styles.agreeRow}>
              <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} style={styles.checkbox} />
              <span>
                I have read and agree to the CEO Exchange{" "}
                <button type="button" style={styles.inlineLink} onClick={() => setLegal("terms")}>Terms of Service</button>{" "}
                and{" "}
                <button type="button" style={styles.inlineLink} onClick={() => setLegal("privacy")}>Privacy Policy</button>.
              </span>
            </label>

            <Turnstile siteKey={turnstileSiteKey} onToken={setTurnstileToken} />

            <button type="button" style={styles.primaryButton} disabled={loading} onClick={() => void createAccount()}>
              {loading ? "Creating…" : "Create Account"} <Arrow />
            </button>

            <div style={styles.divider}><span>OR</span></div>
            <div style={styles.socialGrid}>
              <button type="button" style={styles.socialButton} onClick={() => void oauth("google")}><GoogleIcon /> Google</button>
              <button type="button" style={styles.socialButton} onClick={() => void oauth("x")}><XIcon /> X (Twitter)</button>
            </div>
          </>
        )}

        {screen === "verify-signup" && (
          <>
            <div style={styles.headerRow}>
              <button type="button" style={styles.circleBack} onClick={() => setScreen("signup")} aria-label="Back"><Arrow left /></button>
            </div>
            <h1 style={styles.centerTitle}>{title["verify-signup"]}</h1>
            <p style={styles.centerText}>A 6-digit verification code has been sent to:</p>
            <p style={styles.emailText}>{signupMethod === "phone" ? sessionStorage.getItem("ceo_exchange_signup_identifier") || identifier : email || identifier}</p>
            <p style={styles.centerText}>Enter the code from your email or SMS.</p>
            <div style={styles.otpRow}>
              {Array.from({ length: 6 }).map((_, index) => (
                <input key={index} id={`ceo-otp-${index}`} value={otp[index] || ""} maxLength={1} inputMode="numeric"
                  autoComplete={index === 0 ? "one-time-code" : "off"} style={styles.otpBox}
                  onChange={(e) => setOtpDigit(index, e.target.value)}
                  onKeyDown={(e) => handleOtpKey(index, e.key)}
                  aria-label={`Verification digit ${index + 1}`} />
              ))}
            </div>
            <button type="button" style={styles.resend} disabled={countdown > 0 || loading} onClick={() => void resendSignup()}>
              {countdown > 0 ? `00:${String(countdown).padStart(2, "0")} Resend` : "Resend code"}
            </button>
            <button type="button" style={styles.primaryButton} disabled={loading} onClick={() => void verifySignup()}>
              {loading ? "Verifying…" : "Continue"} <Arrow />
            </button>
          </>
        )}

        {screen === "recovery-sent" && (
          <>
            <div style={styles.headerRow}>
              <button type="button" style={styles.circleBack} onClick={goLogin} aria-label="Back to login"><Arrow left /></button>
            </div>
            <h1 style={styles.centerTitle}>{title["recovery-sent"]}</h1>
            <p style={styles.centerText}>If an account exists for this email, we sent a secure password-reset link to:</p>
            <p style={styles.emailText}>{email}</p>
            <p style={styles.centerText}>Open the link on this device to create your new password. You do not need your old password.</p>
            <button type="button" style={styles.resend} disabled={countdown > 0 || loading} onClick={() => void resendRecovery()}>
              {countdown > 0 ? `00:${String(countdown).padStart(2, "0")} Resend` : "Send link again"}
            </button>
            <button type="button" style={styles.primaryButton} onClick={goLogin}>Back to Login <Arrow /></button>
          </>
        )}

        {screen === "password-reset-success" && (
          <>
            <div style={styles.successIcon} aria-hidden="true">✓</div>
            <h1 style={styles.centerTitle}>{title["password-reset-success"]}</h1>
            <p style={styles.centerText}>Your password has been changed successfully. You can now log in with your new password.</p>
            <button type="button" style={styles.primaryButton} onClick={goLogin}>Back to Login <Arrow /></button>
          </>
        )}

        {passwordScreen && (
          <>
            <div style={styles.headerRow}>
              <button
                type="button"
                style={styles.circleBack}
                onClick={() => setScreen(
                  passwordConfirmScreen
                    ? screen === "confirm-signup-password"
                      ? "create-signup-password"
                      : screen === "confirm-recovery-password"
                        ? "create-recovery-password"
                        : "oauth-password"
                    : passwordKind === "signup"
                      ? "verify-signup"
                      : passwordKind === "recovery"
                        ? "recovery-sent"
                        : "login",
                )}
                aria-label="Back"
              >
                <Arrow left />
              </button>
            </div>

            <h1 style={styles.centerTitle}>{title[screen]}</h1>
            <p style={styles.centerText}>
              {passwordCreateScreen
                ? "Create a strong password. Your password is stored securely by Supabase Auth."
                : "Enter the same password again to confirm it."}
            </p>

            <div style={styles.field}>
              <span style={styles.icon}><LockIcon /></span>
              <input
                value={passwordCreateScreen ? password : confirmPassword}
                onChange={(e) => passwordCreateScreen ? setPassword(e.target.value) : setConfirmPassword(e.target.value)}
                type={passwordCreateScreen ? (showPassword ? "text" : "password") : (showConfirm ? "text" : "password")}
                autoComplete="new-password"
                placeholder={passwordCreateScreen ? "Enter new password" : "Confirm password"}
                style={styles.input}
              />
              <button type="button" style={styles.eyeButton} onClick={() => passwordCreateScreen ? setShowPassword((v) => !v) : setShowConfirm((v) => !v)} aria-label={passwordCreateScreen ? (showPassword ? "Hide password" : "Show password") : (showConfirm ? "Hide password" : "Show password")}>
                <Eye open={passwordCreateScreen ? showPassword : showConfirm} />
              </button>
            </div>

            {passwordCreateScreen && (
              <div style={styles.rules}>
                {PASSWORD_RULES.map(([label, test]) => <Rule key={label} ok={test(password)}>{label}</Rule>)}
              </div>
            )}

            {screen === "oauth-password" && (
              <label style={styles.agreeRow}>
                <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} style={styles.checkbox} />
                <span>
                  I agree to the CEO Exchange{" "}
                  <button type="button" style={styles.inlineLink} onClick={() => setLegal("terms")}>Terms of Service</button>{" "}
                  and{" "}
                  <button type="button" style={styles.inlineLink} onClick={() => setLegal("privacy")}>Privacy Policy</button>.
                </span>
              </label>
            )}

            {passwordConfirmScreen && (
              <div style={{ ...styles.confirmHint, color: password === confirmPassword && confirmPassword ? "#7bd58f" : "#aaa" }}>
                {password === confirmPassword && confirmPassword ? "✓ Passwords match" : "Passwords must match"}
              </div>
            )}

            <button type="button" style={styles.primaryButton} disabled={loading} onClick={() => passwordCreateScreen ? void continuePassword() : void savePassword(passwordKind)}>
              {loading ? "Saving…" : passwordCreateScreen ? "Continue" : passwordKind === "signup" ? "Sign Up Now" : "Save Password & Continue"} <Arrow />
            </button>
          </>
        )}

        {screen === "forgot" && (
          <form onSubmit={forgotStart}>
            <div style={styles.headerRow}>
              <button type="button" style={styles.circleBack} onClick={goLogin} aria-label="Back to login"><Arrow left /></button>
            </div>
            <h1 style={styles.centerTitle}>{title.forgot}</h1>
            <p style={styles.centerText}>Enter your email and we’ll send a secure password-reset link.</p>
            <label style={styles.label}>Email</label>
            <div style={styles.field}>
              <span style={styles.icon}><MailIcon /></span>
              <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} type="email" placeholder="Enter your email" autoComplete="email" style={styles.input} />
            </div>
            <Turnstile siteKey={turnstileSiteKey} onToken={setTurnstileToken} />
            <button type="submit" style={styles.primaryButton} disabled={loading}>
              {loading ? "Sending…" : "Send Reset Link"} <Arrow />
            </button>
          </form>
        )}

        {(error || message) && <div style={error ? styles.error : styles.message} role={error ? "alert" : "status"}>{error || message}</div>}
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: "72px 18px 34px",
    background: "radial-gradient(circle at 50% 20%, rgba(245,181,27,.055), transparent 30%), #111111",
    color: "#f5f5f5",
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    position: "relative",
    overflowX: "hidden",
  },
  glow: {
    position: "fixed",
    inset: 0,
    pointerEvents: "none",
    background: "linear-gradient(180deg, rgba(255,255,255,.012), transparent 28%)",
  },
  logoWrap: {
    width: "100%",
    maxWidth: 500,
    height: 370,
    margin: "0 auto 0",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: "min(68vw, 330px)",
    maxHeight: 300,
    objectFit: "contain",
    display: "block",
    margin: "0 auto",
  },
  card: {
    position: "relative",
    width: "100%",
    maxWidth: 680,
    margin: "0 auto",
    padding: "28px 28px 30px",
    borderRadius: 26,
    border: "1px solid rgba(245,181,27,.36)",
    background: "#0c0c0c",
    boxShadow: "0 -10px 45px rgba(0,0,0,.24)",
  },
  passwordCard: { maxWidth: 620 },
  headerRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 18,
  },
  title: {
    margin: 0,
    fontSize: "clamp(28px, 6vw, 38px)",
    lineHeight: 1.05,
    fontWeight: 800,
    letterSpacing: "-.7px",
  },
  signupTitle: {
    margin: "0 0 16px",
    fontSize: "clamp(28px, 6vw, 36px)",
    lineHeight: 1.1,
    fontWeight: 800,
  },
  subtitle: { margin: "7px 0 0", color: "#707070", fontSize: 14 },
  centerTitle: { margin: "4px 0 10px", textAlign: "center", fontSize: "clamp(26px, 6vw, 34px)", fontWeight: 800 },
  centerText: { margin: "7px 0", color: "#858585", fontSize: 14, lineHeight: 1.5, textAlign: "center" },
  emailText: { margin: "9px 0", textAlign: "center", color: "#f5f5f5", fontSize: 15, overflowWrap: "anywhere" },
  goldLink: { border: 0, background: "transparent", color: GOLD_LIGHT, fontSize: 15, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap", padding: "6px 0" },
  circleBack: { width: 40, height: 40, borderRadius: "50%", border: "1px solid #333", background: "#141414", color: "#eee", cursor: "pointer", fontSize: 20 },
  label: { display: "block", margin: "2px 0 7px", fontSize: 12, fontWeight: 700, color: "#9a9a9a" },
  field: { minHeight: 58, marginBottom: 11, padding: "0 16px", display: "flex", alignItems: "center", borderRadius: 13, border: "1px solid #2c2c2c", background: "#17171b" },
  icon: { width: 29, height: 29, flexShrink: 0, color: GOLD_LIGHT, display: "inline-flex", alignItems: "center", justifyContent: "center", marginRight: 10 },
  input: { width: "100%", minWidth: 0, border: 0, outline: 0, background: "transparent", color: "#fff", fontSize: 16, padding: "3px 0" },
  eyeButton: { border: 0, background: "transparent", color: "#6c6c70", cursor: "pointer", padding: 5, display: "inline-flex" },
  turnstile: { minHeight: 72, display: "flex", alignItems: "center", justifyContent: "center", margin: "3px 0 5px", overflow: "hidden" },
  turnstileMissing: { minHeight: 56, display: "flex", alignItems: "center", justifyContent: "center", margin: "3px 0 9px", padding: "9px 12px", borderRadius: 12, border: "1px dashed #3b3b3b", color: "#777", fontSize: 11, textAlign: "center" },
  forgot: { display: "block", margin: "0 2px 11px auto", border: 0, background: "transparent", color: "#b77c27", fontSize: 13, cursor: "pointer" },
  primaryButton: { width: "100%", minHeight: 58, marginTop: 8, border: 0, borderRadius: 13, background: "linear-gradient(135deg, #ffbd22, #e99a00)", color: "#111", fontSize: 16, fontWeight: 850, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 9 },
  outlineButton: { width: "100%", minHeight: 54, marginTop: 10, border: "1px solid #3a3a3d", borderRadius: 13, background: "#0c0c0c", color: "#eee", fontSize: 15, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 },
  divider: { display: "flex", alignItems: "center", gap: 12, margin: "18px 0 8px", color: "#626266", fontSize: 12 },
  socialButton: { width: "100%", minHeight: 50, marginTop: 9, border: "1px solid #27272b", borderRadius: 13, background: "#1b1b20", color: "#eee", fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 9, fontWeight: 600 },
  socialGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 10 },
  globalRow: { display: "flex", alignItems: "center", gap: 9, color: "#8c8c8f", fontSize: 13, marginBottom: 17 },
  referral: { width: "100%", padding: "5px 2px 11px", border: 0, background: "transparent", color: "#d8d8d8", fontSize: 13, textAlign: "left", cursor: "pointer", display: "flex", justifyContent: "space-between" },
  agreeRow: { display: "flex", alignItems: "flex-start", gap: 8, margin: "7px 0 11px", color: "#7f7f83", fontSize: 11, lineHeight: 1.5 },
  checkbox: { width: 18, height: 18, marginTop: 1, accentColor: GOLD_LIGHT, flexShrink: 0 },
  inlineLink: { padding: 0, border: 0, background: "transparent", color: GOLD_LIGHT, cursor: "pointer", fontSize: "inherit", textDecoration: "underline" },
  otpRow: { display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 7, margin: "20px 0 13px" },
  otpBox: { width: "100%", minWidth: 0, height: 56, border: "1px solid #343438", borderRadius: 11, background: "#17171b", color: "#fff", textAlign: "center", fontSize: 22, fontWeight: 800, outline: "none" },
  resend: { display: "block", margin: "0 auto 8px", border: 0, background: "transparent", color: GOLD_LIGHT, fontSize: 12, fontWeight: 700, cursor: "pointer" },
  rules: { display: "grid", gap: 6, margin: "6px 0 14px", padding: "10px 12px", borderRadius: 12, background: "#111113", border: "1px solid #27272a" },
  rule: { display: "flex", alignItems: "center", gap: 8, color: "#99999d", fontSize: 11 },
  confirmHint: { fontSize: 11, margin: "5px 0 8px", textAlign: "center" },
  error: { marginTop: 11, padding: "10px 12px", borderRadius: 11, background: "rgba(255,70,70,.08)", border: "1px solid rgba(255,70,70,.26)", color: "#ff9d9d", fontSize: 11, lineHeight: 1.4 },
  message: { marginTop: 11, padding: "10px 12px", borderRadius: 11, background: "rgba(245,181,27,.06)", border: "1px solid rgba(245,181,27,.22)", color: "#e7bd58", fontSize: 11, lineHeight: 1.4 },
  legalWrap: { width: "100%", maxWidth: 900, margin: "0 auto" },
};

if (typeof document !== "undefined") {
  const id = "ceo-auth-inline-style";
  if (!document.getElementById(id)) {
    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
      * { box-sizing: border-box; }
      button { touch-action: manipulation; }
      button:disabled { opacity: .48; cursor: not-allowed; }
      input::placeholder { color: #68686d; }
      input, button { -webkit-tap-highlight-color: transparent; }
      @media (max-width: 520px) {
        body { overflow-x: hidden; }
      }
    `;
    document.head.appendChild(style);
  }
}
