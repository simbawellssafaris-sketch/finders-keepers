// How long a signed-in dashboard may sit unused before it signs itself out. Default 30 minutes; ADMIN_IDLE_MINUTES (1 to 240) changes it.
export function idleMinutes() {
  const n = parseInt(process.env.ADMIN_IDLE_MINUTES, 10);
  return n >= 1 && n <= 240 ? n : 30;
}

// The server's own backstop is a little longer than the page's timer, so a quiet tab is signed out by the page first
// (and logged) and a closed laptop is still caught by the server on its next request.
export const serverIdleMs = () => (idleMinutes() + 5) * 60000;

export const IDLE_COOKIE = 'fk_seen';
