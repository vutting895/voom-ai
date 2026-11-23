import { useEffect, useRef, useState, type FormEvent } from "react";
import { AuthLifecycle } from "./authLifecycle.js";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type Language = "th" | "en";
type View = "dashboard" | "portfolio" | "overview" | "market" | "analysis" | "bridge";
type ApiResult = Record<string, unknown>;
type ChatMessage = { role: "user" | "assistant"; content: string };

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const supabase: SupabaseClient | null = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

const copy = {
  th: {
    subtitle: "พื้นที่ควบคุมและวิเคราะห์ตลาดจาก NOVA Core",
    liveOff: "ปิดการเทรดจริง",
    dashboard: "แดชบอร์ด", portfolio: "พอร์ตลงทุน", overview: "ระบบ", market: "ตลาด", analysis: "AI Chat", bridge: "การเชื่อมต่อ",
    workspace: "พื้นที่ทำงาน", welcome: "ภาพรวมระบบ", overviewHint: "ตรวจสอบความพร้อมของระบบก่อนเริ่มวิเคราะห์", dashboardTitle: "ภาพรวมพอร์ต", dashboardHint: "ติดตามมูลค่าพอร์ตและผลการดำเนินงานจากบัญชีที่เชื่อมต่อ", portfolioTitle: "รายละเอียดพอร์ต", portfolioHint: "ข้อมูลสินทรัพย์และสถานะการถือครองจาก MT5 Bridge", accountBalance: "Balance", equity: "Equity", floatingPnl: "กำไร/ขาดทุนลอยตัว", openPositions: "Positions ที่เปิดอยู่", totalPnl: "กำไร/ขาดทุนรวม", allocation: "สัดส่วนพอร์ต", noPortfolioData: "ยังไม่มีข้อมูลพอร์ตจากบัญชีจริง", dataNotVerified: "รอการเชื่อมต่อและยืนยันข้อมูล MT5", account: "บัญชี", asset: "สินทรัพย์", side: "ประเภท", volume: "ปริมาณ", entry: "ราคาเข้า", current: "ราคาปัจจุบัน", pnl: "P/L",
    core: "NOVA CORE", bridgeStatus: "MT5 BRIDGE", feed: "MARKET DATA", mode: "TRADING MODE",
    unverified: "ยังไม่ยืนยัน", notConnected: "ยังไม่มีข้อมูลการเชื่อมต่อ",
    readonly: "READ-ONLY", paper: "PAPER SIMULATION", off: "OFF",
    marketTitle: "ตลาดที่ติดตาม", marketHint: "ข้อมูลราคาจะแสดงเมื่อเชื่อมต่อแหล่งข้อมูลที่ตรวจสอบได้",
    symbol: "SYMBOL", waiting: "รอข้อมูลตลาด", noFeed: "ยังไม่มี Market Feed",
    analysisTitle: "NOVA AI Chat", analysisHint: "ถาม NOVA AI เพื่อค้นคว้าแนวคิดตลาด กลยุทธ์ และความเสี่ยง",
    noAnalysis: "ยังไม่มีผลวิเคราะห์", noAnalysisHint: "เริ่มสนทนาด้วยคำถามเกี่ยวกับตลาด กลยุทธ์ หรือการจัดการความเสี่ยง",
    bridgeTitle: "สถานะการเชื่อมต่อ", bridgeHint: "สถานะจะแสดงจาก Heartbeat ที่ตรวจสอบได้เท่านั้น",
    coreDesc: "ระบบวิเคราะห์หลัก", bridgeDesc: "การเชื่อมต่อ MetaTrader 5",
    activity: "กิจกรรมล่าสุด", noActivity: "ยังไม่มีกิจกรรม", safety: "ขอบเขตความปลอดภัย",
    safetyText: "หน้านี้ใช้สำหรับดูข้อมูลและวิเคราะห์เท่านั้น ไม่มีการส่งคำสั่งซื้อขายหรือแก้ไขบัญชีโบรกเกอร์",
    signIn: "เข้าสู่ระบบ", email: "อีเมล", password: "รหัสผ่าน", signOut: "ออกจากระบบ",
    config: "ยังไม่ได้ตั้งค่า Supabase", authRequired: "กรุณาเข้าสู่ระบบก่อนวิเคราะห์",
    analyze: "วิเคราะห์ข้อมูล", candles: "ข้อความหรือคำถามสำหรับ NOVA AI", timeframe: "กรอบเวลา",
    result: "ผลการวิเคราะห์", invalidJson: "รูปแบบ JSON ไม่ถูกต้อง", apiFailed: "ไม่สามารถเรียก NOVA Analysis API ได้",
    footer: "VOOM AI · Powered by NOVA", language: "EN",
  },
  en: {
    subtitle: "Market intelligence workspace powered by NOVA Core",
    liveOff: "LIVE TRADING OFF",
    dashboard: "Dashboard", portfolio: "Portfolio", overview: "System", market: "Markets", analysis: "AI Chat", bridge: "Connections",
    workspace: "WORKSPACE", welcome: "System overview", overviewHint: "Check system readiness before requesting analysis", dashboardTitle: "Portfolio dashboard", dashboardHint: "Monitor account value and performance from connected accounts", portfolioTitle: "Portfolio details", portfolioHint: "Assets and open positions reported by the MT5 Bridge", accountBalance: "Balance", equity: "Equity", floatingPnl: "Floating P/L", openPositions: "Open positions", totalPnl: "Total P/L", allocation: "Portfolio allocation", noPortfolioData: "No live portfolio data is available", dataNotVerified: "Waiting for verified MT5 connection data", account: "Account", asset: "Asset", side: "Side", volume: "Volume", entry: "Entry price", current: "Current price", pnl: "P/L",
    core: "NOVA CORE", bridgeStatus: "MT5 BRIDGE", feed: "MARKET DATA", mode: "TRADING MODE",
    unverified: "Not verified", notConnected: "No connection data available",
    readonly: "READ-ONLY", paper: "PAPER SIMULATION", off: "OFF",
    marketTitle: "Watchlist", marketHint: "Prices appear only after a verifiable market source is connected",
    symbol: "SYMBOL", waiting: "Awaiting market data", noFeed: "No market feed connected",
    analysisTitle: "NOVA AI Chat", analysisHint: "Ask NOVA AI about market research, strategy ideas, and risk",
    noAnalysis: "No analysis yet", noAnalysisHint: "Start with a question about markets, strategy, or risk management",
    bridgeTitle: "Connection status", bridgeHint: "Status is shown only from a verifiable heartbeat",
    coreDesc: "Analysis engine", bridgeDesc: "MetaTrader 5 connection",
    activity: "Recent activity", noActivity: "No activity recorded", safety: "Safety boundary",
    safetyText: "This workspace is for monitoring and analysis only. It cannot submit trades or modify broker accounts.",
    signIn: "Sign in", email: "Email", password: "Password", signOut: "Sign out",
    config: "Supabase is not configured", authRequired: "Sign in before requesting analysis",
    analyze: "Analyze data", candles: "Message or research question", timeframe: "Timeframe",
    result: "Analysis result", invalidJson: "Invalid JSON format", apiFailed: "NOVA Analysis API request failed",
    footer: "VOOM AI · Powered by NOVA", language: "TH",
  },
} satisfies Record<Language, Record<string, string>>;

