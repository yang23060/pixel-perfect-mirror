# Family Circle update roadmap

Order: event bug first, then stages 1-6 and 8-10 in listed order.

- [x] 7. Fix Create Event date validation (split date + time inputs, local-time combine, end >= start, all-day)
- [x] 1. Multiple families + family switching (active_family_id on profiles, /families page, cache isolation on switch, account-level remembered family)
- [x] 2. Family moment posts (title/date/location, post_media, contributors, collage 1+2 with +N, carousel, "Add yours")
- [x] 3. Photo-only Stories (stories tables, story row, creator, viewer, 24h expires_at, views, save to album)
- [x] 4. Chat photo attachments (message_attachments, previews, progress, full-screen viewer)
- [x] 5. Album creation with multiple photos + videos (album_media, per-file progress/retry, cover pick, reorder)
- [ ] 6. Instagram-inspired album grid + album detail (square 3-col grid, contributors, reactions, comments, Add yours)
- [ ] 8. Platform-creator admin dashboard (platform_admins/user_roles, metrics, reports, suspend, audit log) — creator: victoriayangchihhan@gmail.com
- [ ] 9. Storage/security review (per-feature private paths, RLS verification)
- [ ] 10. End-to-end testing + final report
