---
version: alpha
colors:
  background: "#07111F"
  surface: "#0D1B2A"
  surface-raised: "#13263A"
  primary: "#4D9EFF"
  accent: "#65D8E8"
  text: "#E7EEF7"
  muted: "#91A4BA"
  warning: "#E9B45F"
  danger: "#EA6D75"
typography:
  display:
    fontFamily: '"Noto Sans Thai", "Noto Sans", system-ui, sans-serif'
    fontSize: "2rem"
    lineHeight: 1.15
  body:
    fontFamily: '"Noto Sans Thai", "Noto Sans", system-ui, sans-serif'
    fontSize: "0.9375rem"
    lineHeight: 1.55
  data:
    fontFamily: 'ui-monospace, "SFMono-Regular", Consolas, monospace'
    fontSize: "0.875rem"
    lineHeight: 1.4
rounded:
  sm: "0.5rem"
  md: "0.875rem"
  lg: "1.125rem"
spacing:
  page: "1.5rem"
  panel: "1.25rem"
  section: "1.75rem"
components:
  status-pill:
    radius: "999px"
    fontSize: "0.6875rem"
  panel:
    background: "#0D1B2A"
    border: "1px solid #20354A"
    radius: "1.125rem"
---
## Overview

VOOM AI is the client surface for NOVA Core. Its primary audience is an operator reviewing market context, analysis availability, and system connectivity—not placing trades. This is a product interface, not a marketing landing page.

The visual reference is a precision instrument panel: a dark observatory console with restrained blue signal markings, disciplined tabular numerals, and quiet surfaces. It should feel engineered and legible during extended desktop use, while collapsing into a one-column mobile workspace.

The signature is a thin electric-blue signal rail beside the primary market workspace. It marks the current focus without implying that a market feed is live.

Anti-references: retail broker trading terminals, neon cyberpunk dashboards, green profit-first layouts, fake real-time tickers, decorative candlestick charts without verified data, and oversized KPI cards that imply account balances or returns.

## Colors

The midnight background separates the application shell from deep navy panels. Electric blue is reserved for navigation and primary focus; cyan marks neutral system information. Amber and red are reserved for warnings and errors. Do not use color alone to communicate a state: pair every state with explicit text.

## Typography

Use Noto Sans Thai / Noto Sans system fallbacks for interface copy. Use tabular monospace numerals for timestamps, symbols, identifiers, and technical values. Avoid italic styling. Thai copy must remain readable at the same hierarchy as English copy.

## Layout

Desktop uses a compact left rail, a top utility row, and a wide content column with a maximum readable width. The primary market workspace receives the largest area; system status and recent activity sit alongside or below it. Mobile removes the rail in favor of a persistent bottom navigation bar and stacks all panels in document flow. Do not lock the page to viewport height.

## Elevation & Depth

Use surface contrast and one-pixel borders rather than large shadows. The background is quiet; panels are slightly raised and separated by consistent gutters. No ambient glow or animated price decoration.

## Shapes

Use 8px controls, 14px secondary panels, and 18px primary panels. Status indicators are compact pills. Avoid excessive pill-shaped cards.

## Components

- Navigation: semantic buttons for local views; active view uses a blue edge and text label.
- Status: text-first state pills. "Not verified" means no live status source has been connected; never substitute "Online" or "Offline".
- Market workspace: show only market values backed by a connected data source. When absent, render a stable empty state.
- Analysis: distinguish an empty history from a failed request; no placeholder signal or fabricated score.
- Safety: keep "LIVE TRADING OFF" visible in the global shell. No order-entry, broker-write, deposit, or withdrawal affordances.
- Forms: retain Supabase email/password authentication and inline errors. Mask passwords and preserve email after failure.

## Do's and Don'ts

- Do show provenance and freshness next to market data when a verified feed exists.
- Do distinguish NOVA Core connectivity from MT5 Bridge connectivity.
- Do label client-provided OHLCV as unverified.
- Do keep mobile navigation reachable without covering content or the virtual keyboard.
- Don't invent equity, P/L, win rate, market prices, candles, uptime, or bridge status.
- Don't style disabled actions as available.
- Don't present Paper Simulation as a real broker account.