const nav: { id: View; icon: string }[] = [
  { id: "dashboard", icon: "▦" },
  { id: "portfolio", icon: "◈" },
  { id: "analysis", icon: "⌗" },
  { id: "market", icon: "⌁" },
  { id: "overview", icon: "◫" },
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
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [result, setResult] = useState<ApiResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const chatAbortRef = useRef<AbortController | null>(null);
  const authLifecycleRef = useRef(new AuthLifecycle());
  const t = copy[language];

  useEffect(() => {
    if (!supabase) return;
    const initialSnapshot = authLifecycleRef.current.snapshot();
    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      // A late initial-session lookup must not overwrite a newer auth event.
      if (!authLifecycleRef.current.isCurrent(initialSnapshot)) return;
      if (sessionError) setError(language === "th" ? "ไม่สามารถกู้คืนสถานะการเข้าสู่ระบบได้" : "Unable to restore the sign-in session");
      authLifecycleRef.current.setUserId(data.session?.user.id ?? null);
      setAccessToken(data.session?.access_token ?? "");
    }).catch(() => {
      if (authLifecycleRef.current.isCurrent(initialSnapshot)) {
        setError(language === "th" ? "ไม่สามารถเชื่อมต่อ Supabase Auth ได้" : "Unable to connect to Supabase Auth");
      }
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      const nextUserId = session?.user.id ?? null;
      if (authLifecycleRef.current.setUserId(nextUserId)) {
        // Account changes invalidate all in-flight chat work and user-scoped UI state.
        chatAbortRef.current?.abort();
        chatAbortRef.current = null;
        setBusy(false);
        setResult(null);
        setChatMessages([]);
        setChatInput("");
        setError("");
      }
      // A successful sign-out event must reset navigation as well as auth state.
      // Otherwise the next sign-in can reopen the previous user's last view.
      if (event === "SIGNED_OUT") setView("overview");
      setAccessToken(session?.access_token ?? "");
    });
    return () => {
      data.subscription.unsubscribe();
      authLifecycleRef.current.invalidate();
      chatAbortRef.current?.abort();
    };
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
    event.preventDefault();
    setError("");
    setResult(null);
    if (!accessToken) { setError(t.authRequired); return; }
    const prompt = chatInput.trim();
    if (!prompt) return;
    if (prompt.length > 1200) {
      setError(language === "th" ? "ข้อความยาวเกิน 1,200 ตัวอักษร" : "Message exceeds 1,200 characters");
      return;
    }
    const requestMessages = [...chatMessages, { role: "user" as const, content: prompt }].slice(-8);
    if (requestMessages.reduce((total, item) => total + item.content.length, 0) > 8000) {
      setError(language === "th" ? "ประวัติการสนทนามีขนาดใหญ่เกินไป" : "Conversation is too large");
      return;
    }
    setBusy(true);
    const requestSnapshot = authLifecycleRef.current.snapshot();
    chatAbortRef.current?.abort();
    const controller = new AbortController();
    chatAbortRef.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ messages: requestMessages }),
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
          ? `NOVA AI ส่งข้อมูลที่ไม่ใช่ JSON (HTTP ${response.status})`
          : `NOVA AI returned non-JSON content (HTTP ${response.status})`);
      }
      if (!response.ok) {
        const code = typeof payload.error === "string" ? payload.error : `HTTP ${response.status}`;
        throw new Error(language === "th" ? `NOVA AI ปฏิเสธคำขอ: ${code}` : `NOVA AI rejected the request: ${code}`);
      }
      if (typeof payload.message !== "string" || !payload.message.trim()) {
        throw new Error(language === "th" ? "NOVA AI ไม่ได้ส่งข้อความตอบกลับที่ถูกต้อง" : "NOVA AI returned an invalid message");
      }
      if (!authLifecycleRef.current.isCurrent(requestSnapshot)) return;
      setChatMessages([...requestMessages, { role: "assistant" as const, content: payload.message }].slice(-8));
      setResult(payload);
      setChatInput("");
    } catch (cause) {
      if (chatAbortRef.current === controller &&
          authLifecycleRef.current.isCurrent(requestSnapshot)) {
        setError(cause instanceof DOMException && cause.name === "AbortError"
          ? (language === "th" ? "หมดเวลารอ NOVA AI (15 วินาที)" : "NOVA AI timed out (15 seconds)")
          : cause instanceof Error ? cause.message : t.apiFailed);
      }
    } finally {
      window.clearTimeout(timeout);
      if (chatAbortRef.current === controller) {
        chatAbortRef.current = null;
        if (authLifecycleRef.current.isCurrent(requestSnapshot)) setBusy(false);
      }
    }
  }

  async function signOut() {
    const signOutSnapshot = authLifecycleRef.current.signOut();
    chatAbortRef.current?.abort();
    chatAbortRef.current = null;
    setBusy(false);
    let remoteSignOutFailed = false;
    if (supabase) {
      try {
        const { error: signOutError } = await supabase.auth.signOut();
        remoteSignOutFailed = Boolean(signOutError);
      } catch {
        remoteSignOutFailed = true;
      }
      if (remoteSignOutFailed) {
        // Clear this device's persisted session even when the remote revoke is unavailable.
        try { await supabase.auth.signOut({ scope: "local" }); } catch { /* local UI state is cleared below */ }
      }
    }
    // Do not let a slow sign-out response clear a newer sign-in session.
    if (!authLifecycleRef.current.isCurrent(signOutSnapshot)) return;
    setAccessToken("");
    setResult(null);
    setChatMessages([]);
    setChatInput("");
    setView("overview");
    setError(remoteSignOutFailed
      ? (language === "th" ? "ล้าง Session ในอุปกรณ์แล้ว แต่ยืนยันการออกจากระบบกับ Supabase ไม่ได้" : "Local session cleared; remote sign-out could not be confirmed")
      : "");
  }

  function content() {
    if (view === "dashboard") return <div className="portfolio-page">
      <section className="panel portfolio-hero"><div><span className="eyebrow">{t.workspace}</span><h2>{t.dashboardTitle}</h2><p>{t.dashboardHint}</p></div><StatusTag tone="warning">{t.dataNotVerified}</StatusTag></section>
      <section className="portfolio-metrics" aria-label={t.dashboardTitle}>
        {[t.accountBalance, t.equity, t.floatingPnl, t.openPositions, t.totalPnl].map(label => <article className="portfolio-metric" key={label}><span>{label}</span><strong>—</strong><small>{t.unverified}</small></article>)}
      </section>
      <section className="panel portfolio-section"><div className="section-heading"><div><span className="eyebrow">{t.account}</span><h2>{t.allocation}</h2><p>{t.dataNotVerified}</p></div><StatusTag>{t.unverified}</StatusTag></div>
        <div className="portfolio-empty"><span className="empty-icon">◈</span><strong>{t.noPortfolioData}</strong><p>{t.dataNotVerified}</p><button className="text-button" onClick={() => setView("portfolio")}>{t.portfolio} ↗</button></div>
      </section>
    </div>;

    if (view === "portfolio") return <div className="portfolio-page">
      <section className="panel portfolio-hero"><div><span className="eyebrow">{t.workspace}</span><h2>{t.portfolioTitle}</h2><p>{t.portfolioHint}</p></div><StatusTag tone="warning">{t.unverified}</StatusTag></section>
      <section className="panel portfolio-section"><div className="section-heading"><div><span className="eyebrow">{t.account}</span><h2>{t.openPositions}</h2><p>{t.dataNotVerified}</p></div><StatusTag>{t.unverified}</StatusTag></div>
        <div className="portfolio-table-wrap"><table className="portfolio-table"><thead><tr><th>{t.asset}</th><th>{t.side}</th><th>{t.volume}</th><th>{t.entry}</th><th>{t.current}</th><th>{t.pnl}</th></tr></thead><tbody><tr><td colSpan={6} className="portfolio-no-data">{t.noPortfolioData}</td></tr></tbody></table></div>
      </section>
      <section className="portfolio-metrics portfolio-summary">{[t.accountBalance, t.equity, t.floatingPnl, t.totalPnl].map(label => <article className="portfolio-metric" key={label}><span>{label}</span><strong>—</strong><small>{t.unverified}</small></article>)}</section>
    </div>;


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
      <div className="chat-thread" role="log" aria-live="polite" aria-label={t.analysisTitle}>
        {chatMessages.length === 0
          ? <div className="empty-inline"><span className="empty-icon">⌗</span><strong>{t.noAnalysis}</strong><p>{t.noAnalysisHint}</p></div>
          : chatMessages.map((message, index) => <article className={message.role === "user" ? "chat-message chat-user" : "chat-message chat-assistant"} key={`${index}-${message.role}`}>
              <span>{message.role === "user" ? (language === "th" ? "คุณ" : "You") : "NOVA AI"}</span>
              <p>{message.content}</p>
            </article>)}
      </div>
      <form className="analysis-form" onSubmit={analyze} noValidate>
        <label>{t.candles}<textarea value={chatInput} onChange={e => setChatInput(e.target.value)} rows={4} maxLength={1200} placeholder={language === "th" ? "ถามเกี่ยวกับตลาด กลยุทธ์ หรือความเสี่ยง..." : "Ask about markets, research, strategy, or risk..."} /></label>
        <div className="form-actions"><span>{language === "th" ? "NOVA AI Research · คำตอบเพื่อการศึกษาเท่านั้น · ไม่มีคำสั่งซื้อขาย" : "NOVA AI Research · Informational only · No trade execution"}</span><button className="button-primary" disabled={busy || !chatInput.trim()}>{busy ? (language === "th" ? "กำลังตอบ..." : "Thinking...") : t.analyze}</button></div>
      </form>
      {error && <p className="inline-error" role="alert">{error}</p>}
      {result && <p className="response-meta">{String(result.provider ?? "NOVA AI")} · {String(result.model ?? "Research")} · Live Trading OFF</p>}
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
