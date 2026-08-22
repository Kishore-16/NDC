import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  ArrowRight,
  Check,
  ChevronLeft,
  Eye,
  EyeOff,
  Globe2,
  LockKeyhole,
  Menu,
  Moon,
  ShieldCheck,
  Sparkles,
  Sun,
  X,
} from 'lucide-react';
import { API_BASE_URL } from '../config';
import CrtHeroSequence from './CrtHeroSequence';

type AuthMode = 'signin' | 'signup';

interface LandingAuthProps {
  onEnterApp: (token: string) => void;
}

function WavesCanvas({ isDark }: { isDark: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;

    let frame = 0;
    let time = 0;
    const pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const target = { ...pointer };
    const colors = isDark
      ? ['rgba(104, 161, 255, .72)', 'rgba(74, 222, 200, .48)', 'rgba(167, 139, 250, .48)', 'rgba(255,255,255,.16)']
      : ['rgba(36, 99, 235, .52)', 'rgba(13, 148, 136, .34)', 'rgba(124, 58, 237, .31)', 'rgba(15,23,42,.12)'];

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * ratio;
      canvas.height = window.innerHeight * ratio;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    const move = (event: MouseEvent) => { target.x = event.clientX; target.y = event.clientY; };
    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', move);

    const draw = () => {
      time += 0.012;
      pointer.x += (target.x - pointer.x) * 0.05;
      pointer.y += (target.y - pointer.y) * 0.05;
      context.clearRect(0, 0, window.innerWidth, window.innerHeight);
      colors.forEach((color, index) => {
        context.beginPath();
        for (let x = 0; x <= window.innerWidth; x += 5) {
          const distance = Math.abs(x - pointer.x);
          const lift = Math.max(0, 1 - distance / 420) * (pointer.y - window.innerHeight / 2) * 0.11;
          const y = window.innerHeight * (0.42 + index * 0.07)
            + Math.sin(x * (0.004 + index * 0.0005) + time + index) * (46 + index * 10)
            + Math.sin(x * 0.0015 + time * 1.5) * 22 + lift;
          x === 0 ? context.moveTo(x, y) : context.lineTo(x, y);
        }
        context.strokeStyle = color;
        context.lineWidth = 1.7;
        context.shadowBlur = 24;
        context.shadowColor = color;
        context.stroke();
      });
      frame = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', resize); window.removeEventListener('mousemove', move); };
  }, [isDark]);

  return <canvas ref={canvasRef} className="waves-canvas" aria-hidden="true" />;
}

