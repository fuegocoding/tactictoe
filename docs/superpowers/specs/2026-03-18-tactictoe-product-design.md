# TacticToe — Product Design Specification
**Date:** 2026-03-18
**Status:** Revised v2 — spec-reviewed, pending user approval before implementation planning
**Author:** Claude (PM + Architect role)

---

## 1. Executive Assessment

**Why it could work:** Near-zero learning curve (everyone knows TTT), Ultimate TTT has real strategic depth and no competitive home, the link/QR-share mechanic is genuinely viral, and Chess.com proved a serious aesthetic on a classic game can scale.

**Why it could fail:** Standard 3×3 TTT is fully solved (always draws). Most TTT variants either solve quickly or lack sufficient depth to sustain a competitive ladder long-term. The audience for "serious competitive TTT" is unknown and potentially very small. Retention after novelty is the core risk.

**Niche:** Casual multiplayer-with-friends (top-of-funnel) → competitive Ultimate TTT and m,n,k players (core retention).

**Defensibility:** Elo ratings + match history stickiness, cosmetics lock-in, network effects, being first to build a serious Ultimate TTT rating ecosystem.

**Blunt bottom line:** Viable as a niche competitive product. Not obviously viable at Chess.com scale. Target: "best home for Ultimate TTT and m,n,k competitive play, with frictionless casual play as the acquisition funnel."

---

## 2. Product Strategy

**Positioning:** "The competitive home for Tic-Tac-Toe and its deeper variants." Not a toy. Not nostalgia. A real platform.

**Primary targets:**
- Competitive grinders (want Elo, improvement, recognition)
- Social hosts (want sub-10s game setup for groups)
- Puzzle/math enthusiasts (want variant depth)
- Lapsed players (nostalgia hook → discovery)

**Key differentiators:**
1. Only rated Ultimate TTT ladder on the web
2. Sub-10-second guest game creation (link + code + QR)
3. Cosmetics + progression for long-term players
4. Intentional casual vs. ranked separation

---

## 3. MVP Scope

### Must-Have
- Ultimate TTT full rules engine (server-authoritative)
- Real-time WebSocket multiplayer
- Guest play (no account) + shareable game link + room code
- Account creation (email + Google OAuth)
- Glicko-2 Elo for Ultimate TTT (rapid time control, accounts only)
- Basic user profile (username, rating, recent matches)
- Match history (accounts: stored; guests: session-only)
- Standard 3×3 TTT (casual only, no ranked)
- Reconnection handling (60s grace period)
- Rematch flow
- Mobile-responsive UI

### Should-Have (V1, not MVP blocker)
- QR code join
- Leaderboard
- Gomoku ladder (15×15, 5-in-a-row, swap2)
- Custom n×n boards (casual)
- Spectating with 5s delay
- Board/piece theme selector (3–5 options)
- Guest-to-account conversion CTA
- Host-controlled room settings
- Moderation report flow
- Match result screen with move replay

### Excluded from MVP
3D/4D TTT, expanded nested Ultimate, puzzles/lessons, AI opponent, friend lists, in-game chat, sound packs, achievement system, premium/subscription, season system, tournaments, 4D visualization.

---

## 4. Variant Framework

