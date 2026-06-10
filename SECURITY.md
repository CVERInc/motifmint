# Security Policy

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security reports.

Email: `security@cver.net` with a description of the issue, reproduction
steps, and (if possible) a proof-of-concept.

We aim to acknowledge reports within **3 business days** and to ship a fix
within **30 days** of acknowledgement for confirmed vulnerabilities.

## Threat model

`motifmint` is a static, client-side web application. There is no server
component, no authentication, and no user data is transmitted. The threat
surface is therefore narrow but not zero:

### In scope

- **Output SVG XSS** — the trace output is rendered via `{@html ...}` into the
  preview panel. Although VTracer's output is structurally a flat shape graph
  (no embedded scripts, no foreign content), any path by which a crafted
  input image could induce an `<script>` / `<foreignObject>` injection in the
  output would be a security bug.
- **WASM / dependency RCE** — vulnerabilities in `wasm_vtracer`, `svgo`,
  Astro, or Svelte that affect a static deployment.
- **Self-hosted instance compromise** — supply-chain risks in the npm
  install path (e.g., a malicious transitive dependency).

### Out of scope

- DoS via extremely large input images (the browser tab will hit memory
  limits and crash — this is expected for client-side software).
- SVG bombs in user input (we don't parse user-supplied SVG; we only
  generate it).
- Issues that require physical access to the user's device.

## Supported versions

Only the `main` branch (latest release) receives security fixes. We do not
back-port to older tagged releases.
