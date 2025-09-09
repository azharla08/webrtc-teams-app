# CSP & Render Setup Notes

This project ships with a strict Content Security Policy via Helmet in `server.js`. It already allows:
- `blob:` for dynamic module scripts / workers
- WebSocket (`wss:`/`ws:`) and HTTPS in `connect-src`
- Media (`blob:`/`data:`) and local fonts/images

## Allowing additional third‑party script origins (e.g., analytics/widget SDKs)

If your page needs to load a script from another origin (e.g., `https://infird.com`), set:

```
HELMET_EXTRA_SCRIPT_SRC=https://infird.com
HELMET_EXTRA_CONNECT_SRC=https://infird.com
```

(Comma‑separate to allow multiple origins.) These are appended to both `script-src` and `script-src-elem`, and to `connect-src` respectively. **Only add origins you trust.**

## Avoid double CSPs

`public/simple.html` contains a matching `<meta http-equiv="Content-Security-Policy">` for isolated testing. In production, rely on the response header set by Helmet. Using both is fine because they match; if you change one, keep them aligned.

## Local dev

```
CLIENT_URL=http://localhost:3000
NODE_ENV=development
```

In development, `'unsafe-eval'` may be enabled to support certain tooling; in production it is disabled.