| Variant | Rules Summary | Mode | Depth | Impl Difficulty | Phase | Solvable? | Notes |
|---|---|---|---|---|---|---|---|
| Standard 3×3 | Classic 3-in-a-row, 3×3 | Casual only | None | Trivial | MVP | Yes — always draw | Tutorial only. Never ranked. |
| Ultimate TTT | 9 mini-boards in 3×3 meta. Play location dictates opponent's next board. Win 3 mini-boards. | Ranked + Casual | High | Medium | **MVP** | Not solved for general play | Flagship. Primary Elo ladder. |
| Gomoku / m,n,k | m×n board, k-in-a-row wins. 15×15 + 5-in-row is standard. | Ranked + Casual | High (large boards) | Low-Medium | V1 | Partially (swap2 mitigates advantage) | Second ranked ladder. Requires swap2 opening rule. |
| Custom n×n | n-in-a-row on n×n configurable board | Casual only | Varies | Low | MVP | Varies | No Elo. Experimentation space. |
| 3D TTT (Qubic) | 4×4×4 cube, 4-in-a-row in any direction | Casual only | Moderate | High (3D render) | Post-MVP | Yes — P1 wins | Visualization is the challenge. |
| Expanded Nested Ultimate | 3 levels of board nesting | Casual only | Very High | Very High | Experimental | No | Niche. Not a ladder game. |
| 4D TTT | 3×3×3×3 hypercube | Casual only | Theoretical | Extreme | Experimental | Partial | Academic curiosity only. |
| Wild TTT | Players choose X or O each turn | Casual only | Low | Low | Post-MVP | Yes — P1 wins | Novelty. Can't sustain ladder. |
| Misère TTT | Completing 3-in-a-row loses | Casual only | Low | Low | Post-MVP | Yes | Known optimal strategy exists. |
| Notakto | Both play X, completing 3-in-a-row loses | Casual only | Low-Medium | Low | Post-MVP | Yes (Plambeck analysis) | Multi-board version has richness. |
| SOS | Place S or O, complete SOS sequences for points | Casual only | Medium | Low-Medium | Post-MVP | No | Interesting scoring model. |
| Numerical TTT | Odd/even numbers placed; sum-to-15 in a row wins | Casual only | None | Low | Post-MVP | Yes — isomorphic to 3×3 | Mathematically fun, no ladder value. |
| Treblecross | 1D strip, 3 adjacent X's loses | Casual only | Low | Low | Experimental | Yes (Sprague-Grundy) | Academic only. |

**Ranked ladder verdict:** Only Ultimate TTT (MVP) and Gomoku/m,n,k (V1) justify rated ladders.

---

## 5. Ranked System Design

**Rating algorithm:** Glicko-2 (not plain Elo). Better uncertainty handling, faster stabilization for new players.

**Ladders:**
- Ultimate TTT: own Glicko-2 rating
- Gomoku (V1): own Glicko-2 rating
- No cross-variant shared rating

**Placement:** 10 games before rating is published publicly. Provisional badge shown during placement.

**Time controls (MVP: rapid only):**
- Rapid: 10min + 5s/move
- Blitz + Bullet: V1 additions (separate Elo per time control post-MVP)

**Decay:** 5 points/day after 30 days inactivity, floor at RD=200. A background cron job (Vercel Cron, running nightly) applies decay to all inactive rated accounts. Vacation mode (pauses decay, 14 days/month max) is a **V1 feature** — not included in MVP. MVP ships with decay only, no opt-out.

**Reconnection forfeit rule (decision):** During the 60-second reconnection grace period, the player's clock continues running. Two outcomes: (1) if the clock expires before reconnection, the player loses on time (standard timeout). (2) if 60 seconds elapses without reconnection AND the clock had not expired, the disconnected player forfeits — their opponent wins. This prevents games from hanging indefinitely. This rule applies to both rated and casual games. Rated Elo is updated on forfeit. *Note: this default is subject to revision based on early player feedback.*

**Seasons:** 3-month seasons, launch when 100+ active rated players. Soft reset at season start (ratings move 25% toward 1500). Season-scoped + all-time leaderboards. Cosmetic reward for rank tier achieved.

**Matchmaking:** ±200 Elo initial range, +50 per 30s. Cancel after 3 minutes. 10s accept window. 3 declines → 10min queue ban.

**Anti-abuse:** Email verification required for ranked. IP rate limit on account creation (3/IP/24h). Rating floor: 100. Sandbagging flag: >60% loss rate. Abandon tracking: 3+ in 7 days → temp ranked suspension.

**Solved game handling:** Standard 3×3: never ranked. Wild/Misère/Notakto: casual only. Ultimate TTT: consider swap rule in V1 if P1 advantage becomes significant at high ELO.

---

## 6. Core User Flows

### Guest Instant Game
1. Homepage → "Play Instantly"
2. Select variant (default: Ultimate TTT)
3. Room created → display **Link** and **Room Code** (QR is V1)
4. Share → opponent joins → game starts
5. Guest identity: "Guest#XXXX" (session-scoped, persisted via short-lived cookie — see Section 8)
6. Post-game: "Save your progress" CTA

