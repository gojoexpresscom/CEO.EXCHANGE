import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'

type Screen = 'login' | 'signup' | 'verify-signup' | 'create-signup-password' | 'confirm-signup-password' | 'forgot' | 'verify-recovery' | 'create-recovery-password' | 'confirm-recovery-password' | 'oauth-password' | 'oauth-confirm'

type Props = { onAuth: () => void }

type TurnstileWindow = Window & { turnstile?: { render: (el: HTMLElement, opts: { sitekey: string; callback: (token: string) => void; 'expired-callback'?: () => void; 'error-callback'?: () => void; theme?: 'dark' }) => string; reset: (id?: string) => void } }

declare const window: TurnstileWindow

const TEMP_PASSWORD = () => `${crypto.randomUUID()}Aa1!x` 
const PASSWORD_RULES = [
  ['8-30 Characters', (p: string) => p.length >= 8 && p.length <= 30],
  ['At least one lowercase letter', (p: string) => /[a-z]/.test(p)],
  ['At least one uppercase letter', (p: string) => /[A-Z]/.test(p)],
  ['At least one number', (p: string) => /\d/.test(p)],
  ['At least one special character', (p: string) => /[^A-Za-z0-9]/.test(p)],
] as const

function validPassword(password: string) { return PASSWORD_RULES.every(([, test]) => test(password)) }

