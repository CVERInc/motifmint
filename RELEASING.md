# Releasing `@cver/motifmint` to npm

> Prepublish checklist + the exact publish command. **The npm login and the
> `npm publish` itself are a human step** — never run by an agent, never in CI
> without an explicit decision. This doc gets you to one-command-ready.

---

## ⚠️ Read this first — current state (2026-06-16)

`motifmint` is, today, an **Astro web app** (the in-browser studio at
`oss.cver.net/motifmint/`), not a packaged library or CLI. The roadmap intends
a CLI:

```
npx @cver/motifmint input.png > out.svg        # README.md → Roadmap
```

That CLI **does not exist yet**, and `package.json` has **no `bin`, no `main`,
no `exports`, no `files`** entry point. Consequences if you `npm publish` as-is:

- The package has **no usable entry** — `require`/`import`/`npx` resolve to
  nothing. It would be an inert tarball of website source.
- With no `files` allow-list and no `.npmignore`, npm falls back to
  `.gitignore`, so the tarball ships **88 files / ~250 kB** of app internals:
  every `src/lib/*.test.ts`, `vitest.config.ts`, `tsconfig.json`,
  `Studio.svelte` (134 kB), Astro layouts, the `.github/` workflows, `HANDOFF.md`,
  `scripts/test.sh`, `hooks/pre-push`, and `public/cver-logo.png` (132 kB).

**Therefore: do NOT publish the current 0.1.0 as-is.** First decide what
`@cver/motifmint` *is* on npm (see "Before first publish" below). This doc is
ready to drive the publish the moment that's settled.

Captured `npm pack --dry-run` baseline (run this repo, working tree clean on
`main`):

```
name:          @cver/motifmint
version:       0.1.0
package size:  249.6 kB
unpacked size: 520.9 kB
total files:   88
```

---

## Before first publish — make it a real package

Pick the intended shape and wire it up (engineering work, not part of "publish"):

1. **Decide the artifact.** Per the roadmap it's a **CLI** (`npx @cver/motifmint
   input.png > out.svg` + zip-in/zip-out batch). That needs a Node trace target
   (the studio traces via `wasm_vtracer` in a browser Web Worker — a Node entry
   has to be built/verified to run headless).
2. **Add the entry point** to `package.json`:
   - `"bin": { "motifmint": "./dist-cli/cli.js" }` for the CLI (and/or `"main"`/
     `"exports"` if a library API is also exposed).
   - Make sure the referenced built file is produced by a build step and exists.
3. **Add a `files` allow-list** so the tarball ships only the artifact, e.g.:
   ```json
   "files": ["dist-cli/", "README.md", "LICENSE", "THIRD_PARTY_NOTICES.md"]
   ```
   This is the single most important hygiene fix — it stops the 88-file
   source/test dump. (A `.npmignore` is the inverse approach; prefer `files`.)
4. **Re-run `npm pack --dry-run`** and confirm the file list is *only* the
   intended artifact + docs, and the size is sane.
5. **Smoke-test the tarball locally** before any publish:
   ```bash
   npm pack                          # produces cver-motifmint-<v>.tgz
   npm i -g ./cver-motifmint-*.tgz   # or: npx ./cver-motifmint-*.tgz input.png
   motifmint --help                  # entry actually resolves & runs
   npm rm -g @cver/motifmint         # cleanup
   ```

---

## Prepublish checklist (every release)

Run on a clean `main`, in a **real terminal on Node 22** (`eval "$(fnm env)";
fnm use 22`). Note: `astro check`/`astro build` **hang in the agent sandbox** —
verify build on a real machine or via CI, never in-sandbox.

- [ ] Working tree clean, on `main`, up to date with `origin/main`.
- [ ] Entry point exists (`bin`/`main`/`exports`) and the built file is present.
- [ ] `files` allow-list present and correct (no tests/configs/source dump).
- [ ] `npm run check` — green (or via CI).
- [ ] `npm test` — green (Vitest, the in-session-safe suite).
- [ ] `npm run build` — green (real terminal / CI only).
- [ ] `version` in `package.json` bumped per semver; matches the intended tag.
- [ ] `npm pack --dry-run` reviewed — file list = artifact + docs only; size sane.
- [ ] Tarball smoke-tested (`npm pack` → install the `.tgz` → run the entry).
- [ ] `LICENSE`, `THIRD_PARTY_NOTICES.md`, `README.md` current and shipped.
- [ ] CHANGELOG / release notes drafted (if kept).

---

## The publish — HUMAN STEP ONLY

> Requires `npm login` to an account with publish rights on the `@cver` scope.
> An agent must **never** run `npm publish`. The login and the publish are the
> maintainer's decision and action.

```bash
# 1. Auth (human, interactive — one time per machine/session)
npm login                       # account must own/can-publish the @cver scope

# 2. Final dry-run sanity (safe, no upload)
npm publish --dry-run --access public

# 3. PUBLISH  ← the irreversible step (human runs this)
npm publish --access public
```

### Notes

- **`--access public` is required**: `@cver/...` is a **scoped** package and
  npm defaults scoped packages to *restricted* (private). Omitting the flag on a
  first publish errors or, worse, would attempt a private publish.
- **`latest` dist-tag** is implied. For a pre-release, publish under a tag
  instead, e.g. `npm publish --access public --tag next`, and never let an
  unfinished build claim `latest`.
- **Versions are immutable** on npm — you cannot re-publish the same version.
  Unpublish windows are narrow and discouraged. Get the dry-run right first.
- **2FA**: if the account has publish-level 2FA, npm will prompt for an OTP.
- After publish: verify with `npm view @cver/motifmint version` and a clean-room
  `npx @cver/motifmint@latest ...` from a temp dir.

---

## What an agent may / may not do

- ✅ Run `npm pack --dry-run`, edit `package.json` entry/`files`, build & test,
  write/update this doc, commit locally.
- ❌ `npm login`, `npm publish` (any form that uploads), bump-and-tag-and-push
  a release. Those are human/maintainer red lines.