export function LandingAuth({ onEnterApp }: LandingAuthProps) {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleThemeWithTransition = (event: React.MouseEvent<HTMLButtonElement>) => {
    const root = document.documentElement;
    const rect = event.currentTarget.getBoundingClientRect();
    root.style.setProperty('--theme-reveal-x', `${rect.left + rect.width / 2}px`);
    root.style.setProperty('--theme-reveal-y', `${rect.top + rect.height / 2}px`);
    const updateTheme = () => setTheme((current) => current === 'dark' ? 'light' : 'dark');
    const documentWithTransition = document as Document & { startViewTransition?: (callback: () => void) => void };
    if (!documentWithTransition.startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      updateTheme();
      return;
    }
    documentWithTransition.startViewTransition(updateTheme);
  };

  useEffect(() => {
    document.documentElement.classList.toggle('app-light', theme === 'light');
    return () => document.documentElement.classList.remove('app-light');
  }, [theme]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('auth_token');
    const error = params.get('auth_error');
    if (token) {
      window.history.replaceState({}, '', window.location.pathname);
      onEnterApp(token);
    } else if (error) {
      setAuthMode('signin');
      setAuthError(error);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [onEnterApp]);

  const openAuth = (mode: AuthMode) => { setAuthMode(mode); setMenuOpen(false); setAuthError(''); };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setAuthError('');
    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/${authMode === 'signup' ? 'register' : 'login'}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authMode === 'signup' ? { name, email, password } : { email, password }),
      });
      const data = await response.json();
      if (!response.ok || !data.token) throw new Error(data.detail || 'Unable to sign in');
      onEnterApp(data.token);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Unable to connect to the authentication service');
    } finally { setIsSubmitting(false); }
  };

  const startGoogleSignIn = () => {
    const redirectParam = encodeURIComponent(window.location.origin);
    window.location.assign(`${API_BASE_URL}/api/auth/google?redirect_to=${redirectParam}`);
  };


  return (
    <div className={`landing-shell ${theme === 'light' ? 'light' : ''}`}>
      <WavesCanvas isDark={theme === 'dark'} />
      <header className="landing-nav">
        <button className="brand" onClick={() => setAuthMode(null)} aria-label="Nexora home"><span className="brand-mark"><ShieldCheck size={18} /></span>NEXORA</button>
        <nav className={menuOpen ? 'nav-links open' : 'nav-links'}>
          <a href="#platform" onClick={() => setMenuOpen(false)}>Platform</a>
          <a href="#security" onClick={() => setMenuOpen(false)}>Security</a>
          <button onClick={() => openAuth('signin')}>Sign in</button>
          <button className="nav-cta" onClick={() => openAuth('signup')}>Start free <ArrowRight size={15} /></button>
        </nav>
        <div className="nav-actions">
          <button className="theme-button" onClick={toggleThemeWithTransition} aria-label="Toggle color theme">
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button className="menu-button" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle navigation">{menuOpen ? <X size={20} /> : <Menu size={20} />}</button>
        </div>
      </header>

      {!authMode ? (
        <main id="platform">
          <CrtHeroSequence />
          <section className="landing-overview" id="security">
            <div className="eyebrow"><Sparkles size={14} /> Intelligent vulnerability operations</div>
            <p className="hero-copy">Nexora turns your vulnerability noise into a focused, risk-aware queue—built around the assets and threats that matter to your organisation.</p>
            <div className="hero-actions">
              <button className="primary-action" onClick={() => openAuth('signup')}>Start securing your stack <ArrowRight size={17} /></button>
              <button className="secondary-action" onClick={() => openAuth('signin')}>Open workspace</button>
            </div>
            <div className="proof-row"><span><Check size={14} /> No credit card</span><span><Check size={14} /> Setup in minutes</span><span><Check size={14} /> Built for teams</span></div>
            <section className="metric-strip">
              <div><strong>10x</strong><span>faster prioritisation</span></div><div><strong>24/7</strong><span>risk signal coverage</span></div><div><strong>1 view</strong><span>for your attack surface</span></div>
            </section>
          </section>
        </main>
      ) : (
        <main className="auth-layout">
          <button className="back-button" onClick={() => setAuthMode(null)}><ChevronLeft size={17} /> Back to overview</button>
          <section className="auth-card">
            <div className="auth-icon"><LockKeyhole size={20} /></div>
            <p className="auth-kicker">NEXORA WORKSPACE</p>
            <h1>{authMode === 'signin' ? 'Welcome back.' : 'Start with clarity.'}</h1>
            <p className="auth-description">{authMode === 'signin' ? 'Sign in to continue protecting what matters.' : 'Create your workspace and focus your security effort.'}</p>
            <form onSubmit={submit}>
              {authMode === 'signup' && <label>Full name<input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Alex Morgan" /></label>}
              <label>Work email<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" /></label>
              <label>Password <span className="label-side">{authMode === 'signin' && 'Forgot password?'}</span><div className="password-field"><input type={showPassword ? 'text' : 'password'} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" minLength={8} /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label="Show password">{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div></label>
              {authMode === 'signup' && <p className="terms">By continuing, you agree to Nexora’s Terms and Privacy Policy.</p>}
              {authError && <p className="auth-error" role="alert">{authError}</p>}
              <button className="primary-action auth-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Please wait…' : authMode === 'signin' ? 'Sign in to workspace' : 'Create free workspace'} <ArrowRight size={17} /></button>
            </form>
            <div className="auth-divider"><span>or continue with</span></div>
            <button className="oauth-button" onClick={startGoogleSignIn}><Globe2 size={18} /> Continue with Google</button>
            <p className="switch-auth">{authMode === 'signin' ? 'New to Nexora?' : 'Already have a workspace?'} <button onClick={() => setAuthMode(authMode === 'signin' ? 'signup' : 'signin')}>{authMode === 'signin' ? 'Create an account' : 'Sign in'}</button></p>
          </section>
        </main>
      )}
      <footer className="landing-footer"><span>© 2026 Nexora Security</span><span>Signal over noise.</span></footer>
    </div>
  );
}