export default function AuthScreen({ onAuth }: Props) {
  const [screen, setScreen] = useState<Screen>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [referral, setReferral] = useState('')
  const [showReferral, setShowReferral] = useState(false)
  const [countdown, setCountdown] = useState(56)
  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const [legal, setLegal] = useState<{ terms?: { content: string; version: number }; privacy?: { content: string; version: number } }>({})
  const captchaRef = useRef<HTMLDivElement>(null)
  const captchaId = useRef<string>()
  const pendingOAuth = useRef(false)

  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined

  useEffect(() => {
    fetchLegal()
    const params = new URLSearchParams(window.location.search)
    if (params.get('oauth') === '1') handleOAuthReturn()
  }, [])

  useEffect(() => {
    if (!['login', 'signup', 'forgot'].includes(screen)) return
    if (!siteKey || !captchaRef.current) return
    const render = () => {
      if (!window.turnstile || !captchaRef.current) return
      captchaRef.current.innerHTML = ''
      captchaId.current = window.turnstile.render(captchaRef.current, {
        sitekey: siteKey,
        theme: 'dark',
        callback: (token) => setCaptchaToken(token),
        'expired-callback': () => setCaptchaToken(null),
        'error-callback': () => setCaptchaToken(null),
      })
    }
    if (window.turnstile) render()
    else {
      const script = document.createElement('script')
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
      script.async = true
      script.defer = true
      script.onload = render
      document.head.appendChild(script)
    }
    return () => { if (captchaRef.current) captchaRef.current.innerHTML = '' }
  }, [screen, siteKey])

  useEffect(() => {
    if (!['verify-signup', 'verify-recovery'].includes(screen)) return
    setCountdown(56)
    const timer = window.setInterval(() => setCountdown(v => v > 0 ? v - 1 : 0), 1000)
    return () => window.clearInterval(timer)
  }, [screen])

  async function fetchLegal() {
    const { data } = await supabase.from('legal_documents').select('document_type,content,version').in('document_type', ['terms_of_service', 'privacy_policy'])
    const next: typeof legal = {}
    for (const row of data ?? []) {
      if (row.document_type === 'terms_of_service') next.terms = { content: row.content, version: row.version }
      if (row.document_type === 'privacy_policy') next.privacy = { content: row.content, version: row.version }
    }
    setLegal(next)
  }

  function clearStatus() { setError(''); setMessage('') }
  function back(to: Screen = 'login') { clearStatus(); setPassword(''); setConfirmPassword(''); setOtp(['','','','','','']); setScreen(to) }
  function requireCaptcha() { if (!siteKey) return true; if (!captchaToken) { setError('Please complete the security check.'); return false } return true }
  function resetCaptcha() { setCaptchaToken(null); if (captchaId.current && window.turnstile) window.turnstile.reset(captchaId.current) }

  async function login(e: FormEvent) {
    e.preventDefault(); clearStatus()
    if (!email.trim() || !password) return setError('Enter your email and password.')
    if (!requireCaptcha()) return
    setLoading(true)
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password, ...(captchaToken ? { options: { captchaToken } } : {}) } as any)
    resetCaptcha(); setLoading(false)
    if (error) return setError(error.message)
    if (data.session) onAuth()
  }

  async function signupStart(e: FormEvent) {
    e.preventDefault(); clearStatus()
    if (!email.trim() || !email.includes('@')) return setError('Enter a valid email address.')
    if (!termsAccepted) return setError('Please accept the Terms of Service and Privacy Policy.')
    if (!requireCaptcha()) return
    setLoading(true)
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password: TEMP_PASSWORD(),
      options: { captchaToken: captchaToken ?? undefined, data: { referral_code: referral.trim() || null } },
    })
    resetCaptcha(); setLoading(false)
    if (error) return setError(error.message)
    if (!data.user) return setError('Unable to create the account.')
    setScreen('verify-signup')
    setMessage(`A 6-digit code has been sent to ${email.trim()}`)
  }

  async function verifySignup() {
    clearStatus(); const code = otp.join('')
    if (code.length !== 6) return setError('Enter the full 6-digit code.')
    setLoading(true)
    const { data, error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code, type: 'signup' })
    setLoading(false)
    if (error) return setError(error.message)
    if (!data.session) return setError('Verification succeeded, but no session was created. Check Confirm Email settings.')
    setScreen('create-signup-password')
  }

  async function resendSignup() {
    if (countdown > 0) return
    clearStatus(); setLoading(true)
    const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim() })
    setLoading(false)
    if (error) return setError(error.message)
    setCountdown(56); setMessage('A new verification code was sent.')
  }

  async function finishPassword(kind: 'signup' | 'recovery' | 'oauth') {
    clearStatus()
    if (!validPassword(password)) return setError('Password does not meet all requirements.')
    if (password !== confirmPassword) return setError('Passwords do not match.')
    setLoading(true)
    const { data, error } = await supabase.auth.updateUser({ password })
    if (error) { setLoading(false); return setError(error.message) }
    if (kind === 'signup') {
      const user = data.user
      if (user) {
        const version = legal.terms?.version ?? 2
        const { error: termsError } = await supabase.from('terms_acceptances').insert({ user_id: user.id, document_version: version })
        if (termsError) { setLoading(false); return setError(`Account created, but terms acceptance was not recorded: ${termsError.message}`) }
      }
    }
    setLoading(false); onAuth()
  }

  async function forgotStart(e: FormEvent) {
    e.preventDefault(); clearStatus()
    if (!email.trim() || !email.includes('@')) return setError('Enter a valid email address.')
    if (!requireCaptcha()) return
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin, ...(captchaToken ? { captchaToken } : {}) } as any)
    resetCaptcha(); setLoading(false)
    if (error) return setError(error.message)
    setScreen('verify-recovery')
    setMessage('If an account exists for this email, a 6-digit recovery code has been sent.')
  }

  async function verifyRecovery() {
    clearStatus(); const code = otp.join('')
    if (code.length !== 6) return setError('Enter the full 6-digit code.')
    setLoading(true)
    const { data, error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code, type: 'recovery' })
    setLoading(false)
    if (error) return setError(error.message)
    if (!data.session) return setError('Recovery verification did not create a session.')
    setScreen('create-recovery-password')
  }

  async function resendRecovery() {
    if (countdown > 0) return
    clearStatus(); setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin } as any)
    setLoading(false)
    if (error) return setError(error.message)
    setCountdown(56); setMessage('A new recovery code was requested.')
  }

  async function oauth(provider: 'google' | 'x') {
    clearStatus(); pendingOAuth.current = true; sessionStorage.setItem('ceo_oauth_started', '1')
    const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: `${window.location.origin}/?oauth=1` } })
    if (error) { pendingOAuth.current = false; sessionStorage.removeItem('ceo_oauth_started'); setError(error.message) }
  }

  async function handleOAuthReturn() {
    const started = sessionStorage.getItem('ceo_oauth_started') === '1'
    if (!started) return
    sessionStorage.removeItem('ceo_oauth_started')
    const { data } = await supabase.auth.getSession()
    if (!data.session) return
    const user = data.session.user
    const age = Date.now() - new Date(user.created_at).getTime()
    const passwordSet = user.user_metadata?.password_initialized === true
    if (age < 10 * 60 * 1000 && !passwordSet) setScreen('oauth-password')
    else onAuth()
  }

  function setOtpDigit(index: number, value: string) {
    const digit = value.replace(/\D/g, '').slice(-1)
    const next = [...otp]; next[index] = digit; setOtp(next)
    if (digit && index < 5) document.getElementById(`otp-${index + 1}`)?.focus()
  }

  const title = useMemo(() => ({
    'login': 'Welcome Back', 'signup': <>Create your <span>account</span></>, 'verify-signup': <>Verify Your <span>Email</span></>,
    'create-signup-password': 'Create Password', 'confirm-signup-password': 'Confirm Password', 'forgot': 'Forgot Password?',
    'verify-recovery': <>Verify Your <span>Password Reset</span></>, 'create-recovery-password': 'Create New Password',
    'confirm-recovery-password': 'Confirm New Password', 'oauth-password': 'Create Password', 'oauth-confirm': 'Confirm Password'
  } as Record<Screen, React.ReactNode>)[screen], [screen])

  const passwordScreen = ['create-signup-password','confirm-signup-password','create-recovery-password','confirm-recovery-password','oauth-password','oauth-confirm'].includes(screen)
  const isConfirm = ['confirm-signup-password','confirm-recovery-password','oauth-confirm'].includes(screen)

  function goPasswordNext() {
    if (!validPassword(password)) return setError('Password does not meet all requirements.')
    setError(''); setScreen(screen === 'create-signup-password' ? 'confirm-signup-password' : screen === 'create-recovery-password' ? 'confirm-recovery-password' : 'oauth-confirm')
  }

  return <div className="auth-page">
    <div className="auth-glow" />
    <header className="brand"><img src="/ceo-auth-reference.svg" alt="CEO Exchange" /></header>
    <section className={`auth-card ${passwordScreen ? 'password-card' : ''}`}>
      {screen === 'login' && <>
        <div className="card-head"><div><h1>{title}</h1><p>Sign in to continue</p></div><button className="link-button" onClick={() => back('signup')}>Sign Up <b>›</b></button></div>
        <form onSubmit={login}>
          <label className="field"><span className="icon">✉</span><input value={email} onChange={e=>setEmail(e.target.value)} type="email" placeholder="Enter your email" autoComplete="email"/></label>
          <label className="field"><span className="icon">♙</span><input value={password} onChange={e=>setPassword(e.target.value)} type={showPassword?'text':'password'} placeholder="Enter your password" autoComplete="current-password"/><button type="button" className="eye" onClick={()=>setShowPassword(v=>!v)}>{showPassword?'◉':'◌'}</button></label>
          <div className="captcha-row"><div ref={captchaRef} className="turnstile" />{!siteKey && <span className="captcha-note">Turnstile key required</span>}</div>
          <button type="button" className="forgot-link" onClick={()=>{clearStatus();setScreen('forgot')}}>Forgot Password?</button>
          <button className="gold-button" disabled={loading}>{loading?'Please wait…':'Login Now  ›'}</button>
        </form>
        <button className="outline-button passkey" onClick={async()=>{clearStatus();setLoading(true);const {data,error}=await supabase.auth.signInWithPasskey();setLoading(false);if(error)setError(error.message);else if(data.session)onAuth()}}>{loading?'Working…':'♙  Login with Passkey'}</button>
        <div className="divider"><span>Or continue with</span></div>
        <div className="socials"><button onClick={()=>oauth('google')}><b className="google">G</b>Continue with Google</button><button onClick={()=>oauth('x')}><b>𝕏</b>Continue with X (Twitter)</button></div>
      </>}

      {screen === 'signup' && <>
        <div className="top-row"><button className="back-button" onClick={()=>back('login')}>←</button><button className="link-button" onClick={()=>back('login')}>Login Now</button></div>
        <h1>{title}</h1><p className="sub">CEO Exchange Global　⇄</p>
        <form onSubmit={signupStart}>
          <label className="label">Email / Mobile Number</label>
          <label className="field"><span className="icon">♙</span><input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Enter email/mobile (without code)" autoComplete="email"/></label>
          <button type="button" className="referral-toggle" onClick={()=>setShowReferral(v=>!v)}>Referral Code (Optional)　⌄</button>
          {showReferral && <input className="simple-input" value={referral} onChange={e=>setReferral(e.target.value)} placeholder="Enter referral code"/>}
          <label className="terms"><input type="checkbox" checked={termsAccepted} onChange={e=>setTermsAccepted(e.target.checked)}/><span>I have read and agree to the CEO Exchange<br/><a onClick={()=>legal.terms&&alert(legal.terms.content)}>Terms of Service</a> and <a onClick={()=>legal.privacy&&alert(legal.privacy.content)}>Privacy Policy</a></span></label>
          <div className="captcha-row"><div ref={captchaRef} className="turnstile" /></div>
          <button className="gold-button" disabled={loading}>{loading?'Creating…':'Create Account  →'}</button>
        </form>
        <div className="divider"><span>OR</span></div><p className="or-label">Or Sign Up With</p>
        <div className="socials two"><button onClick={()=>oauth('google')}><b className="google">G</b>Google</button><button onClick={()=>oauth('x')}><b>𝕏</b>X (Twitter)</button></div>
      </>}

      {(screen === 'verify-signup' || screen === 'verify-recovery') && <>
        <div className="top-row"><button className="back-button" onClick={()=>back(screen==='verify-signup'?'signup':'forgot')}>←</button></div>
        <h1>{title}</h1><p className="verify-copy">A 6-digit code has been sent to:<br/><strong>{email}</strong>　<button className="modify" onClick={()=>back(screen==='verify-signup'?'signup':'forgot')}>✎ Modify</button></p>
        <p className="hint">Your verification code is valid for five (5) minutes.</p>
        <div className="otp-row">{otp.map((v,i)=><input key={i} id={`otp-${i}`} value={v} onChange={e=>setOtpDigit(i,e.target.value)} inputMode="numeric" maxLength={1}/>)}</div>
        <button className="resend" disabled={countdown>0||loading} onClick={screen==='verify-signup'?resendSignup:resendRecovery}>◷　<span>{countdown>0?`00:${String(countdown).padStart(2,'0')}`:'Resend'}</span></button>
        <button className="gold-button" onClick={screen==='verify-signup'?verifySignup:verifyRecovery} disabled={loading}>{loading?'Verifying…':'Continue  →'}</button>
        <p className="didnt">ⓘ　Didn't receive email</p>
      </>}

      {passwordScreen && <>
        <div className="top-row"><button className="back-button" onClick={()=>back(screen.startsWith('create-signup')||screen.startsWith('confirm-signup')?'verify-signup':screen.startsWith('oauth')?'login':'verify-recovery')}>←</button></div>
        <h1>{title}</h1><p className="sub">{isConfirm?'Re-enter your password to confirm.':'Set a login password to complete your sign-up.'}</p>
        <label className="field"><input value={isConfirm?confirmPassword:password} onChange={e=>isConfirm?setConfirmPassword(e.target.value):setPassword(e.target.value)} type={showPassword?'text':'password'} placeholder="" autoComplete="new-password"/><button type="button" className="eye" onClick={()=>setShowPassword(v=>!v)}>{showPassword?'◉':'◌'}</button></label>
        {!isConfirm && <div className="rules">{PASSWORD_RULES.map(([label,test])=><div key={label} className={test(password)?'ok':''}>◉　{label}</div>)}</div>}
        <button className="gold-button" onClick={()=>isConfirm?finishPassword(screen.includes('signup')?'signup':screen.includes('recovery')?'recovery':'oauth'):goPasswordNext()} disabled={loading}>{loading?'Saving…':isConfirm?'Sign Up Now':'Continue  →'}</button>
      </>}

      {screen === 'forgot' && <>
        <div className="top-row"><button className="back-button" onClick={()=>back('login')}>←</button></div><h1>{title}</h1><p className="sub">Enter your email and we'll send a secure 6-digit recovery code.</p>
        <form onSubmit={forgotStart}><label className="field"><span className="icon">✉</span><input value={email} onChange={e=>setEmail(e.target.value)} type="email" placeholder="Enter your email" autoComplete="email"/></label><div className="captcha-row"><div ref={captchaRef} className="turnstile" /></div><button className="gold-button" disabled={loading}>{loading?'Sending…':'Send Recovery Code  →'}</button></form>
      </>}

      {error && <div className="status error">{error}</div>}
      {message && <div className="status success">{message}</div>}
    </section>
  </div>
}
