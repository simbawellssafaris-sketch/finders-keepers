import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// "Still here": the dashboard calls this while someone is working. All the work happens in proxy.js
// (it refreshes the sign-in and the idle timer for every /admin request); a signed-out caller is redirected before reaching this.
export async function POST() {
  return new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
}
