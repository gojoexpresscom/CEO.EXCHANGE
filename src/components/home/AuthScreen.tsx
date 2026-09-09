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
  | "recovery-verify"
  | "password-reset-success"
  | "create-recovery-password"
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
      size?: "normal" | "compact" | "flexible";
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
        size: "flexible",
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
  const [navDir, setNavDir] = useState<"forward" | "back">("forward");
  const [pageMotion, setPageMotion] = useState(false);
  const motionTimer = useRef<number | null>(null);

  const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

  const goToScreen = (next: Screen, dir: "forward" | "back" = "forward") => {
    setNavDir(dir);
    setPageMotion(true);
    if (motionTimer.current) window.clearTimeout(motionTimer.current);
    motionTimer.current = window.setTimeout(() => {
      setScreen(next);
      setPageMotion(false);
    }, 280);
  };

  useEffect(() => {
    return () => {
      if (motionTimer.current) window.clearTimeout(motionTimer.current);
    };
  }, []);

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
    goToScreen("login", "back");
  };

  const goSignup = () => {
    clearNotice();
    resetPasswordFields();
    goToScreen("signup", "forward");
  };

  const requireTurnstile = () => {
    if (turnstileSiteKey && !turnstileToken) {
      setError("Please complete the security check.");
      return false;
    }
    return true;
  };

  const setOtpDigit = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    setOtp((prev) => {
      const chars = prev.padEnd(6, " ").split("");
      chars[index] = digit || " ";
      return chars.join("").replace(/\s+$/, "");
    });
    if (digit && index < 5) {
      document.getElementById(`ceo-otp-${index + 1}`)?.focus();
    }
  };

  const handleOtpKey = (index: number, key: string) => {
    if (key === "Backspace" && !otp[index] && index > 0) {
      document.getElementById(`ceo-otp-${index - 1}`)?.focus();
    }
  };

  useEffect(() => {
    if (screen !== "verify-signup" && screen !== "recovery-verify") return;
    setCountdown(60);
    const timer = window.setInterval(() => setCountdown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [screen]);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        clearNotice();
        resetPasswordFields();
        setNavDir("forward");
        setScreen("create-recovery-password");
      }
    });

    const params = new URLSearchParams(window.location.search);
    const referralFromUrl = params.get("ref");
    if (referralFromUrl) setReferral(referralFromUrl.trim().toUpperCase());

    if (params.get("oauth") === "1") void handleOAuthReturn();

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
      setNavDir("forward");
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
      setNavDir("forward");
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
        captchaToken: turnstileSiteKey ? turnstileToken : undefined,
      });
      if (recoveryError) throw recoveryError;

      setEmail(emailValue);
      setTurnstileToken("");
      setOtp("");
      setCountdown(60);
      setMessage(`A 6-digit code has been sent to ${emailValue}.`);
      setNavDir("forward");
      setScreen("recovery-verify");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start password recovery.");
    } finally {
      setLoading(false);
      setTurnstileToken("");
    }
  }

  async function verifyRecoveryOtp() {
    clearNotice();
    if (!/^\d{6}$/.test(otp)) return setError("Enter the 6-digit verification code.");

    setLoading(true);
    try {
      const result = await supabase.auth.verifyOtp({ email, token: otp, type: "recovery" });
      if (result.error) throw result.error;
      if (!result.data.session) throw new Error("Verification succeeded, but no session was created.");

      resetPasswordFields();
      setNavDir("forward");
        setScreen("create-recovery-password");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setLoading(false);
    }
  }

  async function resendRecovery() {
    if (countdown > 0 || loading || !email.trim()) return;
    clearNotice();
    setLoading(true);
    try {
      const { error: recoveryError } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase());
      if (recoveryError) throw recoveryError;
      setCountdown(60);
      setMessage("A new verification code has been sent.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resend the verification code.");
    } finally {
      setLoading(false);
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
      setNavDir("forward");
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
    setNavDir("forward");
    if (screen === "create-signup-password") setScreen("confirm-signup-password");
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
        setNavDir("forward");
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

  async function submitRecoveryPassword() {
    clearNotice();
    if (!validPassword(password)) {
      setError("Password must be 8–30 characters and include lowercase, uppercase, a number, and #, $ or @.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    await savePassword("recovery");
  }

  const title: Record<Screen, React.ReactNode> = {
    login: <>Welcome <span>Back</span></>,
    signup: <>Create your <span>account</span></>,
    "verify-signup": <>Verify Your <span>{signupMethod === "phone" ? "Mobile" : "Email"}</span></>,
    "create-signup-password": <>Create <span>Password</span></>,
    "confirm-signup-password": <>Confirm <span>Password</span></>,
    forgot: <>Forgot <span>Password?</span></>,
    "recovery-verify": <>Verify Your <span>Email</span></>,
    "create-recovery-password": <>Create New <span>Password</span></>,
    "oauth-password": <>Create <span>Password</span></>,
    "oauth-confirm": <>Confirm <span>Password</span></>,
  };

  const passwordCreateScreen = ["create-signup-password", "oauth-password"].includes(screen);
  const passwordConfirmScreen = ["confirm-signup-password", "oauth-confirm"].includes(screen);
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
      <div style={styles.bgBlur} />

      {(loading || pageMotion) && (
        <div style={styles.bootOverlay} aria-live="polite" aria-busy="true">
          <div style={styles.bootLogoWrap}>
            <img src="/ceo-auth-reference-transparent.png" alt="" style={styles.bootLogo} />
            <div style={styles.bootPulse} />
          </div>
          <div style={styles.bootSpinner} />
        </div>
      )}

      <div style={styles.logoWrap} className={pageMotion ? "ceo-auth-logo-dim" : "ceo-auth-logo-in"}>
        <img src="/ceo-auth-reference-transparent.png" alt="CEO Exchange" style={styles.logo} />
      </div>

      <section
        key={screen}
        className={navDir === "back" ? "ceo-auth-card ceo-auth-back" : "ceo-auth-card ceo-auth-forward"}
        style={{
          ...styles.card,
          ...(passwordScreen || screen === "create-recovery-password" ? styles.passwordCard : {}),
          opacity: pageMotion ? 0 : 1,
          pointerEvents: pageMotion ? "none" : "auto",
        }}
      >
        {screen === "login" && (
          <form onSubmit={login}>
            <div style={styles.loginHead}>
              <h1 style={styles.title}>{title.login}</h1>
              <p style={styles.subtitle}>Sign in to continue to CEO Exchange</p>
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

            <button type="submit" style={styles.primaryButton} disabled={loading}>
              {loading ? "Signing in…" : "Login Now"} <Arrow />
            </button>

            <div style={styles.divider}>
              <span style={styles.dividerLine} />
              <span style={styles.dividerText}>Or continue with</span>
              <span style={styles.dividerLine} />
            </div>

            <div style={styles.socialGrid}>
              <button type="button" style={styles.socialButton} onClick={() => void oauth("google")}>
                <GoogleIcon /> Google
              </button>
              <button type="button" style={styles.socialButton} onClick={() => void oauth("x")}>
                <XIcon /> X
              </button>
            </div>

            <button type="button" style={styles.forgotBottom} onClick={() => { clearNotice(); goToScreen("forgot", "forward"); }}>
              Forgot Password? <Arrow />
            </button>

            <button type="button" style={styles.signupHint} onClick={goSignup}>
              Don&apos;t have an account? <span style={styles.goldInline}>Sign Up</span>
            </button>
          </form>
        )}

        {screen === "signup" && (
          <>
            <div style={styles.loginHead}>
              <h1 style={styles.title}>{title.signup}</h1>
              <p style={styles.subtitle}>Create your CEO Exchange account</p>
            </div>

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

            <div style={styles.divider}>
              <span style={styles.dividerLine} />
              <span style={styles.dividerText}>Or continue with</span>
              <span style={styles.dividerLine} />
            </div>
            <div style={styles.socialGrid}>
              <button type="button" style={styles.socialButton} onClick={() => void oauth("google")}><GoogleIcon /> Google</button>
              <button type="button" style={styles.socialButton} onClick={() => void oauth("x")}><XIcon /> X</button>
            </div>

            <button type="button" style={styles.forgotBottom} onClick={goLogin}>
              Already have an account? <span style={styles.goldInline}>Login Now</span>
            </button>
          </>
        )}

        {screen === "verify-signup" && (
          <>
            <button type="button" style={styles.backText} onClick={() => goToScreen("signup", "back")} aria-label="Back">
              <Arrow left /> Back
            </button>
            <div style={styles.loginHead}>
              <h1 style={styles.title}>{title["verify-signup"]}</h1>
              <p style={styles.subtitle}>A 6-digit code was sent to</p>
              <p style={styles.emailText}>{signupMethod === "phone" ? sessionStorage.getItem("ceo_exchange_signup_identifier") || identifier : email || identifier}</p>
            </div>
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

        {screen === "recovery-verify" && (
          <>
            <button type="button" style={styles.backText} onClick={() => goToScreen("forgot", "back")} aria-label="Back">
              <Arrow left /> Back
            </button>
            <div style={styles.loginHead}>
              <h1 style={styles.title}>{title["recovery-verify"]}</h1>
              <p style={styles.subtitle}>A 6-digit code was sent to</p>
              <p style={styles.emailText}>{email}</p>
            </div>
            <div style={styles.otpRow}>
              {Array.from({ length: 6 }).map((_, index) => (
                <input key={index} id={`ceo-otp-${index}`} value={otp[index] || ""} maxLength={1} inputMode="numeric"
                  autoComplete={index === 0 ? "one-time-code" : "off"} style={styles.otpBox}
                  onChange={(e) => setOtpDigit(index, e.target.value)}
                  onKeyDown={(e) => handleOtpKey(index, e.key)}
                  aria-label={`Verification digit ${index + 1}`} />
              ))}
            </div>
            <button type="button" style={styles.resend} disabled={countdown > 0 || loading} onClick={() => void resendRecovery()}>
              {countdown > 0 ? `00:${String(countdown).padStart(2, "0")} Resend` : "Resend code"}
            </button>
            <button type="button" style={styles.primaryButton} disabled={loading} onClick={() => void verifyRecoveryOtp()}>
              {loading ? "Verifying…" : "Continue"} <Arrow />
            </button>
          </>
        )}

        {screen === "password-reset-success" && (
          <>
            <div style={styles.successIcon} aria-hidden="true">✓</div>
            <div style={styles.loginHead}>
              <h1 style={{ ...styles.title, textAlign: "center" }}>{title["password-reset-success"]}</h1>
              <p style={{ ...styles.subtitle, textAlign: "center" }}>Your password has been changed. You can log in with your new password.</p>
            </div>
            <button type="button" style={styles.primaryButton} onClick={goLogin}>Back to Login <Arrow /></button>
          </>
        )}

        {screen === "create-recovery-password" && (
          <>
            <button type="button" style={styles.backText} onClick={goLogin} aria-label="Back to login">
              <Arrow left /> Back
            </button>
            <div style={styles.loginHead}>
              <h1 style={styles.title}>{title["create-recovery-password"]}</h1>
              <p style={styles.subtitle}>Create a strong new password. This replaces your old password.</p>
            </div>

            <label style={styles.label}>New Password</label>
            <div style={styles.field}>
              <span style={styles.icon}><LockIcon /></span>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Enter new password"
                style={styles.input}
              />
              <button type="button" style={styles.eyeButton} onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Hide password" : "Show password"}>
                <Eye open={showPassword} />
              </button>
            </div>

            <div style={styles.rules}>
              {PASSWORD_RULES.map(([label, test]) => <Rule key={label} ok={test(password)}>{label}</Rule>)}
            </div>

            <label style={styles.label}>Confirm Password</label>
            <div style={styles.field}>
              <span style={styles.icon}><LockIcon /></span>
              <input
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                type={showConfirm ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Confirm new password"
                style={styles.input}
              />
              <button type="button" style={styles.eyeButton} onClick={() => setShowConfirm((v) => !v)} aria-label={showConfirm ? "Hide password" : "Show password"}>
                <Eye open={showConfirm} />
              </button>
            </div>

            <div style={{ ...styles.confirmHint, color: password === confirmPassword && confirmPassword ? "#7bd58f" : "#aaa" }}>
              {password === confirmPassword && confirmPassword ? "✓ Passwords match" : "Passwords must match"}
            </div>

            <button type="button" style={styles.primaryButton} disabled={loading} onClick={() => void submitRecoveryPassword()}>
              {loading ? "Saving…" : "Save Password & Continue"} <Arrow />
            </button>
          </>
        )}

        {passwordScreen && (
          <>
            <button
              type="button"
              style={styles.backText}
              onClick={() => goToScreen(
                passwordConfirmScreen
                  ? screen === "confirm-signup-password"
                    ? "create-signup-password"
                    : "oauth-password"
                  : passwordKind === "signup"
                    ? "verify-signup"
                    : "login",
                "back",
              )}
              aria-label="Back"
            >
              <Arrow left /> Back
            </button>

            <div style={styles.loginHead}>
              <h1 style={styles.title}>{title[screen]}</h1>
              <p style={styles.subtitle}>
                {passwordCreateScreen
                  ? "Create a strong password. Stored securely by Supabase Auth."
                  : "Enter the same password again to confirm."}
              </p>
            </div>

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
            <button type="button" style={styles.backText} onClick={goLogin} aria-label="Back to login">
              <Arrow left /> Back
            </button>
            <div style={styles.loginHead}>
              <h1 style={styles.title}>{title.forgot}</h1>
              <p style={styles.subtitle}>Enter your email and we’ll send a 6-digit code to reset your password.</p>
            </div>
            <label style={styles.label}>Email</label>
            <div style={styles.field}>
              <span style={styles.icon}><MailIcon /></span>
              <input value={identifier} onChange={(e) => setIdentifier(e.target.value)} type="email" placeholder="Enter your email" autoComplete="email" style={styles.input} />
            </div>
            <Turnstile siteKey={turnstileSiteKey} onToken={setTurnstileToken} />
            <button type="submit" style={styles.primaryButton} disabled={loading}>
              {loading ? "Sending…" : "Send Code"} <Arrow />
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
    width: "100%",
    padding: "16px 16px calc(28px + env(safe-area-inset-bottom))",
    paddingTop: "calc(16px + env(safe-area-inset-top))",
    background: "radial-gradient(ellipse at 50% 12%, rgba(245,181,27,.1) 0%, transparent 48%), #0a0a0a",
    color: "#f5f5f5",
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    position: "relative",
    overflowX: "hidden",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },
  glow: {
    position: "fixed",
    inset: 0,
    pointerEvents: "none",
    background: "linear-gradient(180deg, rgba(255,255,255,.02), transparent 32%)",
  },
  bgBlur: {
    position: "fixed",
    top: "-8%",
    left: "50%",
    transform: "translateX(-50%)",
    width: "130%",
    height: "45%",
    pointerEvents: "none",
    background: "radial-gradient(circle, rgba(245,181,27,.14) 0%, transparent 70%)",
    filter: "blur(48px)",
    opacity: 0.75,
  },
  bootOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 80,
    background: "rgba(8,8,8,.92)",
    backdropFilter: "blur(10px)",
    WebkitBackdropFilter: "blur(10px)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
  },
  bootLogoWrap: {
    position: "relative",
    width: 72,
    height: 72,
    display: "grid",
    placeItems: "center",
  },
  bootLogo: {
    width: 58,
    height: 58,
    objectFit: "contain",
    position: "relative",
    zIndex: 2,
  },
  bootPulse: {
    position: "absolute",
    inset: 0,
    borderRadius: 20,
    background: "radial-gradient(circle, rgba(245,181,27,.4) 0%, transparent 70%)",
    animation: "ceoAuthPulse 1.5s ease-in-out infinite",
  },
  bootSpinner: {
    width: 22,
    height: 22,
    borderRadius: "50%",
    border: "2px solid #2a2110",
    borderTopColor: GOLD,
    animation: "ceoAuthSpin .85s linear infinite",
  },
  logoWrap: {
    width: "100%",
    maxWidth: 440,
    height: "auto",
    margin: "0 auto 28px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  logo: {
    width: "min(58vw, 240px)",
    maxHeight: 200,
    objectFit: "contain",
    display: "block",
    margin: "0 auto",
    filter: "drop-shadow(0 16px 40px rgba(245,181,27,.28))",
  },
  card: {
    position: "relative",
    width: "100%",
    maxWidth: 400,
    margin: "0 auto",
    padding: "4px 4px 8px",
    borderRadius: 0,
    border: "none",
    background: "transparent",
    boxShadow: "none",
    flexShrink: 0,
  },
  passwordCard: { maxWidth: 400 },
  loginHead: {
    marginBottom: 22,
  },
  headerRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
  },
  title: {
    margin: 0,
    fontSize: "clamp(28px, 7vw, 34px)",
    lineHeight: 1.1,
    fontWeight: 800,
    letterSpacing: "-.6px",
    color: "#fff",
  },
  signupTitle: {
    margin: "0 0 14px",
    fontSize: "clamp(26px, 6.5vw, 32px)",
    lineHeight: 1.1,
    fontWeight: 800,
  },
  subtitle: { margin: "8px 0 0", color: "#8a8a8a", fontSize: 14 },
  centerTitle: { margin: "4px 0 8px", textAlign: "center", fontSize: "clamp(26px, 6.5vw, 32px)", fontWeight: 800 },
  centerText: { margin: "6px 0 4px", color: "#858585", fontSize: 13, lineHeight: 1.45, textAlign: "center" },
  emailText: { margin: "8px 0", textAlign: "center", color: "#f5f5f5", fontSize: 14, overflowWrap: "anywhere" },
  goldLink: { border: 0, background: "transparent", color: GOLD_LIGHT, fontSize: 14, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap", padding: "4px 0", fontWeight: 600 },
  goldInline: { color: GOLD_LIGHT, fontWeight: 700 },
  circleBack: { width: 38, height: 38, borderRadius: "50%", border: "1px solid #2e2e2e", background: "#141414", color: "#eee", cursor: "pointer", fontSize: 18, display: "grid", placeItems: "center", flexShrink: 0 },
  label: { display: "block", margin: "2px 0 8px", fontSize: 13, fontWeight: 500, color: "#9a9a9a" },
  field: { width: "100%", minHeight: 56, marginBottom: 16, padding: "0 16px", display: "flex", alignItems: "center", boxSizing: "border-box", borderRadius: 16, border: "1px solid #2a2a2a", background: "#141418" },
  icon: { width: 22, height: 22, flexShrink: 0, color: GOLD, display: "inline-flex", alignItems: "center", justifyContent: "center", marginRight: 12 },
  input: { width: "100%", minWidth: 0, border: 0, outline: 0, background: "transparent", color: "#fff", fontSize: 15, padding: "2px 0" },
  eyeButton: { border: 0, background: "transparent", color: "#6c6c70", cursor: "pointer", padding: 4, display: "inline-flex" },
  turnstile: {
    width: "100%",
    minHeight: 65,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "2px 0 18px",
    overflow: "hidden",
  },
  turnstileMissing: { minHeight: 52, display: "flex", alignItems: "center", justifyContent: "center", margin: "6px 0 12px", padding: "10px 12px", borderRadius: 14, border: "1px dashed #3b3b3b", color: "#777", fontSize: 11, textAlign: "center" },
  forgot: { display: "block", margin: "0 2px 12px auto", border: 0, background: "transparent", color: "#b77c27", fontSize: 13, cursor: "pointer", fontWeight: 500 },
  forgotBottom: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    width: "100%",
    marginTop: 20,
    border: 0,
    background: "transparent",
    color: "#8a8a8a",
    fontSize: 13,
    cursor: "pointer",
    fontWeight: 500,
  },
  backText: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    border: 0,
    background: "transparent",
    color: "#9a9a9a",
    fontSize: 14,
    cursor: "pointer",
    fontWeight: 500,
    padding: "0 0 12px",
    marginBottom: 4,
  },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: "50%",
    margin: "0 auto 16px",
    display: "grid",
    placeItems: "center",
    background: "rgba(34, 197, 94, 0.12)",
    border: "1px solid rgba(34, 197, 94, 0.35)",
    color: "#4ade80",
    fontSize: 28,
    fontWeight: 800,
  },
  signupHint: {
    display: "block",
    width: "100%",
    marginTop: 14,
    border: 0,
    background: "transparent",
    color: "#8a8a8a",
    fontSize: 13,
    cursor: "pointer",
    textAlign: "center",
  },
  primaryButton: {
    width: "100%",
    minHeight: 56,
    marginTop: 2,
    border: 0,
    borderRadius: 999,
    background: "linear-gradient(180deg, #ffc94a 0%, #e89a00 100%)",
    color: "#111",
    fontSize: 16,
    fontWeight: 800,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    boxShadow: "0 0 28px rgba(232,154,0,.35), 0 8px 20px rgba(0,0,0,.25)",
  },
  outlineButton: { width: "100%", minHeight: 50, marginTop: 8, border: "1px solid #3a3a3d", borderRadius: 14, background: "#0c0c0c", color: "#eee", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 },
  divider: { display: "flex", alignItems: "center", gap: 14, margin: "22px 0 14px", width: "100%" },
  dividerLine: { flex: 1, height: 1, background: "#2a2a2a", borderRadius: 1 },
  dividerText: { color: "#6e6e6e", fontSize: 12, fontWeight: 500, whiteSpace: "nowrap", flexShrink: 0 },
  socialButton: {
    width: "100%",
    minHeight: 50,
    marginTop: 0,
    border: "1px solid #2a2a2a",
    borderRadius: 999,
    background: "#16161a",
    color: "#eee",
    fontSize: 14,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    fontWeight: 600,
  },
  socialGrid: { display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 12 },
  globalRow: { display: "flex", alignItems: "center", gap: 8, color: "#8c8c8f", fontSize: 12, marginBottom: 12 },
  referral: { width: "100%", padding: "4px 2px 10px", border: 0, background: "transparent", color: "#d8d8d8", fontSize: 13, textAlign: "left", cursor: "pointer", display: "flex", justifyContent: "space-between" },
  agreeRow: { display: "flex", alignItems: "flex-start", gap: 8, margin: "6px 0 10px", color: "#7f7f83", fontSize: 11, lineHeight: 1.45 },
  checkbox: { width: 16, height: 16, marginTop: 1, accentColor: GOLD_LIGHT, flexShrink: 0 },
  inlineLink: { padding: 0, border: 0, background: "transparent", color: GOLD_LIGHT, cursor: "pointer", fontSize: "inherit", textDecoration: "underline" },
  otpRow: { display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6, margin: "16px 0 12px" },
  otpBox: { width: "100%", minWidth: 0, height: 48, border: "1px solid #343438", borderRadius: 10, background: "#17171b", color: "#fff", textAlign: "center", fontSize: 18, fontWeight: 800, outline: "none" },
  resend: { display: "block", margin: "0 auto 8px", border: 0, background: "transparent", color: GOLD_LIGHT, fontSize: 12, fontWeight: 700, cursor: "pointer" },
  rules: { display: "grid", gap: 5, margin: "6px 0 12px", padding: "10px 12px", borderRadius: 12, background: "#111113", border: "1px solid #27272a" },
  rule: { display: "flex", alignItems: "center", gap: 8, color: "#99999d", fontSize: 11 },
  confirmHint: { fontSize: 11, margin: "5px 0 8px", textAlign: "center" },
  error: { marginTop: 10, padding: "10px 12px", borderRadius: 11, background: "rgba(255,70,70,.08)", border: "1px solid rgba(255,70,70,.26)", color: "#ff9d9d", fontSize: 12, lineHeight: 1.4 },
  message: { marginTop: 10, padding: "10px 12px", borderRadius: 11, background: "rgba(245,181,27,.06)", border: "1px solid rgba(245,181,27,.22)", color: "#e7bd58", fontSize: 12, lineHeight: 1.4 },
  legalWrap: { width: "100%", maxWidth: 520, margin: "0 auto", padding: "8px 4px" },
};

if (typeof document !== "undefined") {
  const id = "ceo-auth-inline-style";
  let style = document.getElementById(id) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = id;
    document.head.appendChild(style);
  }
  style.textContent = `
    * { box-sizing: border-box; }
    button { touch-action: manipulation; }
    button:disabled { opacity: .48; cursor: not-allowed; }
    input::placeholder { color: #68686d; }
    input, button { -webkit-tap-highlight-color: transparent; }
    @keyframes ceoAuthSpin { to { transform: rotate(360deg); } }
    @keyframes ceoAuthPulse {
      0%, 100% { transform: scale(0.9); opacity: 0.5; }
      50% { transform: scale(1.15); opacity: 1; }
    }
    @keyframes ceoAuthForward {
      from { opacity: 0; transform: translateX(28px); }
      to { opacity: 1; transform: translateX(0); }
    }
    @keyframes ceoAuthBack {
      from { opacity: 0; transform: translateX(-28px); }
      to { opacity: 1; transform: translateX(0); }
    }
    @keyframes ceoAuthLogoIn {
      from { opacity: 0.55; transform: scale(0.96); }
      to { opacity: 1; transform: scale(1); }
    }
    .ceo-auth-card.ceo-auth-forward {
      animation: ceoAuthForward 0.38s cubic-bezier(0.22, 1, 0.36, 1) both;
    }
    .ceo-auth-card.ceo-auth-back {
      animation: ceoAuthBack 0.38s cubic-bezier(0.22, 1, 0.36, 1) both;
    }
    .ceo-auth-logo-in {
      animation: ceoAuthLogoIn 0.4s ease both;
    }
    .ceo-auth-logo-dim {
      opacity: 0.45;
      transition: opacity 0.2s ease;
    }
    .ceo-auth-card iframe {
      max-width: 100% !important;
      width: 100% !important;
    }
    .ceo-auth-card [id^="cf-turnstile"],
    .ceo-auth-card .cf-turnstile {
      width: 100% !important;
      display: flex !important;
      justify-content: center !important;
    }
    @media (max-width: 420px) {
      body { overflow-x: hidden; }
    }
  `;
}