### Join Flows (MVP)
- **Link:** Navigate to `tactictoe.com/room/[code]` → one-click join
- **Room code:** Enter 6-char code in lobby input → validate → join
- Private rooms: password prompt before join
- **QR code join:** V1 feature — not in MVP

### Join Flows (V1 addition)
- **QR:** Scan → opens room URL in browser → same as link join

### Ranked Flow
1. Login required + email verified
2. "Ranked" tab → select ladder + time control → "Find Match"
3. Matched → 10s accept countdown → game
4. Post-game: Elo delta shown, rating graph updated

### Guest-to-Account Conversion
1. "Save your progress" CTA shown after any match
2. Email + password or OAuth
3. Last 10 guest matches migrated to new account
4. Prompt: "X games as guest are now in your history"

### Room Settings (Host)
- Host sees settings panel in waiting room
- Controls: variant, time control, spectators allowed, password
- Changes broadcast to all waiting players
- Settings locked once game starts

---

## 7. PRD Summary

**Problem:** No serious competitive platform for Ultimate TTT. No frictionless casual TTT multiplayer.

**Goals:**
1. Only rated Ultimate TTT ladder on the web
2. Guest game creation in <10 seconds, no signup
3. Long-term retention via ratings, progression, cosmetics
4. Extensible variant ecosystem

**Non-Goals:** AI opponent at MVP, native app, Chess.com analysis depth, ranked standard 3×3 ever, monetization at MVP.

**Key personas:** Competitive Grinder (wants Elo), Social Host (wants link/QR), Puzzle Enthusiast (wants variants), Lapsed Player (nostalgia hook).

**Success metrics:**
| Metric | MVP Target |
|---|---|
| D1 retention | >25% |
| Guest-to-account conversion | >10% |
| Median time-to-game (guest) | <30s |
| Rated games/day at 3 months | 50+ |
| Session games/user | >2.5 |
| Match completion rate | >80% |

**Key risks:**
- Player base too small for matchmaking → mitigate with expanding Elo range
- Ultimate TTT strategic ceiling → have Gomoku ready in V1
- Room spam abuse → IP rate limiting, 3 room/IP limit
- Scope creep → strict MVP gate

---

## 8. Technical Architecture

### Services
1. **API Service** (Next.js API routes / Express): auth, users, profiles, match history, Elo, leaderboards, room management, queue. Stateless, serverless-compatible.
2. **Game Server** (Node.js + Socket.io): live sessions, WebSocket connections, move processing, time tracking, disconnect handling. Stateful — sharding required at scale.

### Tech Stack
| Layer | Choice | Rationale |
|---|---|---|
| Frontend | Next.js 14 + TypeScript | SSR for SEO, SPA feel for game, Vercel deploy |
| Game rendering | React + Canvas API | Animation control without heavy engine |
| State | Zustand (client) + WebSocket (game state) | Game state is server-authoritative; client mirrors |
| Game server | Node.js + Socket.io | Stateful WS sessions |
| API | Next.js API routes or Fastify | Stateless, easy scaling |
| Database | Supabase (PostgreSQL) | Auth + realtime + storage in one managed service |
| Rating | Glicko-2 npm package | Don't hand-roll rating math |
| Deployment | Railway Pro (all services) | $20/month flat; simplifies ops for solo dev |
| Observability | Sentry + Railway metrics + UptimeRobot | Railway provides built-in CPU/memory/network graphs; Sentry free tier for errors |

### Rules Engine Interface
```typescript
interface GameRules {
  initialize(config: VariantConfig): GameState
  applyMove(state: GameState, move: Move, playerId: string): MoveResult
  getLegalMoves(state: GameState): Move[]
  checkTerminal(state: GameState): TerminalResult | null
  serialize(state: GameState): string
  deserialize(s: string): GameState
}
```
Each variant is a class implementing this interface. Server is variant-agnostic.

