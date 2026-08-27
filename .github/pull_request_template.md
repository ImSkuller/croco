## Summary

<!-- What does this PR change, and why? -->

## Related issue

<!-- Fixes #123, or "N/A" -->

## Type of change

- [ ] Bug fix
- [ ] New feature
- [ ] Refactor / cleanup
- [ ] Docs
- [ ] CI / tooling

## Checklist

- [ ] `npm run build` passes
- [ ] `npm run lint` passes
- [ ] `cargo check` passes (`src-tauri/`)
- [ ] `cargo test` passes (`src-tauri/`)
- [ ] Changes to `settings.json` shape, project/note/todo JSON, or the SQLite
      schema ship with a migration that preserves existing user data
- [ ] New Tauri commands are registered in `invoke_handler` (`main.rs`) and
      exposed in `src/lib/api.js`
- [ ] I tested this manually (describe how below), not just via the checks above

## How was this tested?

<!-- What did you actually run/click to confirm this works? -->

## Screenshots (UI changes)

<!-- Before/after if this touches the UI. -->
