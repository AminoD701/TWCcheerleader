# PWA / mobile refactor final acceptance status — 2026-09-06

## Implemented in Draft PR #1

- Phase 1 navigation/storage/data/PWA repairs are present as real source files on `refactor/architecture-pwa-20260906`.
- Mobile/PWA primary navigation uses five destinations: 女孩｜行程｜班表｜我的｜更多.
- Navigation regressions covering same-route re-render, canonical My/More state, hub closing and search state preservation pass in the recovered implementation test suite.
- Resilient Sheets/JSON loading, legacy-safe storage, controlled PWA update flow and project-scoped service-worker cache behavior are implemented.
- Unified cheerleader app icon set is present: SVG source, favicon 32, PNG 192/512 and maskable 512.
- `manifest.json`, Apple touch icon, favicon and service-worker app shell reference the unified icon family; Apple touch icon no longer points to `baseball.png`.
- Temporary recovery/apply workflows and split patch transport files have been removed after the implementation was committed.

## Verified automated checks from the implementation/recovery runs

- Frontend unit tests: passed.
- Targeted PWA/navigation regression tests: passed.
- Static build check: passed.
- Python tests: passed.
- Icon asset dimension/manifest wiring regression tests were added with the icon follow-up implementation.

## Still not claimed as verified

No browser or physical-device acceptance is claimed yet for:

- 320 / 360 / 390 / 430 / 768 / 1366 CSS px rendering.
- iOS safe-area behavior and standalone installation.
- Android/iOS PWA install and maskable cropping.
- Real software keyboard behavior.
- Modal/floating-control collisions during animation.
- Full browser Back/Forward E2E.
- Production old-service-worker upgrade behavior.
- Offline/upgrade behavior on a previously installed real PWA.

These require a browser/device environment that can load the site. Do not merge or deploy solely on the basis of the automated checks above.

## Merge/deploy guard

PR #1 remains Draft. Do not merge `main`, deploy production, force push, clear user data, or write to production vote/feedback endpoints until the remaining acceptance items are reviewed.