### Guest Technical Details
| Concern | Solution |
|---|---|
| Temporary identity | UUID stored in a short-lived **HttpOnly cookie** (30-min expiry, renewed on activity). NOT sessionStorage (tab-scoped, lost on tab close — breaks mobile reconnection). Display name "Guest#XXXX" generated server-side on first room creation. |
| Secure join tokens | HMAC-SHA256 signed token in room URL: `roomId + timestamp + signature`. Server verifies signature and timestamp on join. |
| Room codes | 6-char alphanumeric (no 0/O/I/l for readability), collision retry (generate new code if conflict). |
| QR codes | **V1 feature.** When added: client-side generation via `qrcode` npm package; encodes the direct room URL. |
| Guest reconnection | Short-lived cookie provides identity across tab close/reopen within 30 minutes. Game server can look up in-progress game by guest UUID on reconnect. Clock continues during grace period (see reconnection forfeit rule in Section 5). |
| Room spam | Max 3 active rooms per IP, 5 rooms/IP/hour rate limit. Enforced at API layer. |
| Guest data retention | Guest match records stored in DB for 7 days, then pruned by nightly cron. |
| Guest-to-account | On registration, client sends current guest UUID cookie value. Server runs migration: links last 10 `match_players` rows (where `guest_session_id` matches) to new `user_id`; sets `guest_sessions.migrated_to_user_id`. See data model. |

**Note on IP rate limits:** Mobile carriers use CGNAT — many users share a single IP. The 3-room/IP limit is a spam deterrent, not an absolute block. If a room creation is rejected, the error message should suggest signing in as a workaround. This is a known limitation to revisit if abuse is low.

