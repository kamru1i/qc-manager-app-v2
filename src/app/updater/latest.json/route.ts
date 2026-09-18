import { NextResponse } from "next/server";

/**
 * Update manifest endpoint: https://chuti.bnfcorporate.com/updater/latest.json
 *
 * Every shipped desktop build bakes this URL into its binary (src-tauri/tauri.conf.json)
 * and can never be told a new one, so this path must keep working forever. To move where
 * binaries are stored, change UPSTREAM here — never the public URL.
 *
 * Source code lives in the private repo bnfcorporate/qc-manager-app; its release assets
 * would 404 for the unauthenticated updater, so binaries are published to the public repo
 * bnfcorporate/qc-manager-releases and this route proxies its manifest.
 */
const UPSTREAM =
  "https://github.com/bnfcorporate/qc-manager-releases/releases/latest/download/latest.json";

// Proxied (not redirected) so we control CORS: the Android WebView fetches this
// cross-origin, and GitHub's asset CDN makes no CORS guarantees.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
} as const;

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const upstream = await fetch(UPSTREAM, { redirect: "follow", cache: "no-store" });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: "manifest_unavailable", upstreamStatus: upstream.status },
        { status: 502, headers: CORS },
      );
    }

    const manifest = await upstream.json();

    return NextResponse.json(manifest, {
      headers: { ...CORS, "Cache-Control": "public, max-age=60, s-maxage=60" },
    });
  } catch {
    // Returning 502 rather than a stale/empty manifest: the Tauri updater treats a failed
    // fetch as "no update available" and retries later, which is the safe outcome.
    return NextResponse.json({ error: "manifest_fetch_failed" }, { status: 502, headers: CORS });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
