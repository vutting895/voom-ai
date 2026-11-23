import { useEffect, useState, type FormEvent } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type Language = "th" | "en";
type View = "overview" | "market" | "analysis" | "bridge";
type ApiResult = Record<string, unknown>;

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const apiBaseUrl = (import.meta.env.VITE_NOVA_ANALYSIS_API_BASE_URL as string | undefined)?.replace(/\/$/, "");
const supabase: SupabaseClient | null = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

const copy = {
  th: {
    subtitle: "พื้นที่ควบคุมและวิเคราะห์ตลาดจาก NOVA Core",
    liveOff: "ปิดการเทรดจริง",
    overview: "ภาพรวม", market: "ตลาด", analysis: "ผลวิเคราะห์", bridge: "การเชื่อมต่อ",
    workspace: "พื้นที่ทำงาน", welcome: "ภาพรวมระบบ", overviewHint: "ตรวจสอบความพร้อมของระบบก่อนเริ่มวิเคราะห์",
    core: "NOVA CORE", bridgeStatus: "MT5 BRIDGE", feed: "MARKET DATA", mode: "TRADING MODE",
    unverified: "ยังไม่ยืนยัน", notConnected: "ยังไม่มีข้อมูลการเชื่อมต่อ",
    readonly: "READ-ONLY", paper: "PAPER SIMULATION", off: "OFF",
    marketTitle: "ตลาดที่ติดตาม", marketHint: "ข้อมูลราคาจะแสดงเมื่อเชื่อมต่อแหล่งข้อมูลที่ตรวจสอบได้",
    symbol: "SYMBOL", waiting: "รอข้อมูลตลาด", noFeed: "ยังไม่มี Market Feed",
    analysisTitle: "การวิเคราะห์ล่าสุด", analysisHint: "ผลวิเคราะห์จะปรากฏเมื่อ NOVA API ส่งข้อมูลกลับมา",
    noAnalysis: "ยังไม่มีผลวิเคราะห์", noAnalysisHint: "เชื่อมต่อ NOVA Core และส่งข้อมูล OHLCV ที่ต้องการวิเคราะห์",
    bridgeTitle: "สถานะการเชื่อมต่อ", bridgeHint: "สถานะจะแสดงจาก Heartbeat ที่ตรวจสอบได้เท่านั้น",
    coreDesc: "ระบบวิเคราะห์หลัก", bridgeDesc: "การเชื่อมต่อ MetaTrader 5",
    activity: "กิจกรรมล่าสุด", noActivity: "ยังไม่มีกิจกรรม", safety: "ขอบเขตความปลอดภัย",
    safetyText: "หน้านี้ใช้สำหรับดูข้อมูลและวิเคราะห์เท่านั้น ไม่มีการส่งคำสั่งซื้อขายหรือแก้ไขบัญชีโบรกเกอร์",
    signIn: "เข้าสู่ระบบ", email: "อีเมล", password: "รหัสผ่าน", signOut: "ออกจากระบบ",
    config: "ยังไม่ได้ตั้งค่า Supabase หรือ NOVA API URL", authRequired: "กรุณาเข้าสู่ระบบก่อนวิเคราะห์",
    analyze: "วิเคราะห์ข้อมูล", candles: "ข้อมูล OHLCV JSON", timeframe: "กรอบเวลา",
    result: "ผลการวิเคราะห์", invalidJson: "รูปแบบ JSON ไม่ถูกต้อง", apiFailed: "ไม่สามารถเรียก NOVA Analysis API ได้",
    footer: "VOOM AI · Powered by NOVA", language: "EN",
  },
  en: {
    subtitle: "Market intelligence workspace powered by NOVA Core",
    liveOff: "LIVE TRADING OFF",
    overview: "Overview", market: "Markets", analysis: "Analysis", bridge: "Connections",
    workspace: "WORKSPACE", welcome: "System overview", overviewHint: "Check system readiness before requesting analysis",
    core: "NOVA CORE", bridgeStatus: "MT5 BRIDGE", feed: "MARKET DATA", mode: "TRADING MODE",
    unverified: "Not verified", notConnected: "No connection data available",
    readonly: "READ-ONLY", paper: "PAPER SIMULATION", off: "OFF",
    marketTitle: "Watchlist", marketHint: "Prices appear only after a verifiable market source is connected",
    symbol: "SYMBOL", waiting: "Awaiting market data", noFeed: "No market feed connected",
    analysisTitle: "Latest analysis", analysisHint: "Analysis appears when NOVA API returns verified response data",
    noAnalysis: "No analysis yet", noAnalysisHint: "Connect NOVA Core and provide OHLCV data to analyze",
    bridgeTitle: "Connection status", bridgeHint: "Status is shown only from a verifiable heartbeat",
    coreDesc: "Analysis engine", bridgeDesc: "MetaTrader 5 connection",
    activity: "Recent activity", noActivity: "No activity recorded", safety: "Safety boundary",
    safetyText: "This workspace is for monitoring and analysis only. It cannot submit trades or modify broker accounts.",
    signIn: "Sign in", email: "Email", password: "Password", signOut: "Sign out",
    config: "Supabase or NOVA API URL is not configured", authRequired: "Sign in before requesting analysis",
    analyze: "Analyze data", candles: "OHLCV JSON data", timeframe: "Timeframe",
    result: "Analysis result", invalidJson: "Invalid JSON format", apiFailed: "NOVA Analysis API request failed",
    footer: "VOOM AI · Powered by NOVA", language: "TH",
  },
} satisfies Record<Language, Record<string, string>>;

