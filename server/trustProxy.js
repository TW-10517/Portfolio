// How much of X-Forwarded-For to believe.
//
// Every managed host puts a reverse proxy in front of the app, so req.ip is
// the proxy's address unless Express is told otherwise — which means the rate
// limiters key every visitor to the same value. One person mistyping their
// password then locks out the whole site for fifteen minutes, and because the
// counters are persisted it survives a restart.
//
// The opposite mistake is worse, though: trusting the header unconditionally
// lets any client claim any address and walk straight past the limits. So this
// is explicit configuration rather than a guess.
//
//   TRUST_PROXY unset / 0   believe nobody (correct when the app is exposed
//                           directly, and the safe default)
//   TRUST_PROXY=1           one proxy in front — the usual PaaS setup
//   TRUST_PROXY=2           two hops, e.g. a CDN in front of the platform
//   TRUST_PROXY=loopback    Express's named presets also work
export function trustProxySetting(raw = process.env.TRUST_PROXY) {
  const value = (raw ?? "").trim();
  if (!value) return 0;
  if (/^\d+$/.test(value)) return Number(value);
  return value;
}

// Getting this wrong is silent: the app works, and the limits are simply
// wrong in one direction or the other. This says so the first time it sees
// evidence of a proxy it hasn't been told about.
export function warnOnUntrustedProxy(app) {
  let warned = false;
  return (req, res, next) => {
    if (!warned && !app.get("trust proxy") && req.headers["x-forwarded-for"]) {
      warned = true;
      console.warn(
        "[server] Requests are arriving with X-Forwarded-For but TRUST_PROXY is unset, so every visitor " +
          "shares one rate-limit bucket and one of them can lock out the rest. Set TRUST_PROXY to the " +
          "number of proxies in front of this app (usually 1)."
      );
    }
    next();
  };
}
