"""
Prepare Tauri signing key from GitHub Actions secrets.

Reads RAW_KEY and RAW_PASS environment variables (set by the workflow),
decodes the base64 key, and exports TAURI_SIGNING_PRIVATE_KEY and
TAURI_SIGNING_PRIVATE_KEY_PASSWORD into GITHUB_ENV for subsequent steps.
"""
import os
import sys
import base64

def main():
    raw_key = os.environ.get("RAW_KEY", "")
    raw_pass = os.environ.get("RAW_PASS", "")

    if not raw_key:
        print("ERROR: RAW_KEY environment variable is not set or empty.")
        sys.exit(1)

    if not raw_pass:
        print("WARNING: RAW_PASS environment variable is not set or empty.")

    # Tauri base64-decodes TAURI_SIGNING_PRIVATE_KEY itself, so what it needs is VALID base64 —
    # not the decoded key. Both failures on v8.0.2 were this misunderstanding from opposite sides:
    #   "Invalid padding"              — base64 stored without its trailing "=" characters
    #   "Invalid symbol 32, offset 9"  — the space in "untrusted comment:", i.e. plain text
    # So normalise whatever is stored into padded base64, and prove it decodes to a real key
    # before handing it to a 10x runner.
    def looks_like_key(text):
        return text.startswith("untrusted comment:") or "BEGIN" in text

    if looks_like_key(raw_key):
        signing_key = base64.b64encode(raw_key.encode("utf-8")).decode("ascii")
        print("Signing key was stored as plain text; base64-encoded it for Tauri.")
    else:
        padded = raw_key + "=" * (-len(raw_key) % 4)
        try:
            decoded = base64.b64decode(padded, validate=True).decode("utf-8")
        except Exception as exc:
            print(f"ERROR: signing key is neither plain text nor valid base64 ({exc}).")
            sys.exit(1)
        if not looks_like_key(decoded):
            print("ERROR: base64 decoded, but the result is not a recognisable signing key.")
            print("       Expected it to start with 'untrusted comment:' or contain 'BEGIN'.")
            sys.exit(1)
        signing_key = padded
        if padded != raw_key:
            print(f"Signing key was missing {len(padded) - len(raw_key)} base64 padding char(s); restored.")
        else:
            print("Signing key is valid base64.")

    # Actions masks the secret exactly as stored — the base64 form. Decoding produces a
    # DIFFERENT string that masking does not know about, so anything echoing the environment
    # would print the private key in plain text. Register the decoded form too.
    # ::add-mask:: matches one line at a time, and an rsign key is two lines.
    for line in signing_key.splitlines():
        if line.strip():
            print(f"::add-mask::{line}")
    if raw_pass:
        print(f"::add-mask::{raw_pass}")

    # Write to GITHUB_ENV so downstream steps can read them
    github_env = os.environ.get("GITHUB_ENV", "")
    if github_env:
        with open(github_env, "a") as f:
            # Use heredoc-style delimiter for multi-line values
            f.write(f"TAURI_SIGNING_PRIVATE_KEY<<EOF_KEY\n{signing_key}\nEOF_KEY\n")
            f.write(f"TAURI_SIGNING_PRIVATE_KEY_PASSWORD={raw_pass}\n")
        print("Exported TAURI_SIGNING_PRIVATE_KEY and TAURI_SIGNING_PRIVATE_KEY_PASSWORD to GITHUB_ENV.")
    else:
        # Local dev fallback: just set in current process (won't persist)
        os.environ["TAURI_SIGNING_PRIVATE_KEY"] = signing_key
        os.environ["TAURI_SIGNING_PRIVATE_KEY_PASSWORD"] = raw_pass
        print("GITHUB_ENV not found (local run). Set variables in current process only.")

    # Print key info (without revealing the actual key)
    print(f"Key length: {len(signing_key)} characters")
    print(f"Key starts with: {signing_key[:20]}...")
    print(f"Password length: {len(raw_pass)} characters")

if __name__ == "__main__":
    main()
