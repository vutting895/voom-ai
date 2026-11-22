import { useEffect, useState, type FormEvent } from "react";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type Language = "th" | "en";
type ApiResult = Record<string, unknown>;

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const apiBaseUrl = (import.meta.env.VITE_NOVA_ANALYSIS_API_BASE_URL as string | undefined)?.replace(/\/$/, "");
const supabase: SupabaseClient | null = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

const copy = {
  th: {
    subtitle: "ระบบวิเคราะห์ตลาดจาก NOVA Core",
    readonly: "READ-ONLY · LIVE TRADING OFF",
    email: "อีเมล", password: "รหัสผ่าน", signIn: "เข้าสู่ระบบ", signOut: "ออกจากระบบ",
    symbol: "Symbol", timeframe: "Timeframe", candles: "OHLCV JSON (35–500 แท่ง)",
    analyze: "วิเคราะห์", config: "ยังไม่ได้ตั้งค่า Supabase หรือ NOVA API URL",
    authRequired: "กรุณาเข้าสู่ระบบก่อนวิเคราะห์", result: "ผลการวิเคราะห์",
    paper: "Paper Simulation เท่านั้น · ไม่ส่งคำสั่งซื้อขาย",
  },
  en: {
    subtitle: "Market analysis powered by NOVA Core",
    readonly: "READ-ONLY · LIVE TRADING OFF",
    email: "Email", password: "Password", signIn: "Sign in", signOut: "Sign out",
    symbol: "Symbol", timeframe: "Timeframe", candles: "OHLCV JSON (35–500 candles)",
    analyze: "Analyze", config: "Supabase or NOVA API URL is not configured",
    authRequired: "Sign in before requesting analysis", result: "Analysis result",
    paper: "Paper Simulation only · No trade orders",
  },
} satisfies Record<Language, Record<string, string>>;

export default function App() {
  const [language, setLanguage] = useState<Language>("th");
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
    void supabase.auth.getSession().then(({ data }) => setAccessToken(data.session?.access_token ?? ""));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setAccessToken(session?.access_token ?? ""));
    return () => data.subscription.unsubscribe();
  }, []);

  async function signIn(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return setError(t.config);
    setBusy(true); setError("");
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (authError) setError(authError.message);
    setPassword("");
  }

  async function analyze(event: FormEvent) {
    event.preventDefault(); setError(""); setResult(null);
    if (!accessToken) return setError(t.authRequired);
    if (!apiBaseUrl) return setError(t.config);
    let candles: unknown;
    try { candles = JSON.parse(candlesJson); } catch { return setError("Invalid JSON"); }
    setBusy(true);
    try {
      const response = await fetch(`${apiBaseUrl}/v1/analysis/candles`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ symbol, timeframe, candles }),
      });
      const payload = await response.json() as ApiResult;
      if (!response.ok) throw new Error(String(payload.error ?? payload.message ?? `HTTP ${response.status}`));
      setResult(payload);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Analysis request failed");
    } finally { setBusy(false); }
  }

  async function signOut() {
    await supabase?.auth.signOut();
    setAccessToken(""); setResult(null);
  }

  return <main className="shell">
    <header className="topbar">
      <div className="brand"><span className="brand-mark">V</span><div><strong>VOOM AI</strong><small>POWERED BY NOVA</small></div></div>
      <div className="top-actions">
        <button className="lang" onClick={() => setLanguage(language === "th" ? "en" : "th")}>{language === "th" ? "EN" : "TH"}</button>
        {accessToken && <button className="secondary" onClick={signOut}>{t.signOut}</button>}
      </div>
    </header>
    <section className="hero">
      <div className="eyebrow">NOVA SYSTEM HUB</div>
      <h1>VOOM AI</h1><p>{t.subtitle}</p>
      <div className="status">{t.readonly}</div>
    </section>
    {!accessToken ? <section className="panel auth-panel">
      <h2>{t.signIn}</h2>
      <form onSubmit={signIn} className="stack">
        <label>{t.email}<input type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required /></label>
        <label>{t.password}<input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required /></label>
        <button className="primary" disabled={busy || !supabase}>{t.signIn}</button>
      </form>
    </section> : <section className="panel">
      <h2>{t.result}</h2>
      <form onSubmit={analyze} className="stack">
        <div className="fields">
          <label>{t.symbol}<input value={symbol} onChange={e => setSymbol(e.target.value)} required maxLength={40} /></label>
          <label>{t.timeframe}<select value={timeframe} onChange={e => setTimeframe(e.target.value)}>{["M1","M5","M15","M30","H1","H4","D1"].map(v => <option key={v}>{v}</option>)}</select></label>
        </div>
        <label>{t.candles}<textarea value={candlesJson} onChange={e => setCandlesJson(e.target.value)} rows={9} placeholder='[{"t":"2026-01-01T00:00:00Z","o":...,"h":...,"l":...,"c":...,"v":...}]' required /></label>
        <button className="primary" disabled={busy || !candlesJson.trim()}>{busy ? "…" : t.analyze}</button>
      </form>
      {result && <pre className="result">{JSON.stringify(result, null, 2)}</pre>}
    </section>}
    {error && <p className="error" role="alert">{error}</p>}
    <footer>{t.paper}<br /><span>Client-supplied OHLCV is unverified input. Analysis is informational, not a trade instruction.</span></footer>
  </main>;
}
