# Common 3.0

Common combines creator posts, personal and public Worlds, communities, and private conversations. This upgrades the existing Common application and preserves its accounts, Moments, participation, rooms, connections, notifications, and settings. Moments now appear as Events.

## Implemented

- Responsive navy, purple, and pink feed, World covers, creator profiles, and mobile navigation.
- Video, image, text, and poll posts with one canonical record shared across Worlds.
- Likes, threaded comments, reposts, quotes, private saves, sharing, follows, and real view/watch measurements.
- Personal/private Worlds, public Worlds, topic and format preferences, member roles, invitations, approval queues, and World moderation.
- Communities with memberships, associated Worlds, and posts.
- Private direct and group conversations with Realtime updates, older messages, editing, deletion, mute settings, messaging preferences, and optional read receipts.
- Profiles with avatar/banner uploads, bio, links, pinned posts, and featured owned Worlds.
- Creator statistics calculated from real records, search, onboarding, and privacy/personalization controls.
- Existing adult signup, email confirmation handling, Events, room chat, saves, feedback, exports, blocking, reporting, and account deletion.

No sample users, posts, or engagement counts are inserted. Empty states reflect the actual database.

## Media and remaining work

Images are checked as PNG/JPEG/WebP. Videos use validated MP4 uploads, a 100 MB limit, and a three-minute duration limit. Direct signed uploads avoid proxying large files through Vercel. Server validation issues an HMAC receipt before media becomes eligible for a post. Storage remains private and authorized reads receive temporary signed URLs.

Playback currently uses progressive MP4 and a client-generated thumbnail. Adaptive streaming, transcoding, automated content review, and production retention/abandoned-upload cleanup require a separate media pipeline. Creator analytics include views and watch seconds, not a full retention curve. Reports require an authorized operator for platform-wide review. SMTP delivery, signup confirmation, authenticated browser flows, and reconnect behavior still require end-to-end acceptance testing. Registration validates declared age, not independently verified age.

## Setup

Use Node 24 and pnpm 11.25.0.

1. Run `pnpm install --frozen-lockfile`.
2. Copy `.env.example` to `.env.local` and configure the Supabase URL and publishable key. Never use a service-role key in the browser.
3. Apply migrations in filename order to a dedicated project. They are already applied to the connected Common project and must not be run twice there.
4. Configure a random server-only `MEDIA_VALIDATION_SECRET` in the runtime and provision the same secret in `private.media_validation_secret` through a trusted administrator connection. Never commit the value or expose it in a public environment variable.
5. Run `pnpm dev` or `pnpm build` followed by `pnpm start`.

For Supabase Auth, configure the deployed origin and permitted callback URLs. Set up SMTP, confirmation delivery, and rate limits before public launch. Leaked-password protection is currently disabled in the connected project.

## Deployment

The existing GitHub repository is linked to Vercel at https://common-liard.vercel.app/. Main commits trigger production builds. `vercel.json` uses Next.js and `.next`. Production has `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, and the server-only media validation secret.

## Architecture and verification

`app/page.tsx` and `components/social` implement the social interface. `/api/social` handles validated reads and actions. `/api/media` coordinates signed uploads and checks uploaded bytes. Existing `/api/auth`, `/api/data`, and `/api/upload` continue to support accounts and Events.

Public RPC wrappers use caller privileges. Private implementations enforce identity, ownership, visibility, membership, and moderation roles. RLS protects private preferences, saves, conversations, and media records. The secret table has no client-access policy.

Run `pnpm test`, `pnpm typecheck`, `pnpm lint`, and `pnpm build`. The SQL fixtures in `tests/database.integration.sql` and `tests/social.integration.sql` run in a transaction and roll back. They cover Event authorization/capacity plus World visibility, feed preferences, canonical counts, approval queues, private saves, DM membership, blocking, and analytics. All 11 unit tests, type checking, lint, build, and database fixtures passed before publication.

The disposable HTTP login fixture failed in Supabase Auth with `Database error querying schema`. This did not alter the real member account. Consequently the combined authenticated upload/playback test has not been completed. The fixture was removed and the preexisting profile and Event counts were preserved.

Account deletion cascades through application records. Storage object cleanup for deleted accounts and abandoned uploads still needs an operational job. Signed media links expire after an hour.