const nav: { id: View; icon: string }[] = [
  { id: "overview", icon: "◫" },
  { id: "market", icon: "⌁" },
  { id: "analysis", icon: "⌗" },
  { id: "bridge", icon: "⇄" },
];

function Brand() {
  return <div className="brand">
    <span className="brand-mark" aria-hidden="true">V</span>
    <span className="brand-copy"><strong>VOOM AI</strong><small>POWERED BY NOVA</small></span>
  </div>;
}

function StatusTag({ children, tone = "muted" }: { children: string; tone?: "muted" | "info" | "warning" }) {
  return <span className={`status-tag status-${tone}`}><i aria-hidden="true" />{children}</span>;
}

export default function App() {
  const [language, setLanguage] = useState<Language>("th");
  const [view, setView] = useState<View>("overview");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [symbol, setSymbol] = useState("XAUUSDm");
  const [timeframe, setTimeframe] = useState("H1");
  const [candlesJson, setCandlesJson] = useState("");
  const [result, setResult] = useState<ApiResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const t = copy[language];

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (sessionError) setError(language === "th" ? "ไม่สามารถกู้คืนสถานะการเข้าสู่ระบบได้" : "Unable to restore the sign-in session");
      setAccessToken(data.session?.access_token ?? "");
    }).catch(() => {
      setError(language === "th" ? "ไม่สามารถเชื่อมต่อ Supabase Auth ได้" : "Unable to connect to Supabase Auth");
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setAccessToken(session?.access_token ?? ""));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    document.title = `VOOM AI · ${t.overview}`;
  }, [t.overview]);

  async function signIn(event: FormEvent) {
    event.preventDefault();
    if (!supabase) { setError(t.config); return; }
    setBusy(true); setError("");
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) {
        setError(language === "th" ? "เข้าสู่ระบบไม่สำเร็จ โปรดตรวจสอบอีเมลและรหัสผ่าน" : "Sign-in failed. Check your email and password.");
        return;
      }
      setPassword("");
    } catch {
      setError(language === "th" ? "เชื่อมต่อ Supabase Auth ไม่สำเร็จ" : "Could not reach Supabase Auth");
    } finally {
      setBusy(false);
    }
  }

  async function analyze(event: FormEvent) {
    event.preventDefault(); setError(""); setResult(null);
    if (!accessToken) { setError(t.authRequired); return; }
    if (!apiBaseUrl) { setError(t.config); return; }
    if (!/^[A-Za-z0-9._-]{1,40}$/.test(symbol)) {
      setError(language === "th" ? "รูปแบบ Symbol ไม่ถูกต้อง" : "Invalid symbol format");
      return;
    }
    if (candlesJson.length > 250_000) {
      setError(language === "th" ? "ข้อมูลมีขนาดใหญ่เกินไป (สูงสุด 250 KB)" : "Payload is too large (250 KB maximum)");
      return;
    }
    let candles: unknown;
    try { candles = JSON.parse(candlesJson); } catch { setError(t.invalidJson); return; }
    if (!Array.isArray(candles) || candles.length < 35 || candles.length > 500) {
      setError(language === "th" ? "ต้องส่งข้อมูลแท่งเทียน 35–500 แท่ง" : "Provide between 35 and 500 candles");
      return;
    }
    const validCandles = candles.every((item: unknown) => {
      if (typeof item !== "object" || item === null || Array.isArray(item)) return false;
      const candle = item as Record<string, unknown>;
      const values = [candle.o, candle.h, candle.l, candle.c, candle.v];
      return typeof candle.t === "string"
        && Number.isFinite(Date.parse(candle.t))
        && values.every(value => typeof value === "number" && Number.isFinite(value))
        && (candle.h as number) >= Math.max(candle.o as number, candle.c as number)
        && (candle.l as number) <= Math.min(candle.o as number, candle.c as number)
        && (candle.h as number) >= (candle.l as number)
        && (candle.v as number) >= 0;
    });
    if (!validCandles) {
      setError(language === "th" ? "ข้อมูล OHLCV ไม่ถูกต้อง: ต้องมี t, o, h, l, c, v และค่าต้องสมเหตุสมผล" : "Invalid OHLCV data: require valid t, o, h, l, c, v values");
      return;
    }
    setBusy(true);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(`${apiBaseUrl}/v1/analysis/candles`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ symbol, timeframe, candles }),
        signal: controller.signal,
      });
      const responseText = await response.text();
      let payload: ApiResult;
      try {
        const decoded: unknown = responseText.length ? JSON.parse(responseText) : {};
        if (typeof decoded !== "object" || decoded === null || Array.isArray(decoded)) {
          throw new Error("Unexpected response shape");
        }
        payload = decoded as ApiResult;
      } catch {
        throw new Error(language === "th"
          ? `NOVA API ส่งข้อมูลที่ไม่ใช่ JSON (HTTP ${response.status}) โปรดตรวจสอบ API URL และ Reverse Proxy`
          : `NOVA API returned non-JSON content (HTTP ${response.status}). Check the API URL and reverse proxy.`);
      }
      if (!response.ok) {
        throw new Error(language === "th"
          ? `NOVA API ปฏิเสธคำขอ (HTTP ${response.status})`
          : `NOVA API rejected the request (HTTP ${response.status})`);
      }
      setResult(payload);
    } catch (cause) {
      setError(cause instanceof DOMException && cause.name === "AbortError"
        ? (language === "th" ? "หมดเวลารอ NOVA API (15 วินาที)" : "NOVA API timed out (15 seconds)")
        : cause instanceof Error ? cause.message : t.apiFailed);
    } finally {
      window.clearTimeout(timeout);
      setBusy(false);
    }
  }

  async function signOut() {
    try {
      const { error: signOutError } = await supabase?.auth.signOut() ?? {};
      if (signOutError) {
        setError(language === "th" ? "ออกจากระบบไม่สำเร็จ" : "Sign-out failed");
        return;
      }
      setAccessToken("");
      setResult(null);
      setView("overview");
      setError("");
    } catch {
      setError(language === "th" ? "ไม่สามารถติดต่อ Supabase เพื่อออกจากระบบได้" : "Could not reach Supabase to sign out");
    }
  }

  function content() {
    if (view === "market") return <section className="panel market-panel">
      <div className="section-heading"><div><span className="eyebrow">{t.workspace}</span><h2>{t.marketTitle}</h2><p>{t.marketHint}</p></div><StatusTag>{t.unverified}</StatusTag></div>
      <div className="market-empty">
        <div className="market-glyph" aria-hidden="true">⌁</div>
        <strong>{t.noFeed}</strong><span>{t.waiting}</span>
        <div className="symbol-chip"><span>{t.symbol}</span><b>XAUUSDm</b><StatusTag>{t.unverified}</StatusTag></div>
      </div>
    </section>;

    if (view === "analysis") return <section className="panel">
      <div className="section-heading"><div><span className="eyebrow">{t.workspace}</span><h2>{t.analysisTitle}</h2><p>{t.analysisHint}</p></div></div>
      <form className="analysis-form" onSubmit={analyze} noValidate>
        <div className="form-grid">
          <label>{t.symbol}<input value={symbol} onChange={e => setSymbol(e.target.value)} maxLength={40} /></label>
          <label>{t.timeframe}<select value={timeframe} onChange={e => setTimeframe(e.target.value)}>{["M1","M5","M15","M30","H1","H4","D1"].map(v => <option key={v}>{v}</option>)}</select></label>
        </div>
        <label>{t.candles}<textarea value={candlesJson} onChange={e => setCandlesJson(e.target.value)} rows={7} placeholder='[{"t":"2026-01-01T00:00:00Z","o":...,"h":...,"l":...,"c":...,"v":...}]' /></label>
        <div className="form-actions"><span>{language === "th" ? "ข้อมูลจากผู้ใช้ยังไม่ถือเป็นข้อมูลที่ Broker ยืนยัน" : "User-provided data is not broker-verified"}</span><button className="button-primary" disabled={busy || !candlesJson.trim()}>{busy ? (language === "th" ? "กำลังวิเคราะห์…" : "Analyzing…") : t.analyze}</button></div>
      </form>
      {error && <p className="inline-error" role="alert">{error}</p>}
      {result && <div className="result-block"><h3>{t.result}</h3><pre>{JSON.stringify(result, null, 2)}</pre></div>}
      {!result && !error && <div className="empty-inline"><span className="empty-icon">⌗</span><strong>{t.noAnalysis}</strong><p>{t.noAnalysisHint}</p></div>}
    </section>;

    if (view === "bridge") return <section className="panel">
      <div className="section-heading"><div><span className="eyebrow">{t.workspace}</span><h2>{t.bridgeTitle}</h2><p>{t.bridgeHint}</p></div></div>
      <div className="connection-list">
        <div className="connection-row"><span className="connection-icon">N</span><div><strong>NOVA Core</strong><small>{t.coreDesc}</small></div><StatusTag>{t.unverified}</StatusTag></div>
        <div className="connection-row"><span className="connection-icon">M</span><div><strong>MT5 Bridge</strong><small>{t.bridgeDesc}</small></div><StatusTag>{t.unverified}</StatusTag></div>
      </div>
      <div className="notice"><b>{t.notConnected}</b><span>{t.bridgeHint}</span></div>
    </section>;

    return <div className="dashboard-grid">
      <section className="panel welcome-panel">
        <div className="signal-rail" aria-hidden="true"><span /></div>
        <div className="welcome-copy"><span className="eyebrow">{t.workspace}</span><h2>{t.welcome}</h2><p>{t.overviewHint}</p></div>
        <div className="welcome-status"><span>{t.mode}</span><strong>{t.readonly}</strong><StatusTag tone="warning">{t.liveOff}</StatusTag></div>
      </section>
      <section className="status-grid" aria-label={t.bridgeTitle}>
        <article className="status-card"><div className="card-top"><span>{t.core}</span><span className="mini-icon">N</span></div><strong className="status-value">{t.unverified}</strong><p>{t.notConnected}</p><StatusTag>{t.unverified}</StatusTag></article>
        <article className="status-card"><div className="card-top"><span>{t.bridgeStatus}</span><span className="mini-icon">M</span></div><strong className="status-value">{t.unverified}</strong><p>{t.bridgeDesc}</p><StatusTag>{t.unverified}</StatusTag></article>
        <article className="status-card"><div className="card-top"><span>{t.feed}</span><span className="mini-icon">⌁</span></div><strong className="status-value">{t.unverified}</strong><p>{t.marketHint}</p><StatusTag>{t.unverified}</StatusTag></article>
      </section>
      <section className="panel market-panel">
        <div className="section-heading"><div><span className="eyebrow">{t.workspace}</span><h2>{t.marketTitle}</h2><p>{t.marketHint}</p></div><button className="text-button" onClick={() => setView("market")}>{t.market} ↗</button></div>
        <div className="market-empty compact">
          <div className="market-glyph" aria-hidden="true">⌁</div><strong>{t.noFeed}</strong><span>{t.waiting}</span>
          <div className="symbol-chip"><span>{t.symbol}</span><b>XAUUSDm</b><StatusTag>{t.unverified}</StatusTag></div>
        </div>
      </section>
      <section className="panel side-panel">
        <div className="section-heading"><div><span className="eyebrow">{t.workspace}</span><h2>{t.activity}</h2></div></div>
        <div className="activity-empty"><span className="activity-mark">—</span><strong>{t.noActivity}</strong><p>{t.noAnalysisHint}</p></div>
        <div className="safety-note"><span className="safety-mark">i</span><div><strong>{t.safety}</strong><p>{t.safetyText}</p></div></div>
      </section>
    </div>;
  }

  if (!accessToken) return <main className="auth-shell">
    <div className="auth-brand"><Brand /><StatusTag tone="warning">{t.liveOff}</StatusTag></div>
    <section className="auth-card">
      <span className="eyebrow">NOVA SYSTEM HUB</span><h1>{t.signIn}</h1>
      <p>{t.subtitle}</p>
      <form className="auth-form" onSubmit={signIn} noValidate>
        <label>{t.email}<input type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required /></label>
        <label>{t.password}<input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required /></label>
        {!supabase && <p className="inline-error">{t.config}</p>}
        {error && <p className="inline-error" role="alert">{error}</p>}
        <button className="button-primary" disabled={busy || !supabase}>{busy ? "…" : t.signIn}</button>
      </form>
      <div className="auth-foot">{t.safetyText}</div>
    </section>
    <footer className="app-footer">{t.footer}</footer>
  </main>;

  return <div className="app-shell">
    <aside className="sidebar">
      <Brand />
      <div className="sidebar-label">{t.workspace}</div>
      <nav className="side-nav" aria-label={t.workspace}>
        {nav.map(item => <button key={item.id} className={view === item.id ? "nav-item active" : "nav-item"} onClick={() => { setView(item.id); setError(""); }} aria-current={view === item.id ? "page" : undefined}><span className="nav-icon" aria-hidden="true">{item.icon}</span><span>{t[item.id]}</span></button>)}
      </nav>
      <div className="sidebar-bottom"><StatusTag tone="warning">{t.liveOff}</StatusTag><small>v0.1 · READ-ONLY</small></div>
    </aside>
    <main className="main-area">
      <header className="topbar">
        <div><span className="eyebrow">{t.workspace}</span><h1>{t[view]}</h1></div>
        <div className="top-actions"><span className="user-label">{email || "NOVA User"}</span><button className="utility-button" onClick={() => setLanguage(language === "th" ? "en" : "th")} aria-label="Change language">{t.language}</button><button className="utility-button" onClick={signOut}>{t.signOut}</button></div>
      </header>
      <div className="page-content">{content()}</div>
      <footer className="main-footer"><span>{t.footer}</span><span>{t.readonly} · {t.paper}</span></footer>
    </main>
    <nav className="mobile-nav" aria-label={t.workspace}>
      {nav.map(item => <button key={item.id} className={view === item.id ? "mobile-nav-item active" : "mobile-nav-item"} onClick={() => { setView(item.id); setError(""); }} aria-current={view === item.id ? "page" : undefined}><span aria-hidden="true">{item.icon}</span><small>{t[item.id]}</small></button>)}
    </nav>
  </div>;
}
