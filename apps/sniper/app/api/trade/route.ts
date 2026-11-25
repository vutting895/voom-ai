import { NextResponse } from "next/server";

/**
 * Sniper is an analysis and signal-screening component.
 * Broker execution is intentionally unavailable in this application boundary.
 */
function executionDisabled() {
  return NextResponse.json(
    {
      accepted: false,
      mode: "DISABLED",
      code: "SNIPER_EXECUTION_DISABLED",
      message: "No order was sent. Sniper provides analysis only; broker execution is not available.",
    },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}

export const dynamic = "force-dynamic";
export async function GET() {
  return executionDisabled();
}
export async function POST() {
  return executionDisabled();
}
export async function PUT() {
  return executionDisabled();
}
export async function PATCH() {
  return executionDisabled();
}
export async function DELETE() {
  return executionDisabled();
}
