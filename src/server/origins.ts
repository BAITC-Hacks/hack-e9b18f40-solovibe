/** Exact trusted origins. Loopback aliases share only the configured local port. */
export function trustedAppOrigins() {
  const configured = new URL(process.env.APP_URL || "http://localhost:3000");
  const origins = [configured.origin];
  if (["localhost", "127.0.0.1", "[::1]"].includes(configured.hostname)) {
    for (const host of ["localhost", "127.0.0.1", "[::1]"]) {
      const alias = new URL(configured); alias.hostname = host; origins.push(alias.origin);
    }
  }
  return [...new Set(origins)];
}
