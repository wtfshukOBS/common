# Common

Your place to be, together.

Common centers on shared activities: find a Moment, join people, share an experience, connect, and meet again.

## First release

Implemented with real Supabase records, not seeded activity:

- Email/password authentication, email confirmation handling, session refresh and sign-out.
- Adults-only registration enforced by a database trigger, plus server validation. This relies on declared birth dates, not independent age verification.
- Profiles, interests, language and group-size onboarding.
- Responsive navigation, dark/light/system themes and saved preferences.
- Moment creation, immediate starts, scheduled starts, and bounded weekly series.
- Private/public visibility, join approval, atomic capacity limits, joins and leaving.
- Private cover uploads with PNG/JPEG/WebP checks, a 5 MB size limit and signed URLs.
- Participant lists, host announcements, invitations, request approvals, removal, cancellation and completion.
- Supabase Realtime room chat, reconnect reloads and older-message pagination.
- Post-Moment recap, private feedback, private saves and mutual connection requests.
- Notifications, blocking, reports, personal exports and permanent account deletion.
- Row-level security, explicit grants, foreign-key indexes and database-enforced authorization.

Not implemented in this release: direct conversations, full communities, mutual Shared History consent and memories, custom profile widgets, moderator/admin review UI, analytics, email reminders, custom avatars/banners, availability preference editing, editing existing Moments, storage usage quotas, automated retention, independent age verification, or built-in voice/video. Messages and Communities explain that they are later releases. Reports currently require review in Supabase by an authorized operator. This is a foundation release, not completion of the full 22-section product brief.

## Stack and hosting

React 19, TypeScript, Next.js App Router-compatible routes, Tailwind CSS, Lucide, Zod and Supabase Auth/Postgres/Realtime/Storage. The hosted ChatGPT Site uses Vinext's compatible runtime on Cloudflare Workers. `vercel.json` builds the same application with standard Next.js for Vercel. The GitHub distribution uses ordinary `next dev`, `next build`, and `next start` scripts.

No service-role key is required or exposed. Browser tokens are stored locally and validated by Supabase on every protected server request. Do not add arbitrary HTML or JavaScript rendering.

## Local setup

Use Node 24 and pnpm 11.25.0.

1. Install dependencies: `pnpm install --frozen-lockfile`.
2. Copy `.env.example` to `.env.local` and supply your project URL and publishable key.
3. Apply the SQL files in `supabase/migrations` in filename order to a dedicated Supabase project. These migrations have already been applied to `poukmhlzuwulxzcftami`; do not run them twice there.
4. Start development: `pnpm dev`. For the Sites checkout, the supplied runtime scripts launch Vinext instead of Next.js.
5. Create an account, verify your email if required, complete your profile, and create a Moment.

Environment variables:

- `SUPABASE_URL`: Supabase project URL.
- `SUPABASE_PUBLISHABLE_KEY`: public publishable API key. Never substitute a service-role key.

## Authentication configuration

In Supabase Authentication URL Configuration, set Site URL to your deployed Common origin and add it to the redirect allowlist. Add localhost for local development if needed. Keep email confirmation enabled. Configure SMTP and CAPTCHA/rate limits before inviting public signups. The signup trigger requires `birthdate` metadata and rejects minors and anonymous users. Existing adult registration does not establish verified identity or age.

## Vercel

Import `wtfshukOBS/common`, select Next.js, use repository root, and set the two environment variables above in the desired environments. `vercel.json` runs `pnpm exec next build` and uses `.next`. The supplied ChatGPT Site deployment is separate from Vercel. No Vercel project or deployment has been provisioned by this release.

## Architecture

- `app/page.tsx`: responsive application shell, feeds, profile, connections, and settings.
- `components/`: accessible native-dialog forms and the Moment room.
- `app/api/auth`: authenticated Supabase auth gateway.
- `app/api/data`: whitelisted, validated REST and RPC operations.
- `app/api/upload`: authenticated image uploads.
- `lib/validation.ts`: shared input validation.
- `supabase/migrations`: normalized tables, RLS, grants, private privileged implementations and caller-privileged public RPC wrappers.

Public RPC wrappers run with caller privileges. Private privileged functions validate identity and authorization explicitly. Capacity allocation locks the Moment row before checking or inserting participants. Rate-check triggers serialize creation and chat sends per user. Private covers require an authorized storage read before receiving a temporary signed URL.

## Verification

- `pnpm exec tsc --noEmit`
- `pnpm exec eslint app components lib`
- `node --test tests/validation.test.mjs`
- Execute `tests/database.integration.sql` through a trusted SQL connection. It uses temporary fixtures and rolls back all changes.
- `tests/live-check.mjs` takes JSON configuration on stdin for disposable confirmed test users. It checks login, real REST joins, a simultaneous last-space join race, room messaging, anonymous access, and cross-user privacy, then deletes the users through the account lifecycle RPC. Create fixtures in a dedicated test project when rerunning it. Do not supply real member credentials.

Database checks passed against the connected Common project, including concurrent SQL transactions competing for the last participant space. Type checking, linting, unit validation, and builds are checked before publication. Browser QA was unavailable in this execution environment. HTTP login with synthetic SQL fixtures was not completed. Browser login, email-delivery/confirmation, upload rendering, and Realtime reconnect behavior still need manual end-to-end verification. Public launch requires the remaining moderation and operational work above.

## Deletion and retention

Account deletion revokes sessions and deletes the account, hosted Moments and associated records through foreign-key cascades. Uploaded storage objects need an operational cleanup policy for abandoned uploads and deleted accounts. Signed image URLs last up to one hour. There is no automatic retention schedule in this release.