### API Service Decision
**Decision: Next.js deployed as a standalone Node.js service on Railway (not Vercel).** Since all services are on Railway Pro, we deploy Next.js as a Docker container (or Railway's Nixpacks build) exposing port 3000. API routes remain colocated with the frontend in the same Next.js app — no need for a separate API service. This reduces the number of services to manage.

**Deployment architecture (Railway Pro, all-in):**
| Service | Railway Config | Notes |
|---|---|---|
| Frontend + API | Next.js app, standalone Docker build | API routes handle auth, profiles, Elo, rooms, queue |
| Game server | Node.js + Socket.io, separate Railway service | Stateful — must be a persistent process, not serverless |
| Database | Railway PostgreSQL plugin | Managed Postgres; no need for Supabase |
| Auth | Custom JWT + OAuth (no Supabase auth) | Without Supabase, use NextAuth.js for auth |

**Implication for Supabase:** Supabase is no longer needed. Replace with: Railway PostgreSQL (database), NextAuth.js (auth + OAuth), and standard pg/Prisma for DB access. This removes a dependency and keeps everything in one billing account.

**Implication for Supabase Realtime:** Lobby presence features that would have used Supabase Realtime will instead use the game server's Socket.io connection, which players already have open. This is simpler.

### Move Flow
Client sends move → server validates → server updates state → broadcasts to all → server writes to DB

### Anti-cheat
- Server validates every move against full game state
- Server tracks time (client clock not trusted)
- Min move time: 50ms (faster = flagged/rejected)
- IP + account rate limits on game creation and queue

---

## 9. Core Data Model (Key Entities)

- `users` — identity, email, created/deleted timestamps
- `profiles` — username, avatar, bio, display settings
- `guest_sessions` — temporary identity, IP hash, expiry, conversion tracking
- `variants` — variant definitions, ranked eligibility, rules schema
- `ratings` — Glicko-2 rating per (user, variant, time_control)
- `rating_history` — per-match rating changes
- `matches` — match metadata, result, variant snapshot
- `match_players` — player assignments per match; each row has a nullable `user_id` OR a nullable `guest_session_id` (never both set, never both null — enforced by CHECK constraint). On guest-to-account conversion, `user_id` is populated from the migrated guest's new account and `guest_session_id` is cleared.
- `moves` — ordered move log with timing data
- `rooms` — room config, join token, code, host, status, expiry
- `guest_sessions` — adds `migrated_to_user_id UUID` field set on account conversion; used to transfer match ownership.
- `matchmaking_queue` — active queue entries (accounts only). Key fields: `id`, `user_id`, `variant_id`, `time_control`, `rating` (snapshot at queue join), `rd` (Glicko-2 rating deviation — required for match quality scoring), `joined_at`, `current_search_range`, `status` ('searching'|'matched'|'cancelled'). Matchmaking logic expands `current_search_range` by 50 every 30 seconds.
- `leaderboard_snapshots` — materialized rankings per season
- `seasons` — season definitions per variant
- `cosmetics` — available cosmetics catalog
- `user_cosmetics` — owned + equipped cosmetics per user
- `achievements` + `user_achievements` — achievement definitions and unlocks
- `moderation_reports` + `user_suspensions` — abuse tracking

---

## 10. Roadmap

### MVP (8–12 weeks)
Ultimate TTT engine + real-time multiplayer + guest link/code play (no QR) + account auth + Glicko-2 Elo + profile + match history + lobby (create room + join by code + matchmaking queue) + client-side board theme preference stored in localStorage (3 options, no database) + mobile UI.

**Theme note:** MVP board themes are purely client-side (stored in localStorage). There is no `cosmetics` or `user_cosmetics` table at MVP. The cosmetics database infrastructure ships in V1 alongside the first account-linked cosmetics.

### V1 (+8 weeks)
QR codes + leaderboard + Season 1 + Gomoku ladder + spectating + custom n×n + SOS/Misère/Wild variants + achievements + expanded cosmetics + report flow + match replay + admin dashboard

### V2 (+12 weeks)
Game analysis viewer + puzzle mode (20 curated positions) + 3D Qubic (casual) + expanded recursive Ultimate (experimental) + friend lists + in-game chat + cosmetics store + multiple time control Elo

### Long-term
Tournaments, AI opponent, 4D TTT, community variants, native app, streaming integration

---

## 11. Open Questions

**Product:**
1. What is the actual strategic ceiling of Ultimate TTT? When does the ladder feel stale?
2. Is "Chess.com for TTT" the right framing, or should we position around "fast strategy games"?
3. Should Standard 3×3 be removed to protect the serious identity?
4. What is the monetization model? (Cosmetics-only? Season passes? One-time purchases?)
5. When does a season launch become appropriate (minimum player base)?
6. Should Ultimate TTT ranked use an opening swap rule?

**Technical:**
7. How does the game server scale beyond 500 concurrent games? (Sharding strategy?)
8. How long should guest data be retained before pruning?
9. Is Supabase Realtime sufficient for <100ms move broadcast, or is a custom WS stack needed?
10. ~~What is the forfeit/draw rule when time expires during a reconnection grace period?~~ **Resolved:** Clock continues; timeout loss if clock expires; forfeit if 60s grace elapses with clock intact. See Section 5.
11. When should room code length increase to avoid collision probability?
12. Should the client have a local rules engine mirror for immediate legal-move feedback?

---

## Appendix: Recommended MVP, Biggest Risk, First Week

**Recommended MVP:** Build exactly one competitive variant — Ultimate TTT — with Glicko-2 rated rapid queue, real-time WebSocket game engine, and server-side rule validation. Surround it with frictionless guest play: create a game in two clicks, get a link + room code, share it, play immediately. Build guest-to-account conversion as a first-class CTA. Ship standard 3×3 as casual-only tutorial. Everything else ships after evidence of return visits.

**Biggest Risk:** Ultimate TTT may have a lower strategic ceiling than assumed. If high-ELO players discover opening memorization and forced-win sequences within months, the competitive ladder becomes hollow. Mitigation: have the Gomoku ladder ready in V1, treat the variant pipeline as a core product mechanic, and invest in puzzle/lesson content to extend perceived depth.

**Build first this week:**
1. Implement `GameRules` interface for Ultimate TTT in TypeScript
2. Unit test the full ruleset (forced-board constraint, board completion, meta-board win detection, edge cases)
3. Wrap in a minimal Socket.io server: room-join + move-broadcast loop (no auth, no UI)
4. Get two browser tabs playing a complete game correctly with server as source of truth
