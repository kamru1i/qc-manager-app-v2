# Releasing QC Manager

Read this before you bump a version or push a tag. The release path spans **two repositories**
and one URL that can never change, and getting the order wrong can permanently break updates
for every installed app.

## Why there are two repositories

| Repository | Visibility | Holds |
| --- | --- | --- |
| `bnfcorporate/qc-manager-app` | **private** | source code, CI, this document |
| `bnfcorporate/qc-manager-releases` | **public** | release binaries only, no source |

The desktop auto-updater and the in-app Android updater download binaries **with no
credentials**. A private repository's release assets return `HTTP 404` to them, so binaries
cannot live in the source repo. They are published to the public releases repo instead.

## The URL that can never change

```
https://chuti.bnfcorporate.com/updater/latest.json
```

Every desktop build compiles this URL into its binary (`src-tauri/tauri.conf.json`). An app
already installed on someone's machine can never be told a different one — it will poll this
exact address for the rest of its life.

**Never change this URL.** To move where binaries are stored, edit `UPSTREAM` in
[`src/app/updater/latest.json/route.ts`](../src/app/updater/latest.json/route.ts); the public
address stays put and every installed app follows automatically.

This is why the URL is on a B&F domain rather than pointing straight at GitHub: the storage
backend can be replaced without stranding anyone. It was moved here from
`github.com/kamru1i/qc-manager-app/...` precisely because a hardcoded GitHub URL made the
project unable to leave that account without abandoning its users.

## Keep the three version numbers identical

Three files carry the version, and **nothing syncs them automatically**:

| File | Drives |
| --- | --- |
| `package.json` | release tag, `latest.json` version, Android `versionName` |
| `src-tauri/tauri.conf.json` | installer filenames, and the version the running app reports |
| `src-tauri/Cargo.toml` | Rust crate version |

If `package.json` says `8.0.1` but `tauri.conf.json` still says `8.0.0`, the published manifest
advertises 8.0.1 while the installed binary keeps reporting 8.0.0. The updater compares the two,
sees a newer version, installs it, restarts, and finds 8.0.0 again — **an update loop with no
way out for the user**. Always use:

```bash
npm run version:sync      # copy package.json's version into the other two
npm run version:check     # fail if they disagree (CI runs this first)
```

The `verify` job runs `version:check` before any paid macOS or Windows runner starts.

## Cutting a release

```bash
node scripts/sync-version.js 8.0.1    # sets all three files
git commit -am "chore: release v8.0.1"
git push                              # ① Vercel deploys the website
git tag v8.0.1 && git push --tags     # ② GitHub Actions builds and publishes
```

**Steps ① and ② are independent, and ① lands first.** Vercel's production branch is `main`, so
the website advertises v8.0.1 the moment the commit lands — before the binaries exist. Download
links 404 during that window. Keep it short: push the tag straight after the commit, and if the
build fails, revert the version commit rather than leaving the site pointing at nothing.

The build publishes to the **public releases repo**, selected by `RELEASE_REPO` and
`RELEASE_REPO_TOKEN` in the workflow. `GITHUB_TOKEN` cannot write to another repository, which
is why the separate token exists.

## Required secrets

`bnfcorporate/qc-manager-app` → Settings → Secrets and variables → Actions:

| Secret | Purpose |
| --- | --- |
| `RELEASE_REPO_TOKEN` | writes releases to the public releases repo |
| `TAURI_SIGNING_PRIVATE_KEY` + `_PASSWORD` | signs desktop updates |
| `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` | signs the APK |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_API_BASE_URL` | build-time config |

`TAURI_SIGNING_PRIVATE_KEY` must keep matching the `pubkey` in `src-tauri/tauri.conf.json`.
Generating a new key makes every installed app reject every future update, and the only remedy
is asking each user to reinstall by hand. Never regenerate it.

There is also a GitHub Environment named `prod` holding copies of these secrets. No job declares
`environment:`, so those copies are inert — the repository-level secrets are the live ones.

## Database migrations are not automatic

`supabase/migrations/` is applied by hand with the Supabase CLI. Pushing code does **not** run
migrations. If a release needs a schema change, apply it first:

```bash
supabase db push     # ① schema
git push             # ② code
```

Reversing this order deploys code that queries columns which do not exist yet, and users see
runtime errors against the live database.

## Relationship to the original repository

This project began as `kamru1i/qc-manager-app`, which is still public and still holds the
release history. Builds shipped before the endpoint migration poll **that** repository for
updates and can only be moved across by one transition release published there.

**Do not delete that repository or its releases.** A user who opens an old build months from now
still looks there, and it is their only route onto the current update channel.
