# Security review: signed-in users can run SECURITY DEFINER functions

## What I checked first (results already in hand)

Seven functions in the app's data area run with elevated rights and are callable by signed-in users. `anon` (not-signed-in) already has no access to any of them, and every one already has a fixed `search_path = public`. All are owned by the database owner.

| Function | Purpose | Called from | Elevated rights needed? |
| --- | --- | --- | --- |
| `is_family_member(_family)` | Is the caller a member of this family? | Used inside almost every table's access rules (albums, posts, events, chats, messages, photos, polls, stories, ...) | Yes — it reads the membership table, which itself is protected; without elevation the rules recurse |
| `is_family_admin(_family)` | Is the caller an admin of this family? | Access rules for update/delete on families, invites, members, events, albums, chats | Yes, same reason |
| `shares_family_with(_user)` | Do the caller and this person share a family? | Profile visibility rules | Yes, same reason |
| `can_read_chat(_chat)` | May the caller read this conversation? | Chat/message rules | Yes, same reason |
| `has_role(user, role)` | Platform-creator check | Admin dashboard rules and audit log | Yes — reads the roles table without exposing it |
| `create_family(name, cover, relationship)` | Creates a family, makes the caller its admin, creates the main chat and an invite code | Onboarding screen | Yes — writes several protected tables in one step |
| `join_family_with_code(code, relationship)` | Joins the caller to the family matching a valid invite code | Onboarding screen | Yes — must look up an invite belonging to a family the caller cannot yet see |

Important: none of these accept "act as this user" input. The five checker functions take only the thing being checked and always compare against `auth.uid()` — the signed-in identity taken from the request token, never from the page. `create_family` uses `auth.uid()` as the owner. `join_family_with_code` takes only an invite code; it never accepts a family ID from the page.

Conclusion: revoking access from signed-in users would break every read and write in the app (the access rules themselves need to call these), and converting them to non-elevated would make the membership checks recurse and fail. So the correct outcome is hardening plus documenting, not conversion.

## What I will change

One migration, additive and reversible in behaviour:

1. Add an explicit "no signed-in user, no access" guard to each checker so they return false instead of relying on a null comparison: `is_family_member`, `is_family_admin`, `shares_family_with`, `can_read_chat`, `has_role`.
2. `has_role` additionally rejects a caller asking about anybody but themselves unless they are the platform creator, so it can't be used to probe other accounts' roles.
3. `join_family_with_code` gains explicit code trimming/expiry checks already present plus a guard that an already-suspended account cannot join, and returns the family only after the membership row is written.
4. Keep `search_path = public` on all of them, keep every table reference fully qualified with `public.`, and re-assert `REVOKE EXECUTE ... FROM PUBLIC, anon` and `GRANT EXECUTE ... TO authenticated` only for the seven the app genuinely needs. `handle_new_user`, `grant_platform_creator_role` and `touch_updated_at` stay unreachable by signed-in users (they already are).

No table, column, row, or policy is touched. No function is dropped — each is replaced in place with the same name, arguments and return type, so nothing that calls them changes.

## Restore point

I can't create a git commit or restore point myself. Lovable keeps a version of the project for every change, so this migration can be reverted from the version history; if you also want a GitHub commit first, connect/push from GitHub in the project settings before approving.

## Verification I will run afterwards

1. Re-run the database security linter and report the remaining findings verbatim.
2. Two accounts in two separate families (creating the second family and account through the app), then, signed in as user A, attempt against family B: read posts, albums, stories, chat messages, events and members; call `is_family_member`, `is_family_admin` and `can_read_chat` with family B's IDs; attempt to read a storage file under family B's folder. Each must return empty/false/denied.
3. Confirm user A's own family still reads and writes normally afterwards (feed, memories, chat, calendar, members).
4. Report the exact migration SQL applied and each test with its result.

## Note on the warning itself

The linter flags "signed-in users can execute an elevated function" for any such function, including ones that exist precisely to make the access rules safe. After the hardening above I'll mark it as reviewed with the reasoning recorded, rather than breaking the app to silence it. Say the word if you'd rather leave it listed as an open item.
