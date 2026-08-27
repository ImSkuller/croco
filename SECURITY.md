# Security Policy

## Reporting a vulnerability

Croco auto-installs updates and reads/writes files on your machine, so
security issues here are taken seriously — please **do not open a public
GitHub issue** for a suspected vulnerability.

Instead, use **GitHub's private vulnerability reporting**:

1. Go to the [Security tab](../../security) of this repository.
2. Click **"Report a vulnerability"**.
3. Include: affected version, a description of the issue, and steps to
   reproduce (a PoC if you have one).

This opens a private advisory visible only to maintainers until a fix is
ready, and lets us coordinate a disclosure date with you.

## Response targets

- **Acknowledgement:** within 5 business days.
- **Initial assessment** (severity, whether it's accepted): within 10
  business days.
- **Fix or mitigation:** timeline depends on severity, but we aim to ship a
  patched release before any public disclosure.

## Supported versions

Only the latest published release is supported with security fixes. Croco
is pre-1.0-stable (currently Beta) and does not maintain long-term-support
branches.

## Scope

In scope: the Croco desktop app (Tauri/Rust backend, React frontend), the
`pm`/`croco` CLI, and the auto-update mechanism.

Out of scope: third-party dependencies (report upstream), and anything
requiring physical access to an already-compromised machine.
