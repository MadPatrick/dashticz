# AGENTS.md

Instructions for AI coding agents working in this repository.

## Remotes

- `origin` — the maintainer's own fork.
- `upstream` — the official org repo, which the maintainer has push access to. `beta` tracks `upstream/beta`.

## Testing external fork branches before merging into `beta`

Contributors' forks get evaluated via a throwaway integration branch before touching `beta` itself, so conflicts or regressions surface safely:

1. `git fetch upstream`, then `git checkout -b beta-integration-<name> upstream/beta` (or `beta` if the base should include not-yet-upstreamed work already on `beta`).
2. `git remote add <name> <fork-url>` and fetch it.
3. Inspect the actual commit(s)/diff before merging. A fork's raw diff against current `beta` can look enormous if its base is stale — check `git log --oneline beta..<remote>/<branch>` and `git show --stat` per commit to see what it *actually* changes, rather than trusting the full diffstat.
4. For small, self-contained changes, a quick read-through is enough. For large multi-commit forks (e.g. a full dependency/build-system modernization), or when non-conflicting deletions could silently drop content (e.g. a `.gitignore` line removed by one side reappearing generated/personal files), flag it and ask before proceeding rather than guessing.
5. After merging, sanity-check with `npm install`, `npm run build`, and `npm test`.
6. Once approved, merge the integration branch into `beta` and do the release bookkeeping below as part of that same change.

## Release bookkeeping — required before every push to `beta`

Every commit destined for `beta` must include:

- Bump `version.txt`'s `version` field and add a matching `changelog` entry.
- Mirror the same version in `package.json`'s `version` field (a test enforces these stay in sync).
- Regenerate `package-lock.json` if `package.json` changed (`npm install --package-lock-only`).
- Add a corresponding dated entry under "Recent changes" in `docs/releasenotes/releasenotes.rst`, following the existing per-version header + `Enhancements`/`Fixes`/`Code` section style.

Do this as a standing step of any push-bound change — don't wait to be asked.

## Pushing

Pushing requires the `gh` CLI authenticated as the maintainer, or a git credential helper for `https://github.com`. If neither is configured in the current environment, don't retry `git push` expecting it to work — leave the push to the user (e.g. via their editor's Source Control panel or their own terminal).

## Known outstanding issues

- `vendor/dashticz/garbage/index.php`: the `curlGetJson()` helper (added for the HVC waste-collection provider) unconditionally disables `CURLOPT_SSL_VERIFYPEER`, unlike the rest of the file, which only disables SSL verification when the user opts in via `?ignoressl=1`. Left as-is per maintainer decision — flag it again if touching this file.

## Cursor Cloud specific instructions

Dashticz is a browser dashboard served as static files plus PHP endpoints (config writer, calendar/CORS proxies). There is no Node app server. Standard commands live in `package.json` scripts and the `README.md` "Development checks" section.

- Startup dependency refresh is handled by the update script (`npm ci`). PHP 8.3 CLI (`php`, `php-curl`, `php-mbstring`, `php-xml`) is a system dependency required to run the app and its endpoints; it is provided by the VM snapshot, not the update script.
- Run the dev app with the PHP built-in server from the repo root: `php -S 0.0.0.0:8082` (there is no `index.php`, so `/` serves `index.html`). The Docker/Makefile path (`make start`, nginx + php-fpm) is for production-style hosting and is not needed for local dev.
- The PHP built-in server is single-threaded: a request that proxies to an unreachable Domoticz/remote host can block other requests. Prefer it only for dev/testing.
- First-run wizard: it appears only when `custom/CONFIG.js` is missing or contains exactly `#EMPTY#`. `custom/` is gitignored, so create `custom/CONFIG.js` with `#EMPTY#` to exercise the wizard. Saving the wizard writes a real `custom/CONFIG.js` via `js/savesettings.php` (CSRF token from `info.php?get=csrf`); a live Domoticz is not required to save, only to render device data.
- `npm test` (`node --test`) validates JS syntax and PHP source/security patterns by reading files as text — it does NOT execute PHP, so it passes without the app running. As of environment setup, one test (`modern dark theme is portable and documented`) fails on a missing CSS selector assertion; this is a pre-existing content mismatch, unrelated to environment setup.
- `npm run format` is Prettier in `--write` mode (auto-format), not a CI lint gate; many committed files are intentionally not Prettier-clean, so a `--check` run reports warnings.
- `npm run build` (webpack) regenerates `dist/bundle.*` into the tracked bundle and emits size/deprecation warnings only; a clean checkout rebuilds to identical output (no git diff).
