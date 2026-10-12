# Hero replacement verification

The previous independent review is preserved in `previous-review.json`. The sole remaining imagery finding was addressed by replacing the soft group photograph with a different verified CC0 original by Maddi Bazzocco. Source HTML, exact Wikimedia metadata, CC0 terms and the original 4752 × 3168 file are retained here. Historical license notes remain in `public/images/SOURCES.md`. Prior external QA artifacts were not present in this workspace; none were deleted.

Production build and ESLint logs are retained. Run the production server on port 3100, then `node qa/hero-refresh/verify-interactions.cjs`. The verifier also exports `verify({browser, baseUrl, evidenceDir})` for an independent runner. It uses the supplied Turso credentials and signing secret, creates explicitly labelled test bookings with unique example.invalid emails, asserts confirmation and reload, then removes only its own booking and idempotency record. Existing bookings are preserved.

`interaction-evidence.json` contains only executed assertions. Desktop/tablet/mobile screenshots are actual DPR2 captures. `served-image-resolution.json` records the browser-selected URL, actual decoded served dimensions, frame dimensions and effective pixel scale after cropping. The delivered image bytes are saved too.

Visual inspection covers 1440×900 desktop, 768×1024 tablet and 390×844 mobile. Tablet remains 360px high. The tablet uses the wider rendition to retain equipment and stance; desktop/mobile use the stronger crop. Booking destination and confirmation screenshots are retained for all three sizes.

Publication and independent quality scoring remain the host's responsibility. No commit, push or deployment was performed. Production HTTPS direct/actual Constructor iframe submission and reload must still verify Secure, HttpOnly, SameSite=None and Partitioned cookies once those environments exist; these are pending integration checks, not passed local assertions.

Final follow-up: tablet srcset now offers 1440, 1920 and 2400 pixel renditions, with unchanged crop and 360px height. Fresh executed evidence is in /tmp/constructor-quality, including 35 passing local checks, new DPR2 captures, license verification and image-resolution evidence. The original verifier and evidence above are retained; verify-interactions-final.cjs preserves the final runner-compatible verifier.
