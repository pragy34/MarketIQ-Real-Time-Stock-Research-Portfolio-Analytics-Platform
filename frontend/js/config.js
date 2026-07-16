// Runtime config injection for Vercel.
// vercel.json's buildCommand overwrites this file at deploy time with the
// value of the MARKETLENS_API_BASE project environment variable, so the
// static frontend knows which backend (Railway/Render/Fly) to call.
//
// Local same-origin serving (FastAPI serving this frontend directly) works
// fine with the default empty string below — no build step needed.

window.MARKETLENS_API_BASE = window.MARKETLENS_API_BASE || "";
