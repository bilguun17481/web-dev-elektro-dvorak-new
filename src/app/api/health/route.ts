import { NextResponse } from "next/server";

/** Uptime check. Reports the build, never anything about the environment's secrets. */
export function GET() {
  return NextResponse.json({ status: "ok", at: new Date().toISOString() });
}
