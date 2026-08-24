// Ports and URLs shared by playwright.config.js and the specs, so a spec can
// never talk to the developer's own server by hardcoding a port.
export const API_PORT = 4001;
export const WEB_PORT = 5174;
export const API_ORIGIN = `http://localhost:${API_PORT}`;
export const API_BASE = `${API_ORIGIN}/api`;
export const WEB_ORIGIN = `http://localhost:${WEB_PORT}`;
