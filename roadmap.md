# Family Circle update roadmap

Order: event bug first, then stages 1-6 and 8-10 in listed order.

- [x] 7. Fix Create Event date validation (split date + time inputs, local-time combine, end >= start, all-day)
- [x] 1. Multiple families + family switching (active_family_id on profiles, /families page, cache isolation on switch, account-level remembered family)
- [x] 2. Family moment posts (title/date/location, post_media, contributors, collage 1+2 with +N, carousel, "Add yours")
- [x] 3. Photo-only Stories (stories tables, story row, creator, viewer, 24h expires_at, views, save to album)
- [x] 4. Chat photo attachments (message_attachments, previews, progress, full-screen viewer)
- [x] 5. Album creation with multiple photos + videos (album_media, per-file progress/retry, cover pick, reorder)
- [x] 6. Instagram-inspired album grid + album detail (square 3-col grid, contributors, reactions, comments, Add yours)
- [x] 8. Platform-creator admin dashboard (user_roles + has_role, metrics, reports, suspend, audit log) — creator: victoriayangchihhan@gmail.com
- [x] 9. Storage/security review (private buckets verified, RLS + policies on every table, function EXECUTE grants tightened)
- [x] 10. End-to-end testing + final report (all pages + write flows exercised as a signed-in member; isolation and privilege-escalation probes run as a non-admin member; no console errors; typecheck clean)

## Open items (not code defects)
- GitHub sync is not connected — version history is Lovable-internal only.
- Post-level reporting not implemented (photo/album reporting exists).
- Event dialog fields rely on placeholders rather than visible labels.
- Creating an event in a future month does not move the calendar to that month.
- E2E test rows remain in the Yang Family test account (post, poll, event, message, appreciation, check-in, comment).
