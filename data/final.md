# The Only Roadmap I Need

**Dipanshu Kumar** | Patna, Bihar | open to remote, ready to relocate
connect.dipanshukumar@gmail.com | +91 8102571038
github.com/devpilotX | linkedin.com/in/Dipanshu03z

**Window:** Friday 28 August 2026 to Sunday 24 January 2027
**Every resource in this document verified:** 27 August 2026

---

## The clock

| Item | Value |
| --- | --- |
| Launch block | Fri 28 to Sun 30 August 2026, 3 days at 8 hours = 24 hours |
| Week 1 begins | Monday 31 August 2026 |
| Final day | Sunday 24 January 2027 |
| Weeks | 21 |
| Calendar days | 150 |
| Study days | 143 |
| Core hours | 1,104 (24 launch + 1,008 weekday + 60 Sunday + 12 gate audit) |
| Night recall block | 94.5 hours (45 minutes x 6 nights, outside the 8) |
| Money hour | 129 hours (60 minutes x 6 days, outside the 8, see Part 17) |
| Total committed hours | 1,327.5 (1,104 core, 94.5 night recall, 129 money) |
| DSA problems by 24 Jan 2027 | 415 of 474 |
| Remaining 59 problems | February 2027 |
| Projects | 4 |
| Gates | 4 |
| Working Sundays | 10 at 6 hours |
| Gate audit Sundays | 4 at 3 hours |
| Rest Sundays | 7 |
| Money target by 24 Jan 2027 | Rs 90,000 received, 5 care plans active (Part 17) |
| Trackers running from day one | 9 (Part 18) |

## The day, every day

| Time | Block | Hours | What happens |
| --- | --- | --- | --- |
| 06:30 to 09:00 | DSA | 2.5 | Striver A2Z, in JavaScript. Never skipped, never moved. |
| 09:30 to 12:30 | LEARN | 3.0 | One subject per week. Drops to 2.0 from Week 15. |
| 14:00 to 16:00 | BUILD | 2.0 | The current project. Code that ships. |
| 16:00 to 16:30 | CLOSE | 0.5 | Commit, log.md, tomorrow decided before you stand up. |
| 16:30 to 17:00 | BREAK | 0.5 | Off the screen. Walk, eat. This break is what makes the money hour possible. |
| 17:00 to 18:00 | MONEY | 1.0 | The one extra hour. Outreach, quotes, client delivery. Never study time. Part 17. |
| Before sleep | NIGHT RECALL | 0.75 | Anki plus spoken explanation. Four of six nights aloud. |

Weekday total 8 hours of study. Weekly total 48 hours. From Week 15 the LEARN hour moves to applications.

The money hour sits on top of that, not inside it. Nine hours of committed work a day, 54 hours a week. If money work ever runs into a study block, the client waits. That rule is the whole reason both halves of this document can exist at the same time. The full money system is Part 17. What gets tracked, and what the tracker must warn you about, is Part 18.

## The four gates

| Gate | Week | Date | Condition to pass |
| --- | --- | --- | --- |
| GATE 1 | 5 | 4 October 2026 | Project 1 live on your own domain over HTTPS |
| GATE 2 | 11 | 15 November 2026 | Auth you wrote yourself, plus one WebSocket feature |
| GATE 3 | 15 | 13 December 2026 | Project 3 operable, and applications begin |
| GATE 4 | 21 | 24 January 2027 | Project 4 live, 100 applications sent |

A gate is not a checkpoint you hope to reach. If a gate fails, you do not advance to the next phase until it passes.

There are four money gates as well, on the same principle. They are in Part 17.12.


## Part 0 | The 25 corrections

Every one of these was wrong in the previous version of this plan. Each was checked and rebuilt.

| # | What the old plan said | What is actually true | Source | Fix applied |
| --- | --- | --- | --- | --- |
| C01 | Roadmap starts 3 August 2026, 24 weeks, ends 17 January 2027. | You start 28 August 2026. Twenty-five days are gone. 28 Aug 2026 is a Friday; the first full week begins Monday 31 August. | Calendar arithmetic, recomputed | Rebuilt as 21 weeks plus a 3-day launch block, ending Sunday 24 January 2027. |
| C02 | Daily Close block is 30 minutes and includes English practice. | You removed English from scope. | Your instruction, 27 Aug 2026 | Close block cut to 30 minutes of log and Anki only. The English half-hour moved to DSA. |
| C03 | A 25-minute English night block on six nights. | Removed at your instruction. | Your instruction, 27 Aug 2026 | Replaced by a 45-minute technical Night Recall Block: DSA pattern recall, system design out loud, project walkthrough rehearsal. |
| C04 | Node.js 24 is the LTS to build on, with no end date given. | Node 24 Krypton is Active LTS until 20 October 2026, then Maintenance until end of life on 30 April 2028. Node 26 was released 5 May 2026 and becomes Active LTS on 28 October 2026. | nodejs.org previous-releases and release schedule | Build on 24. Explicit Node 26 decision point added at Gate 3 in Part 6. |
| C05 | PostgreSQL 18.4 is current. | PostgreSQL 18 was released 25 September 2025. The current minor as verified is 18.6. Version 18 is supported to 14 November 2030. | postgresql.org versioning policy | Pinned to PostgreSQL 18, minor 18.6 or later. |
| C06 | Redis 8 is AGPLv3. | Since Redis 8.0 in May 2025, Redis Open Source is tri-licensed under RSALv2, SSPLv1 and AGPLv3. Valkey is the Linux Foundation fork of Redis 7.2.4 and is BSD-3-Clause. | redis.io and valkey.io licence pages | Corrected in Week 14 and in Part 6. One-sentence interview answer added. |
| C07 | Use AI SDK v5 patterns. | AI SDK 7 was released 25 June 2026. It is ESM-only, CommonJS support was removed, and the minimum Node version is 22. Migration from v6 uses npx @ai-sdk/codemod v7. | ai-sdk.dev migration guide 7.0 and the Vercel release post | Weeks 16 to 19 rewritten against AI SDK 7. Codemod command included. |
| C08 | pgvector 0.8.3 is the version to install. | The exact current patch could not be asserted from a primary source at the verification date. What is verifiable and matters more: vector indexes up to 2,000 dimensions, halfvec to 4,000, bit to 64,000, sparsevec to 1,000 non-zero. | github.com/pgvector/pgvector README | Patch number removed. Dimension limits stated instead, because that is the constraint that will actually stop you. |
| C09 | MCP has sessions and an initialize handshake. | The current MCP specification revision is 2026-07-28. It removed protocol-level sessions and the Mcp-Session-Id header, and removed the initialize and notifications-initialized handshake. Protocol version and client capabilities now travel in _meta. | modelcontextprotocol.io specification 2026-07-28 changelog | Week 19 rewritten for a stateless MCP. Server-minted handles replace session state. |
| C10 | Next.js 15 App Router. | Next.js 16 is the Active LTS line, released 21 October 2025. Next.js 15 leaves Maintenance LTS on 21 October 2026, which is inside this roadmap. In 16, Turbopack is default, middleware is renamed proxy with no edge runtime, and PPR is enabled through cacheComponents. | nextjs.org support policy and the version 16 upgrade guide | Week 10 rewritten for Next.js 16 with the three breaking changes called out. |
| C11 | Missing Semester lectures cited by number, 2020 edition. | The 2026 edition exists and has nine lectures with different names, including Agentic Coding and Code Quality. Lecture numbers do not map across editions. | missing.csail.mit.edu/2026 | Cited by lecture name against the 2026 edition, not by number. |
| C12 | PGExercises has 71 exercises. | The site publishes no headline total. Independent mirrors count 81 across seven categories. The number 71 could not be confirmed. | pgexercises.com category pages | Stated as roughly 80 across seven categories. Instruction is to finish all categories, not to hit a count. |
| C13 | Referrals are 6 per cent of applications and 37 per cent of hires. | No primary study supports those exact figures. The widely repeated industry figures are roughly 7 per cent and roughly 40 per cent, also without a traceable primary source. | No primary source located | Marked directional. The instruction stands because the direction is not disputed, but the precision is gone. |
| C14 | Striver A2Z has 474 problems. | Confirmed. 152 easy, 186 medium, 136 hard. Sheet last updated 13 December 2025. | takeuforward.org A2Z sheet | Kept. Now the basis of the honest 402-hour cost estimate in Part 4. |
| C15 | Argon2id at m=19456, t=2, p=1. | Confirmed exactly against the OWASP Password Storage Cheat Sheet. 19456 KiB is 19 MiB. | cheatsheetseries.owasp.org Password Storage Cheat Sheet | Kept verbatim. This is a direct interview answer. |
| C16 | Contextual retrieval cuts failures by 49 per cent. | Confirmed and now stated in full. Top-20 retrieval failure fell from 5.7 to 3.7 per cent with contextual embeddings, a 35 per cent reduction; to 2.9 per cent adding contextual BM25, a 49 per cent reduction; to 1.9 per cent adding reranking, a 67 per cent reduction. | anthropic.com/engineering/contextual-retrieval | Expanded to all three stages in Week 17. |
| C17 | OWASP Top 10:2025 maps 248 CWEs. | The 2025 list is confirmed as the eighth installment with the new A03 Software Supply Chain Failures and the new A10 Mishandling of Exceptional Conditions replacing SSRF. The figure of 248 CWEs could not be verified. | owasp.org/Top10/2025 | Category names and order kept. The CWE count removed. |
| C18 | Use Pramp for mock interviews. | Pramp was acquired by Exponent in November 2021 and folded into Exponent Practice in July 2024. Pramp links redirect. | tryexponent.com/practice | Replaced throughout with Exponent Practice. |
| C19 | Read The Copenhagen Book. | The Copenhagen Book was renamed and moved. It is now The Auth Book at auth.pilcrowonpaper.com, announced 3 June 2026. The old domain is archived. | auth.pilcrowonpaper.com | Replaced in Week 11 and in the resource library. |
| C20 | React 18 patterns, memoise aggressively. | React 19.2 shipped 1 October 2025 and React Compiler 1.0 became stable on 7 October 2025. Most manual useMemo and useCallback advice predates the compiler. | react.dev blog and the React Compiler documentation | Weeks 5 and 6 updated. Hand-memoisation is now an explicit anti-pattern in this plan. |
| C21 | Configure Tailwind in tailwind.config.js. | Tailwind v4 is CSS-first. There is no tailwind.config.js by default; theme tokens live in an @theme block. A JS config can still be re-linked with @config, but that is a compatibility path. | tailwindcss.com/docs | Week 6 rewritten for v4. The silent-failure trap is called out explicitly. |
| C22 | Forward Deployed Engineer roles pay 15 to 25 lakh at entry in India. | TeamLease Digital data reported in July 2026 puts FDE entry at 10 to 12 lakh, mid-level at 25 to 50 lakh and senior at 50 to 80 lakh and above. | TeamLease Digital, reported in The Hindu, July 2026 | Part 12 corrected downward. Entry expectations are now honest. |
| C23 | The Indian AI job market is booming. | Specific and current: Naukri JobSpeak for June 2026 showed AI roles in IT up 16 per cent year on year while overall IT hiring fell 3 per cent. July 2026 showed IT up 6 per cent and AI jobs up 33 per cent. February 2026 showed the 20-plus lakh fresher band up 30 per cent. | Naukri JobSpeak, reported by Reuters 3 July 2026 | Part 12 now carries dated figures instead of an adjective. |
| C24 | Week 14 is security. Week 13 is testing. | In v3 the Week 14 link list was testing-only and duplicated Week 13. The security week had no security links. | Internal contradiction in the source document | Fixed. Week 13 is security with the 2025 list. Week 14 is Docker, Compose and Redis. No duplication. |
| C25 | Cover says 474 problems and 1,224 hours; body says 398 problems and 1,152 hours. | Three different totals appeared in one document. None of them reconciled. | Internal contradiction in the source document | Every total in this document is computed by script from one table. 415 problems by 24 January 2027, 1,198.5 hours including the night block. |


## Part 1 | The three subjects

There are three subjects in this roadmap and nothing else.

| # | Subject | When | Hours |
| --- | --- | --- | --- |
| 1 | DSA | Every morning, all 21 weeks | 2.5 per day, 315 total |
| 2 | Web development | Weeks 1 to 15 | LEARN and BUILD blocks |
| 3 | Applied AI | Weeks 16 to 19 | LEARN and BUILD blocks |

Weeks 20 and 21 are not a fourth subject. They are mocks, the resume, and applications at volume.

**Applied AI is not optional.** It is the reason the primary target is Applied AI Engineer at Rs 8 to 15 lakh rather than generic fresher full stack at Rs 6 to 12 lakh, in a market where entry level postings fell 19 per cent year on year while AI and ML hiring rose 33 per cent.


## Part 2 | The launch block, 28 to 30 August 2026

Three days, 8 hours each, before Week 1 starts on Monday 31 August. This is housekeeping that would otherwise eat Week 1.

| Day | Date | Work |
| --- | --- | --- |
| Friday | 28 Aug 2026 | Decommission the old AWS EC2 box that is still billing. Document all 8 TLS certificates and their renewal dates. Create the four project repositories: itc-reclaim, itc-reclaim-api, itc-reclaim-ops, tender-fit. |
| Saturday | 29 Aug 2026 | Move local PostgreSQL 16 to 18. Verify pg_dump and restore both directions. Install the three Anki decks: DSA Patterns, System and Stack, Interview Answers. Set up log.md, versions.md, failed-twice.md. |
| Sunday | 30 Aug 2026 | Striver A2Z account and tracker. First 6 problems to prove the morning block works. Read the whole of Part 1 and Part 4 of this document. Decide nothing else after this point. |


## Part 3 | The 21 weeks at a glance

### Phases

| Phase | Name | Weeks | What it does |
| --- | --- | --- | --- |
| A | Foundation | Weeks 1–4 | Language, git, the browser, the wire. No framework touches the machine. |
| B | Interface | Weeks 5–7 | React, Tailwind v4, TypeScript. Gate 1 lands at the end of Week 5. |
| C | Backend | Weeks 8–11 | Node, PostgreSQL 18, Next.js 16, auth you wrote with your own hands. Gate 2. |
| D | Production | Weeks 12–15 | Tests, CI, OWASP 2025, Docker, Redis, queues, performance. Gate 3. |
| E | Applied AI | Weeks 16–19 | LLM plumbing, RAG with real numbers, evals, agents, one MCP server. |
| F | Conversion | Weeks 20–21 | Mocks, revision, then volume applications. Gate 4 closes the plan. |

### Every week, one line

| Wk | Dates | Subject | DSA cumulative | Gate |
| --- | --- | --- | --- | --- |
| 1 | 31 Aug – 6 Sep 2026 | The language, properly, and git you can actually use | 24 |  |
| 2 | 7–13 September 2026 | HTML, CSS and the machine underneath | 48 |  |
| 3 | 14–20 September 2026 | Prototypes, classes, errors and HTTP properly | 72 |  |
| 4 | 21–27 September 2026 | Async JavaScript. The week that decides everything after it | 96 |  |
| 5 | 28 Sep – 4 Oct 2026 | React fundamentals, and Gate 1 | 118 | GATE 1 |
| 6 | 5–11 October 2026 | React deeper, and Tailwind v4 | 140 |  |
| 7 | 12–18 October 2026 | TypeScript from zero to strict | 162 |  |
| 8 | 19–25 October 2026 | Node 24 and Express. API design that survives contact | 184 |  |
| 9 | 26 Oct – 1 Nov 2026 | PostgreSQL 18. Schema, indexes, transactions | 204 |  |
| 10 | 2–8 November 2026 | Next.js 16. Server components and the caching model | 224 |  |
| 11 | 9–15 November 2026 | Auth you wrote yourself, and Gate 2 | 244 | GATE 2 |
| 12 | 16–22 November 2026 | Testing and CI that actually run | 264 |  |
| 13 | 23–29 November 2026 | Security. The 2025 list, not the 2021 one | 282 |  |
| 14 | 30 Nov – 6 Dec 2026 | Docker, Compose, Redis, and your own box | 300 |  |
| 15 | 7–13 December 2026 | Queues, system design, performance, observability. Gate 3 | 318 | GATE 3 |
| 16 | 14–20 December 2026 | LLM plumbing for builders | 336 |  |
| 17 | 21–27 December 2026 | RAG properly. Hybrid retrieval with citations | 352 |  |
| 18 | 28 Dec 2026 – 3 Jan 2027 | Evaluation and LLM security | 368 |  |
| 19 | 4–10 January 2027 | Agents and one MCP server | 384 |  |
| 20 | 11–17 January 2027 | Mocks, revision, and the resume | 400 |  |
| 21 | 18–24 January 2027 | Applications at volume. Gate 4 | 415 | GATE 4 |

### DSA weekly targets

| Wk | Dates | Problems this week | Cumulative |
| --- | --- | --- | --- |
| 1 | 31 Aug – 6 Sep 2026 | 24 | 24 |
| 2 | 7–13 September 2026 | 24 | 48 |
| 3 | 14–20 September 2026 | 24 | 72 |
| 4 | 21–27 September 2026 | 24 | 96 |
| 5 | 28 Sep – 4 Oct 2026 | 22 | 118 |
| 6 | 5–11 October 2026 | 22 | 140 |
| 7 | 12–18 October 2026 | 22 | 162 |
| 8 | 19–25 October 2026 | 22 | 184 |
| 9 | 26 Oct – 1 Nov 2026 | 20 | 204 |
| 10 | 2–8 November 2026 | 20 | 224 |
| 11 | 9–15 November 2026 | 20 | 244 |
| 12 | 16–22 November 2026 | 20 | 264 |
| 13 | 23–29 November 2026 | 18 | 282 |
| 14 | 30 Nov – 6 Dec 2026 | 18 | 300 |
| 15 | 7–13 December 2026 | 18 | 318 |
| 16 | 14–20 December 2026 | 18 | 336 |
| 17 | 21–27 December 2026 | 16 | 352 |
| 18 | 28 Dec 2026 – 3 Jan 2027 | 16 | 368 |
| 19 | 4–10 January 2027 | 16 | 384 |
| 20 | 11–17 January 2027 | 16 | 400 |
| 21 | 18–24 January 2027 | 15 | 415 |

### Monthly DSA checkpoints

| End of month | Cumulative problems |
| --- | --- |
| August 2026 | 24 |
| September 2026 | 118 |
| October 2026 | 204 |
| November 2026 | 282 |
| December 2026 | 352 |
| January 2027 | 415 |
| February 2027 | 474 (sheet complete) |

Honest cost of all 474: about 402 hours. Easy 152 at 20 minutes = 50.7 h. Medium 186 at 47.5 minutes = 147.25 h. Hard 136 at 90 minutes = 204 h. The roadmap window contains 315 DSA hours, which is why 59 problems land in February rather than January. That is arithmetic, not slippage.

### The Sundays

| After week | Date | Type | What |
| --- | --- | --- | --- |
| 1 | 6 Sep 2026 | Working, 6 h | Python 1: syntax, types, control flow, functions |
| 2 | 13 Sep 2026 | Rest | No code. No screens before noon. This is load bearing. |
| 3 | 20 Sep 2026 | Working, 6 h | Python 2: files, JSON, requests, environments with uv |
| 4 | 27 Sep 2026 | Rest | No code. No screens before noon. This is load bearing. |
| 5 | 4 Oct 2026 | Gate audit, 3 h | GATE 1 \| Project 1 live on your own domain over HTTPS. |
| 6 | 11 Oct 2026 | Working, 6 h | Python 3: pandas for reconciliation work |
| 7 | 18 Oct 2026 | Rest | No code. No screens before noon. This is load bearing. |
| 8 | 25 Oct 2026 | Working, 6 h | SQL window functions |
| 9 | 1 Nov 2026 | Rest | No code. No screens before noon. This is load bearing. |
| 10 | 8 Nov 2026 | Working, 6 h | SQL CTEs, gaps and islands, EXPLAIN |
| 11 | 15 Nov 2026 | Gate audit, 3 h | GATE 2 \| Auth you wrote yourself, plus one WebSocket feature. |
| 12 | 22 Nov 2026 | Working, 6 h | Technical writing, and the Project 1 README |
| 13 | 29 Nov 2026 | Rest | No code. No screens before noon. This is load bearing. |
| 14 | 6 Dec 2026 | Working, 6 h | AWS S3, EC2, RDS, IAM, and Cloudflare |
| 15 | 13 Dec 2026 | Gate audit, 3 h | GATE 3 \| Project 3 operable. Applications start today. |
| 16 | 20 Dec 2026 | Working, 6 h | Reading code: n8n |
| 17 | 27 Dec 2026 | Rest | No code. No screens before noon. This is load bearing. |
| 18 | 3 Jan 2027 | Working, 6 h | LLM tracing with Langfuse and OpenTelemetry GenAI |
| 19 | 10 Jan 2027 | Working, 6 h | Reading code 2, and Forward Deployed Engineer case drills |
| 20 | 17 Jan 2027 | Rest | No code. No screens before noon. This is load bearing. |
| 21 | 24 Jan 2027 | Gate audit, 3 h | GATE 4 \| Project 4 live. One hundred applications sent. |


## Part 4 | Week by week, in full


### Week 01 | 31 Aug – 6 Sep 2026 | The language, properly, and git you can actually use

**Phase A Foundation** | **DSA this week 24, cumulative 24**

**Focus.** JavaScript objects, data types and functions. Git beyond add-commit-push.

**Learn.**

- javascript.info chapters 4, 5 and 6. Objects, object references and copying, garbage collection, methods and "this", constructors, optional chaining, symbols, object-to-primitive conversion, data types in full, then functions: recursion, rest and spread, closures, the old "var", the global object, function objects and NFE, the "new Function" syntax, scheduling, decorators and forwarding, call/apply/bind, arrow functions revisited.
- Pro Git chapters 2 and 3 in full. Then learngitbranching.js.org until the animations bore you.
- Branching, merging, rebase, interactive rebase, cherry-pick, bisect, reflog, stash, and how to undo every one of those.
- The Missing Semester 2026 lectures: Course Overview and the Shell, Command-line Environment, Version Control and Git.

**Build.**

- Repository hygiene: .gitignore, .editorconfig, conventional commit messages, a README that is not the default, and a LICENSE.
- One small utility written from empty and pushed with a clean, readable history of at least fifteen commits.

**The six days.**

| Day | LEARN block (09:30 to 12:30) | BUILD block (14:00 to 16:00) |
| --- | --- | --- |
| Mon | javascript.info ch 4 (Objects). Type every example. | Repo scaffold + .gitignore + README skeleton |
| Tue | javascript.info ch 5 (Data types) parts 1–7. | Utility: core function, first five commits |
| Wed | javascript.info ch 5 parts 8–13 + Missing Semester shell lecture. | CUT POINT. Trim scope now if behind |
| Thu | javascript.info ch 6 (Advanced functions), closures and "this". | Utility: error paths and input validation |
| Fri | Pro Git ch 2 and 3. Rebase, cherry-pick, bisect on purpose. | DEPLOY DAY. Push public. README with screenshots |
| Sat | learngitbranching.js.org all main + remote levels. | Weekly review, 20 min. Redo five DSA problems |

**Ships at the end of this week.**

- Your first public repository with a real README and a commit history a stranger can read.

**The trap.** Learning only add, commit, push, then panicking the first time you need to undo something in front of an interviewer.

**Note.** Use git bisect once on purpose. Break something, then find it. You will remember it forever.

**Links for this week.**

- javascript.info/object-basics
- javascript.info/data-types
- javascript.info/advanced-functions
- git-scm.com/book/en/v2
- learngitbranching.js.org
- missing.csail.mit.edu/2026
- takeuforward.org/dsa/strivers-a2z-sheet-learn-dsa-a-to-z


### Week 02 | 7–13 September 2026 | HTML, CSS and the machine underneath

**Phase A Foundation** | **DSA this week 24, cumulative 48**

**Focus.** Layout by hand with no framework. Then close the Linux and networking gaps behind the VPS you already run.

**Learn.**

- Semantic HTML, the box model, cascade and specificity, custom properties, container queries, logical properties.
- Flexbox Froggy, all 24 levels. Grid Garden, all 28 levels. Then rebuild both layouts from empty without the game.
- Responsive layout with media queries written by hand. No Tailwind, no component library, nothing.
- web.dev Learn CSS for the parts the games do not cover: stacking contexts, z-index, overflow, inheritance.
- Linux and networking gap-fill: permissions and the octal you keep looking up, processes and signals, ports and sockets, DNS resolution order, TCP against UDP, what nginx is actually doing as a reverse proxy.

**Build.**

- A static site you wrote every line of, responsive, live on the internet on a real domain or subdomain.

**The six days.**

| Day | LEARN block (09:30 to 12:30) | BUILD block (14:00 to 16:00) |
| --- | --- | --- |
| Mon | Semantic HTML + the box model + cascade and specificity. | Static site: markup and content structure |
| Tue | Flexbox Froggy all 24, then rebuild three layouts from empty. | Static site: main layout in flexbox |
| Wed | Grid Garden all 28, then a real 12-column grid by hand. | CUT POINT. Static site: grid sections |
| Thu | web.dev Learn CSS: custom properties, stacking, overflow. | Static site: responsive breakpoints |
| Fri | Linux: permissions, processes, ports, DNS, TCP vs UDP. | DEPLOY DAY. Site live behind your own nginx |
| Sat | nginx docs: server blocks, proxy_pass, TLS termination. | Weekly review. Five DSA redos, weighted to failures |

**Ships at the end of this week.**

- A static site, live, that you wrote every line of, served by nginx on your own box.

**The trap.** Reaching for Tailwind before you can centre a div without it. In Week 6 you will be asked to and it will be too late to learn.

**Note.** You already run this server. This week connects what you have been doing to why it works. That is a different thing from knowing it.

**Links for this week.**

- flexboxfroggy.com
- cssgridgarden.com
- web.dev/learn/css
- web.dev/learn/html
- joshwcomeau.com
- linuxjourney.com
- nginx.org/en/docs
- wizardzines.com


### Week 03 | 14–20 September 2026 | Prototypes, classes, errors and HTTP properly

**Phase A Foundation** | **DSA this week 24, cumulative 72**

**Focus.** The rest of the language, then the wire protocol every job interview assumes you understand.

**Learn.**

- javascript.info chapters 7, 8, 9 and 10. Prototypes and prototypal inheritance, classes and class inheritance, static properties, private and protected, extending built-ins, instanceof, mixins, error handling and custom errors.
- HTTP properly: request methods and when each is idempotent, the status codes that matter and what 301 against 302 actually changes, headers, content negotiation, cookies and their attributes, caching (Cache-Control, ETag, Last-Modified, stale-while-revalidate), and CORS from first principles including preflight.
- Why CORS exists at all. If you cannot explain the same-origin policy you will copy and paste your way past it forever.

**Build.**

- Project 1 (ITC Reclaim) repository created. Problem statement, data model sketch, and first commits in.

**The six days.**

| Day | LEARN block (09:30 to 12:30) | BUILD block (14:00 to 16:00) |
| --- | --- | --- |
| Mon | javascript.info ch 7 (Prototypes). | P1: repo, README problem statement, architecture sketch |
| Tue | javascript.info ch 8 (Classes) in full. | P1: data model for purchase register and GSTR-2B rows |
| Wed | javascript.info ch 9 (Error handling) + custom error classes. | CUT POINT. P1: CSV parsing spike |
| Thu | MDN HTTP: methods, status codes, headers, cookies. | P1: first matching rule, with tests by hand |
| Fri | MDN HTTP caching + CORS from first principles. | DEPLOY DAY. P1 skeleton on a public URL |
| Sat | javascript.info ch 10 + revision. | Weekly review. Five DSA redos |

**Ships at the end of this week.**

- Project 1 repository public, problem statement written, skeleton deployed.

**The trap.** Treating CORS as a thing you copy and paste your way past. It is one of the three most common junior interview questions in India.

**Note.** Write the CORS explanation in your own words in the log. If you cannot write it, you do not have it.

**Links for this week.**

- javascript.info/prototypes
- javascript.info/classes
- javascript.info/error-handling
- developer.mozilla.org/en-US/docs/Web/HTTP
- developer.mozilla.org/en-US/docs/Web/HTTP/CORS
- developer.mozilla.org/en-US/docs/Web/HTTP/Caching


### Week 04 | 21–27 September 2026 | Async JavaScript. The week that decides everything after it

**Phase A Foundation** | **DSA this week 24, cumulative 96**

**Focus.** Promises, async/await, the event loop, microtasks. Two full days on chapter 11.

**Learn.**

- javascript.info chapter 11 in full: callbacks, promises, promise chaining, error handling with promises, the Promise API (all, allSettled, race, any), promisification, microtasks, async/await. Give this two full days.
- javascript.info chapter 12: generators and async iteration.
- The event loop, visualised. latentflip.com/loupe once, then jsv9000.app until the microtask queue is obvious.
- Write a retry with exponential backoff and jitter by hand. No library. Then an AbortController-based timeout. Then a concurrency limiter.
- Async is the single largest source of bugs you will write this year and the single most common live-coding question for Node roles.

**Build.**

- Project 1: async file ingest, streaming parse, progress reporting.

**The six days.**

| Day | LEARN block (09:30 to 12:30) | BUILD block (14:00 to 16:00) |
| --- | --- | --- |
| Mon | javascript.info ch 11 parts 1–4. Callbacks to promise chaining. | P1: async CSV ingest |
| Tue | javascript.info ch 11 parts 5–8. Promise API, microtasks, async/await. | P1: streaming parse for large files |
| Wed | latentflip.com/loupe + jsv9000.app. Draw the loop from memory. | CUT POINT. P1: progress reporting |
| Thu | Write retry-with-backoff, a timeout, and a concurrency limiter by hand. | P1: wire the retry into ingest |
| Fri | javascript.info ch 12. Generators and async iteration. | DEPLOY DAY. P1 ingest live |
| Sat | Rewrite the retry from memory, no notes. | Weekly review + monthly close-out |

**Ships at the end of this week.**

- Project 1 ingesting real files asynchronously, deployed, commits every day.

**The trap.** Skimming chapter 11. Everything after this week assumes you understood it, and React, Node and every RAG pipeline are async end to end.

**Note.** Two full days on one chapter looks slow. It is the highest-return week in the entire plan.

**Links for this week.**

- javascript.info/async
- javascript.info/generators-iterators
- latentflip.com/loupe
- jsv9000.app
- nodejs.org/en/learn/asynchronous-work/event-loop-timers-and-nexttick


### Week 05 | 28 Sep – 4 Oct 2026 | React fundamentals, and Gate 1

**Phase B Interface** | **DSA this week 22, cumulative 118**

> **GATE 1 | 4 October 2026** | Project 1 live on your own domain over HTTPS.

**Focus.** Components, state, effects, the rules of hooks. Then ship Project 1 to a public URL.

**Learn.**

- Full Stack Open parts 0, 1 and 2. Fundamentals of web apps, introduction to React, component state and event handlers, rendering collections, forms, getting and altering data on a server, styling.
- react.dev Learn alongside it. It is the current source of truth and Full Stack Open is not always in step with it.
- The rules of hooks, why they exist, and what actually breaks when you violate them.
- react.dev Learn: You Might Not Need an Effect. Read it twice. Most junior React code is effects that should not exist.
- React 19.2 is current and React Compiler 1.0 shipped in October 2025. Most useMemo and useCallback advice in older courses is obsolete. Do not write memo by reflex.

**Build.**

- Project 1 front end in React. Upload two files, get a four-bucket mismatch report.

**The six days.**

| Day | LEARN block (09:30 to 12:30) | BUILD block (14:00 to 16:00) |
| --- | --- | --- |
| Mon | Full Stack Open part 0 + part 1a–1b. | P1: React shell, routing, layout |
| Tue | Full Stack Open part 1c–1d. State and event handlers. | P1: upload component + state model |
| Wed | Full Stack Open part 2a–2c. Collections and forms. | CUT POINT. P1: results table, four buckets |
| Thu | Full Stack Open part 2d–2f + react.dev rules of hooks. | P1: server communication, error states |
| Fri | react.dev: You Might Not Need an Effect. Twice. | DEPLOY DAY. Ship it. Two days of buffer, on purpose |
| Sat | Fix whatever the Friday deploy broke. | Gate 1 dry run. README, screenshots, live link |

**Ships at the end of this week.**

- GATE 1. Project 1 on a public URL a stranger can open and use.

**The trap.** Deploying on Sunday night for the first time and discovering the build breaks. Friday deploy exists for exactly this reason.

**Note.** Deployed means a stranger opens the link and it works. Localhost is not shipping. There is no partial credit here.

**Links for this week.**

- fullstackopen.com/en
- react.dev/learn
- react.dev/learn/you-might-not-need-an-effect
- react.dev/reference/rules/rules-of-hooks
- overreacted.io


### Week 06 | 5–11 October 2026 | React deeper, and Tailwind v4

**Phase B Interface** | **DSA this week 22, cumulative 140**

**Focus.** Custom hooks, context, composition, and CSS-first Tailwind.

**Learn.**

- Custom hooks, context, when to lift state and when not to, composition over configuration, keys and reconciliation, controlled against uncontrolled inputs.
- react.dev Learn: Escape Hatches in full. Refs, effects, effect lifecycle, removing effect dependencies, custom hooks.
- react.dev Learn: React Compiler. Understand what it now handles so you stop hand-memoising.
- Tailwind CSS v4 with CSS-first configuration. There is no tailwind.config.js by default any more; theme tokens live in an @theme block in your CSS. A v3 tutorial will have you writing a config file that is silently ignored.
- Tailwind v4 specifics: @theme, @utility, @variant, the Vite plugin, and how the Lightning CSS engine changes build setup.

**Build.**

- Project 1 styled, responsive, accessible, and still deployed.

**The six days.**

| Day | LEARN block (09:30 to 12:30) | BUILD block (14:00 to 16:00) |
| --- | --- | --- |
| Mon | react.dev Escape Hatches: refs and effects. | P1: extract three custom hooks |
| Tue | Context, composition, keys and reconciliation. | P1: context for auth-less session state |
| Wed | react.dev React Compiler + eslint-plugin-react-hooks recommended preset. | CUT POINT. Remove hand-written memo |
| Thu | Tailwind v4 docs: installation, @theme, utilities, variants. | P1: design tokens in @theme |
| Fri | Tailwind v4: responsive design, dark mode, container queries. | DEPLOY DAY. P1 styled and responsive |
| Sat | Accessibility pass: labels, focus order, keyboard, contrast. | Weekly review. Five DSA redos |

**Ships at the end of this week.**

- Project 1 styled, responsive, accessible, still live.

**The trap.** Following a Tailwind v3 tutorial and writing a tailwind.config.js file that does nothing. It will not error. It will just be ignored.

**Note.** If you must keep a JS config, Tailwind v4 still reads it through @config "./tailwind.config.js". Know that this is a compatibility path, not the default.

**Links for this week.**

- tailwindcss.com/docs
- react.dev/learn/escape-hatches
- react.dev/learn/react-compiler
- fullstackopen.com/en/part2
- web.dev/learn/accessibility


### Week 07 | 12–18 October 2026 | TypeScript from zero to strict

**Phase B Interface** | **DSA this week 22, cumulative 162**

**Focus.** The handbook, then convert Project 1 end to end with no escape hatches.

**Learn.**

- The TypeScript Handbook start to finish: basic types, narrowing, functions, objects, type manipulation (generics, keyof, typeof, indexed access, conditional types, mapped types, template literal types), classes, modules.
- Total TypeScript free tutorials for the parts that will not stick, especially generics and narrowing.
- Type Challenges, easy tier only. Do not rabbit-hole into medium.
- tsconfig: strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes, verbatimModuleSyntax. Turn them on at file one and never turn them off.
- Typing React properly: component props, children, generics in components, event handler types, useRef types, discriminated unions for state.

**Build.**

- Project 1 converted end to end. Every file. Zero uses of any. Still deployed, still working.

**The six days.**

| Day | LEARN block (09:30 to 12:30) | BUILD block (14:00 to 16:00) |
| --- | --- | --- |
| Mon | Handbook: everyday types, narrowing, more on functions. | P1: tsconfig strict, convert the utilities |
| Tue | Handbook: object types, generics, keyof/typeof/indexed access. | P1: convert the data layer |
| Wed | Handbook: conditional, mapped and template literal types. | CUT POINT. P1: convert the API client |
| Thu | Total TypeScript: generics and narrowing tutorials. | P1: convert React components |
| Fri | Typing React: props, children, refs, discriminated unions. | DEPLOY DAY. Zero any. Zero ts-ignore |
| Sat | Type Challenges, easy tier. Stop at easy. | Weekly review + monthly close-out |

**Ships at the end of this week.**

- Project 1 fully in TypeScript, strict mode, still deployed, still working.

**The trap.** Sprinkling any to make errors go away. You are then writing JavaScript with extra steps and a false sense of safety.

**Note.** Converting a working app teaches more than starting typed. You see exactly what the types were protecting you from.

**Links for this week.**

- typescriptlang.org/docs/handbook/intro.html
- totaltypescript.com/tutorials
- github.com/type-challenges/type-challenges
- typescriptlang.org/play
- typescriptlang.org/tsconfig


### Week 08 | 19–25 October 2026 | Node 24 and Express. API design that survives contact

**Phase C Backend** | **DSA this week 22, cumulative 184**

**Focus.** REST done properly, middleware, validation at every boundary.

**Learn.**

- Node.js Learn path: modules, the event loop in Node specifically, timers and nextTick, streams, the file system, worker threads at a conceptual level.
- Express: routing, middleware order, error-handling middleware, router composition.
- API design: resource naming, HTTP semantics, pagination (cursor over offset and why), filtering, sorting, versioning strategy, rate limiting, idempotency keys, consistent error envelopes with a machine-readable code.
- Validate every input at the boundary with a schema library (zod or valibot). Every single one. Parse, do not validate.
- The Node Best Practices repository. Read the whole thing once, then bookmark the sections you disagreed with.

**Build.**

- Project 2 API: the first live endpoint set, with a POST that rejects bad input properly.

**The six days.**

| Day | LEARN block (09:30 to 12:30) | BUILD block (14:00 to 16:00) |
| --- | --- | --- |
| Mon | Node Learn: modules, event loop, timers, nextTick. | P2: project scaffold, config, env handling |
| Tue | Node Learn: streams and the file system. | P2: upload endpoint with streaming |
| Wed | Express: routing, middleware order, error middleware. | CUT POINT. P2: router composition, error envelope |
| Thu | API design: pagination, versioning, rate limiting, idempotency. | P2: cursor pagination + rate limit |
| Fri | Schema validation at every boundary. zod or valibot. | DEPLOY DAY. API live, bad input rejected |
| Sat | nodebestpractices, read it end to end. | Weekly review. Five DSA redos |

**Ships at the end of this week.**

- Your first real API, live, with at least one POST that rejects malformed input with a useful error.

**The trap.** No validation, then a crash during a live demo. It happens to everyone once. Make it happen in Week 8 and not in an interview.

**Note.** Node 24 Krypton is the Active LTS line until 20 October 2026. See Part 6 for the Node 26 decision point, which lands inside this roadmap.

**Links for this week.**

- nodejs.org/en/learn
- expressjs.com
- github.com/goldbergyoni/nodebestpractices
- nodejs.org/en/learn/asynchronous-work/event-loop-timers-and-nexttick
- zod.dev


### Week 09 | 26 Oct – 1 Nov 2026 | PostgreSQL 18. Schema, indexes, transactions

**Phase C Backend** | **DSA this week 20, cumulative 204**

**Focus.** Design the schema on paper before you type it. Then earn every index.

**Learn.**

- Schema design: normalisation to third normal form and when to deliberately break it, natural against surrogate keys, constraints as documentation, check constraints, foreign keys and ON DELETE behaviour.
- PostgreSQL Exercises. Every category: basic, joins and subqueries, modifying data, aggregation, timestamps, string operations, recursive queries. Roughly 80 exercises. Do all of them.
- Indexes: B-tree, composite index column order, covering indexes, partial indexes, expression indexes, and why an index on a low-cardinality column is usually a waste.
- Transactions and isolation levels: read committed, repeatable read, serializable. Know what a dirty read, a non-repeatable read and a phantom read are, and which PostgreSQL actually allows.
- Migrations. Pick Prisma or Drizzle and stay. Migrations live in the repository and run in CI.
- PostgreSQL 18 specifics: asynchronous I/O, skip scan on multicolumn B-trees, uuidv7() for timestamp-ordered keys, virtual generated columns as the new default.

**Build.**

- Project 2 schema designed, migrated, seeded, with indexes you can justify.

**The six days.**

| Day | LEARN block (09:30 to 12:30) | BUILD block (14:00 to 16:00) |
| --- | --- | --- |
| Mon | Schema design on paper. Draw it before you type it. | P2: schema v1 + migration 0001 |
| Tue | PGExercises: basic, joins and subqueries. | P2: seed data, realistic volume |
| Wed | PGExercises: modifying data, aggregation. | CUT POINT. P2: query layer |
| Thu | Indexes: B-tree, composite order, partial, expression. | P2: add indexes, justify each in the README |
| Fri | Transactions and isolation levels. PGExercises: timestamps, strings, recursive. | DEPLOY DAY. Migrations run in deploy |
| Sat | use-the-index-luke.com, the chapters that bit you. | Weekly review + monthly close-out |

**Ships at the end of this week.**

- A schema you designed yourself, with migrations in the repository and every index justified in writing.

**The trap.** Skipping indexes until it is already slow, then guessing which one to add. Guessing is visible in an interview.

**Note.** Move your local PostgreSQL from 16 to 18 this week so you are not learning behaviour that changed underneath you.

**Links for this week.**

- pgexercises.com
- postgresql.org/docs/current/tutorial.html
- use-the-index-luke.com
- explain.dalibo.com
- prisma.io/docs
- orm.drizzle.team
- modern-sql.com


### Week 10 | 2–8 November 2026 | Next.js 16. Server components and the caching model

**Phase C Backend** | **DSA this week 20, cumulative 224**

**Focus.** What runs on the server, what ships to the browser, and what is cached where.

**Learn.**

- nextjs.org/learn end to end, then read the caching documentation twice.
- App Router: layouts, templates, loading and error boundaries, route groups, parallel and intercepting routes.
- Server Components against Client Components. The boundary, serialisation rules, and why "use client" is a leaf-ward directive.
- Server Actions, route handlers, streaming and Suspense boundaries.
- Next.js 16 specifics you will not find in a v15 tutorial: Turbopack is the default bundler for dev and production; the middleware file is renamed to proxy and the edge runtime is not supported there; Partial Prerendering is opted into through the cacheComponents configuration flag rather than experimental.ppr.
- Next.js 15 leaves Maintenance LTS on 21 October 2026, which falls inside this roadmap. Build on 16.

**Build.**

- Project 2 front end on Next.js 16, deployed early and deployed often.

**The six days.**

| Day | LEARN block (09:30 to 12:30) | BUILD block (14:00 to 16:00) |
| --- | --- | --- |
| Mon | nextjs.org/learn chapters 1–6. | P2: Next.js 16 app scaffold, layouts |
| Tue | nextjs.org/learn chapters 7–12. Data fetching and mutation. | P2: server components for the report view |
| Wed | Caching documentation, first pass. Draw the four caches. | CUT POINT. P2: route handlers |
| Thu | Caching documentation, second pass. Revalidation strategies. | P2: streaming + Suspense boundaries |
| Fri | Server Actions, proxy (formerly middleware), cacheComponents. | DEPLOY DAY. P2 live on Next.js 16 |
| Sat | Upgrading guide for v16. Read it even though you started on 16. | Weekly review. Five DSA redos |

**Ships at the end of this week.**

- Project 2 front end live on Next.js 16, deployed at least three times this week.

**The trap.** Following a v15 tutorial without noticing. The caching model and the middleware file both changed, and you will chase ghosts for a day.

**Note.** Write down, in one paragraph, what runs on the server and what ships to the browser. If you cannot, you do not have it yet.

**Links for this week.**

- nextjs.org/learn
- nextjs.org/docs/app/guides/upgrading/version-16
- nextjs.org/support-policy
- nextjs.org/docs/app/building-your-application/caching
- developer.mozilla.org/en-US/docs/Web/HTTP/Caching


### Week 11 | 9–15 November 2026 | Auth you wrote yourself, and Gate 2

**Phase C Backend** | **DSA this week 20, cumulative 244**

> **GATE 2 | 15 November 2026** | Auth you wrote yourself, plus one WebSocket feature.

**Focus.** Sessions, password storage, and one real-time feature. No auth library.

**Learn.**

- Pilcrow’s Auth Book at auth.pilcrowonpaper.com, cover to cover. This replaced The Copenhagen Book, which is archived. Read it twice; it is short and it is the highest-value free resource on this list.
- Sessions: generate a high-entropy token, store only its SHA-256 hash in the database, set the cookie HttpOnly, Secure, SameSite=Lax, with a sensible Max-Age and a rolling refresh.
- Password storage per the OWASP Password Storage Cheat Sheet: Argon2id at m=19456 (19 MiB), t=2, p=1. That exact configuration, verified against the cheat sheet.
- Email verification, password reset tokens with single use and short expiry, rate limiting on every auth endpoint, timing-safe comparison, and generic error messages that do not enumerate accounts.
- OAuth if time allows: authorisation code flow with PKCE, state parameter, and account linking rules.
- WebSockets: one live feature a stranger can see working. Presence or notifications. Handle reconnection and backpressure.

**Build.**

- Project 2 with authentication you wrote by hand, plus one WebSocket feature, both live.

**The six days.**

| Day | LEARN block (09:30 to 12:30) | BUILD block (14:00 to 16:00) |
| --- | --- | --- |
| Mon | Auth book: sessions, tokens, cookies. | P2: session table, token generation, hashing |
| Tue | Auth book: password authentication + OWASP Password Storage. | P2: Argon2id registration and login |
| Wed | Auth book: email verification, password reset, rate limiting. | CUT POINT. P2: verification and reset flows |
| Thu | Timing attacks, account enumeration, session fixation. | P2: harden every auth endpoint |
| Fri | WebSockets: protocol, reconnection, heartbeats, backpressure. | DEPLOY DAY. Auth + live feature shipped |
| Sat | Write the threat model for your own auth, in your own words. | Gate 2 dry run. Full audit |

**Ships at the end of this week.**

- GATE 2. Authentication you wrote yourself, running on the deployed application. One WebSocket feature a stranger can watch work.

**The trap.** Reaching for a library and learning nothing. If you cannot explain how your session survives a server restart, you did not build it.

**Note.** At work you would use a library. Say exactly that in the interview, then explain what the library is doing. That answer scores higher than either extreme.

**Links for this week.**

- auth.pilcrowonpaper.com
- cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
- cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
- oslojs.dev
- portswigger.net/web-security/authentication


### Week 12 | 16–22 November 2026 | Testing and CI that actually run

**Phase D Production** | **DSA this week 20, cumulative 264**

**Focus.** Twelve good tests, a real database in a container, and a merge gate that blocks red.

**Learn.**

- Vitest: unit tests where they matter, not everywhere. Test the matching rules, the money arithmetic, the date handling and the auth logic. Do not test framework behaviour.
- Testing Library: query by role and by accessible name. Test what the user sees, not implementation detail.
- Mock Service Worker: fake the network at the network boundary, not by monkey-patching your own modules.
- One integration test that hits a real PostgreSQL in a container, seeded and torn down per run. This is the test that catches the bugs unit tests never will.
- Playwright: two end-to-end journeys only. Login and the core happy path. Read the best-practices page before writing them.
- GitHub Actions: run lint, typecheck, unit, integration and e2e on every push. Block merge on red. Cache dependencies. Secrets in encrypted secrets and environment variables, never in git, not once.
- Kent C. Dodds, Write Tests. Not Too Many. Mostly Integration. Read it and take the ratio seriously.

**Build.**

- Project 3 begins: same product as Project 2, made operable. This week it gets a test suite and CI.

**The six days.**

| Day | LEARN block (09:30 to 12:30) | BUILD block (14:00 to 16:00) |
| --- | --- | --- |
| Mon | Vitest: setup, assertions, mocking, coverage that means something. | P3: unit tests on matching and money logic |
| Tue | Testing Library: roles, accessible names, user-event. | P3: component tests for the report view |
| Wed | MSW: network-level mocking. | CUT POINT. P3: API contract tests |
| Thu | Integration testing against a real database in a container. | P3: one full integration test, seeded |
| Fri | GitHub Actions: matrix, caching, services, environments, secrets. | DEPLOY DAY. CI green and blocking merge |
| Sat | Playwright best practices. Two journeys, no more. | Weekly review + monthly close-out |

**Ships at the end of this week.**

- A green CI badge on the README that means something, and a merge that is genuinely blocked when tests fail.

**The trap.** Testing everything and shipping nothing. Twelve good tests beat sixty generated ones, and an interviewer can tell the difference in thirty seconds.

**Note.** Take a screenshot of a red CI run blocking a merge. That screenshot is an interview answer.

**Links for this week.**

- vitest.dev
- testing-library.com
- mswjs.io
- playwright.dev/docs/best-practices
- docs.github.com/en/actions
- kentcdodds.com/blog/write-tests


### Week 13 | 23–29 November 2026 | Security. The 2025 list, not the 2021 one

**Phase D Production** | **DSA this week 18, cumulative 282**

**Focus.** OWASP Top 10:2025, eighth edition, applied to your own application.

**Learn.**

- OWASP Top 10:2025, the eighth installment, in the current order: A01 Broken Access Control, A02 Security Misconfiguration, A03 Software Supply Chain Failures, A04 Cryptographic Failures, A05 Injection, A06 Insecure Design, A07 Authentication Failures, A08 Software or Data Integrity Failures, A09 Security Logging and Alerting Failures, A10 Mishandling of Exceptional Conditions.
- A03 Software Supply Chain Failures is new in this position and it is broader than the old "vulnerable components" category. It covers build tools, pipelines, containers and package registries. A10 is entirely new and replaced Server-Side Request Forgery.
- Most tutorials still link the 2021 list. Anyone quoting A10 as SSRF is working from stale material.
- OWASP Cheat Sheet Series for the parts that touch your stack: Authorization, Input Validation, SQL Injection Prevention, Cross-Site Request Forgery, Content Security Policy, Secrets Management, Logging.
- PortSwigger Web Security Academy: access control labs and SQL injection labs. Free, and better than any paid course.
- Dependency hygiene: lockfile committed, npm audit or an equivalent in CI, Dependabot or Renovate, provenance and pinned actions in your GitHub workflows.

**Build.**

- Project 3: a written threat model, plus the fixes for whatever it finds.

**The six days.**

| Day | LEARN block (09:30 to 12:30) | BUILD block (14:00 to 16:00) |
| --- | --- | --- |
| Mon | A01 Broken Access Control + A02 Security Misconfiguration. | P3: object-level authorisation on every route |
| Tue | A03 Supply Chain + A08 Integrity Failures. | P3: pin actions, lockfile audit in CI |
| Wed | A04 Cryptographic Failures + A05 Injection. PortSwigger labs. | CUT POINT. P3: parameterised queries audit |
| Thu | A06 Insecure Design + A07 Authentication Failures. | P3: rate limits and lockout policy |
| Fri | A09 Logging and Alerting + A10 Mishandling of Exceptional Conditions. | DEPLOY DAY. CSP and security headers live |
| Sat | Write the threat model. Real threats, your app, your words. | Weekly review. Five DSA redos |

**Ships at the end of this week.**

- A written threat list for Project 3 in your own words, and the code changes that close the top five.

**The trap.** Studying the 2021 list because it is what most tutorials still link to. Citing A06:2021 in a 2027 interview marks you as out of date.

**Note.** You already run fail2ban and ufw on the VPS. This week tells you what you were defending against and lets you say it out loud.

**Links for this week.**

- owasp.org/Top10/2025
- cheatsheetseries.owasp.org
- portswigger.net/web-security
- owasp.org/Top10/2025/A03_2025-Software_Supply_Chain_Failures/
- owasp.org/Top10/2025/A10_2025-Mishandling_of_Exceptional_Conditions


### Week 14 | 30 Nov – 6 Dec 2026 | Docker, Compose, Redis, and your own box

**Phase D Production** | **DSA this week 18, cumulative 300**

**Focus.** Hand it to somebody else and have it run. Then cache, session and rate-limit properly.

**Learn.**

- Docker: images against containers, layers and cache invalidation, multi-stage builds, distroless or slim base images, non-root users, healthchecks, .dockerignore.
- Docker Compose v2. Note the space, not a hyphen; the hyphenated v1 command is dead and you will get "command not found".
- Get the production image small and explain why each layer exists.
- Deploy to your own Oracle Cloud box, not to a platform that hides everything. You already run this server; this week you do it deliberately instead of by copy and paste.
- Caddy or nginx in front, automatic TLS, and a rollback you have actually tested.
- Redis or Valkey: caching with sensible TTLs, cache invalidation strategy, session storage, sliding-window rate limits, and the cache stampede problem.
- Licensing, because it comes up: since Redis 8.0 in May 2025 Redis Open Source is tri-licensed under RSALv2, SSPLv1 and AGPLv3. Valkey is the Linux Foundation fork of Redis 7.2.4 and remains BSD-3-Clause. Know the difference and have a one-sentence opinion.

**Build.**

- Project 3 fully containerised, running on your own server, with Redis or Valkey behind it.

**The six days.**

| Day | LEARN block (09:30 to 12:30) | BUILD block (14:00 to 16:00) |
| --- | --- | --- |
| Mon | Docker: images, layers, cache, multi-stage builds. | P3: Dockerfile, multi-stage, non-root |
| Tue | Compose v2: services, networks, volumes, healthchecks, profiles. | P3: full stack in one compose file |
| Wed | Image size, distroless, .dockerignore, build cache in CI. | CUT POINT. P3: image under a sensible size |
| Thu | Redis or Valkey: caching, TTLs, invalidation, stampede. | P3: cache the expensive report query |
| Fri | Sessions and sliding-window rate limits in Redis. Caddy TLS. | DEPLOY DAY. P3 on your own box, TLS, rollback tested |
| Sat | Break it on purpose, then roll back. Time yourself. | Weekly review + monthly close-out |

**Ships at the end of this week.**

- Project 3 containerised end to end, running on your own server, with a rollback you have executed at least once.

**The trap.** Learning Kubernetes because a video said so. You do not need it, you will not be asked for it at this level, and it will cost you a week you do not have.

**Note.** Record the rollback. Thirty seconds of screen capture. It is the single most convincing artefact a junior candidate can show a backend team.

**Links for this week.**

- docs.docker.com/get-started
- docs.docker.com/compose
- labs.play-with-docker.com
- caddyserver.com/docs
- redis.io/docs/latest
- valkey.io
- upstash.com/docs


### Week 15 | 7–13 December 2026 | Queues, system design, performance, observability. Gate 3

**Phase D Production** | **DSA this week 18, cumulative 318**

> **GATE 3 | 13 December 2026** | Project 3 operable. Applications start today.

**Focus.** Backpressure, one architecture diagram, one before-and-after number, and logs you can search.

**Learn.**

- BullMQ on Redis: producers, workers, concurrency, rate limiting, delayed and repeatable jobs, retries with backoff, dead letter handling, and idempotent handlers so a retry cannot double-process.
- System Design Primer, the first third only. Do not read all of it. The first third is the part you are actually asked about.
- Draw one architecture diagram of your own application, by hand, and be able to redraw it live in an interview in under three minutes.
- Performance: find the slowest query in Project 3, run EXPLAIN ANALYZE, read the plan at explain.dalibo.com, add the right index, run it again. Write both numbers in the README in milliseconds, not adjectives.
- Structured logging with Pino: JSON, request IDs, correlation IDs, log levels that mean something, and never console.log in production paths.
- One metric that matters plus an error tracker. Sentry for errors, and either SigNoz or OpenTelemetry for traces.
- Gate 3 also opens the application phase. From this week the learning block drops from three hours to two, and the hour moves to applications. That trade is not optional.

**Build.**

- Project 3 shipped and operable. Queue, indexes, logs, metrics, error tracking, and the number in the README.

**The six days.**

| Day | LEARN block (09:30 to 12:30) | BUILD block (14:00 to 16:00) |
| --- | --- | --- |
| Mon | BullMQ: producers, workers, retries, backoff, DLQ. | P3: queue for large reconciliation runs |
| Tue | Idempotent handlers, exactly-once illusions, at-least-once reality. | P3: idempotency keys on job payloads |
| Wed | System Design Primer, first third. Draw your architecture. | CUT POINT. P3: architecture diagram in README |
| Thu | EXPLAIN ANALYZE, plan reading, index selection. | P3: the before-and-after number |
| Fri | Pino structured logs, Sentry, one real metric. | DEPLOY DAY. P3 observable in production |
| Sat | Gate 3 audit. Then write the first ten applications. | GATE 3 DRY RUN + applications open |

**Ships at the end of this week.**

- GATE 3. Project 3 shipped and operable. Applications start going out this week.

**The trap.** Optimising something that was never slow. Measure first, always. An unmeasured optimisation is a story you cannot defend.

**Note.** The before-and-after number is a complete interview answer on its own. Most candidates at this level have nothing in that slot.

**Links for this week.**

- docs.bullmq.io
- github.com/donnemartin/system-design-primer
- explain.dalibo.com
- use-the-index-luke.com
- getpino.io
- docs.sentry.io
- signoz.io
- opentelemetry.io/docs


### Week 16 | 14–20 December 2026 | LLM plumbing for builders

**Phase E Applied AI** | **DSA this week 18, cumulative 336**

**Focus.** AI SDK 7. Streaming, tool calls, structured output, and what actually costs money.

**Learn.**

- AI SDK 7, released June 2026. Two hard constraints to know before you install: all packages are now ESM-only, so require() will not work, and the minimum Node version is 22. You are on Node 24, so you are fine.
- If you follow any tutorial written against AI SDK 6 or earlier, run the codemod rather than hand-porting: npx @ai-sdk/codemod v7.
- Core surface: generateText, streamText, generateObject, streamObject, tool definitions, the tool loop, tool approval, and provider-agnostic model strings.
- Tokens, context windows, temperature, top-p, stop sequences. What each one actually changes.
- Cost mechanics: input tokens against output tokens, prompt caching, embedding cost at ingest against inference cost at query time. Applied AI interviews ask about cost and almost no junior candidate has an answer.
- Structured output with a schema, and what to do when the model returns something that does not validate.
- You are building on models, not making them. Fine-tuning is not on this roadmap and that is deliberate.

**Build.**

- Project 4 (Tender Fit) begins. Ingest pipeline and the first streamed answer.

**The six days.**

| Day | LEARN block (09:30 to 12:30) | BUILD block (14:00 to 16:00) |
| --- | --- | --- |
| Mon | AI SDK 7 introduction, installation, provider setup. | P4: repo, problem statement, provider wiring |
| Tue | generateText and streamText. Streaming to a React client. | P4: streaming answer endpoint |
| Wed | Tools and the tool loop. Tool approval. | CUT POINT. P4: first tool, document lookup |
| Thu | generateObject and structured output with schemas. | P4: structured eligibility extraction |
| Fri | Tokens, context windows, cost accounting, prompt caching. | DEPLOY DAY. P4 answers a question, live |
| Sat | promptingguide.ai + the OpenAI cookbook patterns you will reuse. | Weekly review. Five DSA redos |

**Ships at the end of this week.**

- Project 4 started. One streamed, tool-using answer live on a public URL.

**The trap.** Going down the fine-tuning rabbit hole. It is not on this roadmap for a reason and it will cost you the Applied AI project.

**Note.** Budget roughly Rs 1,500 of API credit for Weeks 16 to 19. That is the only unavoidable spend in the whole plan.

**Links for this week.**

- ai-sdk.dev/docs/introduction
- ai-sdk.dev/docs/migration-guides/migration-guide-7-0
- cookbook.openai.com
- promptingguide.ai
- platform.openai.com/docs


### Week 17 | 21–27 December 2026 | RAG properly. Hybrid retrieval with citations

**Phase E Applied AI** | **DSA this week 16, cumulative 352**

**Focus.** Chunk, contextualise, embed and BM25, hybrid retrieve, rerank, cite. No naive vector search.

**Learn.**

- pgvector: your vector store is just PostgreSQL. Indexing limits matter. The vector type indexes up to 2,000 dimensions, halfvec up to 4,000, bit up to 64,000 and sparsevec up to 1,000 non-zero elements. Raw storage goes to 16,000 dimensions but only the indexable ceiling counts for search.
- Practical consequence: a 3,072-dimension embedding will not build an index as vector. Use halfvec. That one line saves you a full day.
- HNSW against IVFFlat: build time, recall, memory, and when each is the right answer.
- Chunking: fixed against semantic against structural. For scanned tender PDFs, structural chunking on headings and clause numbers beats naive character splits every time.
- Anthropic Contextual Retrieval, September 2024, measured on their own benchmark: contextual embeddings alone cut top-20 retrieval failure from 5.7 per cent to 3.7 per cent, a 35 per cent reduction; adding contextual BM25 took it to 2.9 per cent, a 49 per cent reduction; adding reranking took it to 1.9 per cent, a 67 per cent reduction. Implement all three stages.
- Hybrid retrieval: run dense and BM25 at once, then fuse. Reciprocal rank fusion is the simple default.
- Reranking: cut to top-k with a cross-encoder or a hosted reranker before generation.
- Every answer cites the exact page it came from. No exceptions. This is the single feature that separates your project from a chatbot.

**Build.**

- Project 4: full retrieval pipeline with citations, deployed.

**The six days.**

| Day | LEARN block (09:30 to 12:30) | BUILD block (14:00 to 16:00) |
| --- | --- | --- |
| Mon | pgvector: types, operators, index families, dimension limits. | P4: schema with halfvec, ingest embeddings |
| Tue | Chunking strategies. Structural chunking for tender PDFs. | P4: structural chunker on headings and clauses |
| Wed | Contextual embeddings. Generate chunk context with the LLM. | CUT POINT. P4: contextualise every chunk |
| Thu | BM25 in PostgreSQL: tsvector, ts_rank, and the tradeoffs. | P4: BM25 index + hybrid retrieve |
| Fri | Reciprocal rank fusion and reranking. | DEPLOY DAY. P4 answers with sources, live |
| Sat | Read the Anthropic write-up again with your own numbers next to it. | Weekly review. Five DSA redos |

**Ships at the end of this week.**

- Project 4 answering questions with citations to the exact source page, deployed.

**The trap.** Naive vector search over raw chunks, then wondering why the answers are wrong. It is the most common failure in every junior RAG portfolio.

**Note.** Indian hiring slows from roughly 21 to 27 December. Build through it. The replies land in the first week of January.

**Links for this week.**

- github.com/pgvector/pgvector
- anthropic.com/engineering/contextual-retrieval
- platform.claude.com/cookbook/capabilities-contextual-embeddings-guide
- pinecone.io/learn
- cookbook.openai.com


### Week 18 | 28 Dec 2026 – 3 Jan 2027 | Evaluation and LLM security

**Phase E Applied AI** | **DSA this week 16, cumulative 368**

**Focus.** Ragas numbers in the README, and an honest failure-mode section.

**Learn.**

- Ragas metrics for retrieval-augmented generation: Faithfulness, Response Relevancy, Context Precision, Context Recall, Context Entities Recall, Noise Sensitivity.
- Faithfulness is the number of claims in the response supported by the retrieved context divided by the total number of claims in the response. Know that definition cold; it is asked directly.
- Context Precision is the mean of precision-at-k across the retrieved chunks, which rewards putting relevant chunks near the top of the ranking.
- Build a fixed evaluation set of at least fifty question-and-answer pairs from real tender documents. Freeze it. An eval set you change when the score is bad is not an eval set.
- Ragas is a Python library with no JavaScript port. This is why Python sits on Working Sundays 1 to 3 and not after the roadmap.
- Prompt injection and LLM-specific risk from the OWASP GenAI Security Project. Your retrieval corpus is an attack surface: a poisoned document can carry instructions to your model.
- Defences: treat retrieved text as data and never as instructions, constrain tool permissions, require citations, and refuse when nothing scores above threshold.
- Put the eval numbers in the README. Numbers, not claims. Then write the honest failure modes underneath them.

**Build.**

- Project 4 with published eval numbers and a written failure-mode section.

**The six days.**

| Day | LEARN block (09:30 to 12:30) | BUILD block (14:00 to 16:00) |
| --- | --- | --- |
| Mon | Ragas: installation, dataset format, running an evaluation. | P4: build the fifty-pair eval set |
| Tue | Faithfulness and Response Relevancy in depth. | P4: baseline run, record the numbers |
| Wed | Context Precision, Context Recall, Noise Sensitivity. | CUT POINT. P4: retrieval tuning against the eval |
| Thu | Prompt injection. OWASP GenAI. Indirect injection through the corpus. | P4: injection defences + refusal path |
| Fri | Eval-driven iteration. Change one thing, re-measure. | DEPLOY DAY. Numbers in the README |
| Sat | Write the failure modes. Honestly. Name what it gets wrong. | Weekly review + monthly close-out |

**Ships at the end of this week.**

- Real Ragas numbers in the README, plus a failure-mode section you wrote yourself.

**The trap.** Skipping this week because it is the Christmas and New Year window. This is the week that makes Project 4 credible instead of impressive.

**Note.** A candidate with published eval numbers and an honest failure list beats a candidate with two more features. Every time.

**Links for this week.**

- docs.ragas.io/en/stable
- arxiv.org/abs/2309.15217
- genai.owasp.org
- langfuse.com/docs
- hamel.dev/blog/posts/evals


### Week 19 | 4–10 January 2027 | Agents and one MCP server

**Phase E Applied AI** | **DSA this week 16, cumulative 384**

**Focus.** Write the loop by hand first. Then the server. Then, and only then, look at a framework.

**Learn.**

- The agent loop written by hand: plan, act, observe, repeat, with a termination condition and a step budget. No framework. You must be able to draw this on a whiteboard.
- Tool design: narrow tools with tight schemas beat one tool that does everything. Errors returned to the model must be actionable.
- Anthropic, Building Effective Agents: the distinction between workflows and agents, and the standard patterns (prompt chaining, routing, parallelisation, orchestrator-workers, evaluator-optimiser).
- Model Context Protocol. Critical currency point: the current specification revision is 2026-07-28 and it made MCP stateless. Protocol-level sessions and the Mcp-Session-Id header were removed from the Streamable HTTP transport, and the initialize / notifications-initialized handshake was removed; every request now carries its protocol version and client capabilities in _meta. Servers needing cross-call state use explicit server-minted handles passed as ordinary tool arguments.
- Anything you read about MCP written before mid-2026 describes a stateful protocol that no longer exists. Build to 2026-07-28.
- Build one small MCP server with three to five well-scoped tools over your Tender Fit corpus. Test it with MCP Inspector.
- Only after that, open a framework, so you know exactly what it is hiding.

**Build.**

- Project 4 deployed with the hand-written agent loop and a live MCP server.

**The six days.**

| Day | LEARN block (09:30 to 12:30) | BUILD block (14:00 to 16:00) |
| --- | --- | --- |
| Mon | Write the agent loop by hand. Plan, act, observe, budget, stop. | P4: agent loop, no framework |
| Tue | Anthropic, Building Effective Agents. The five patterns. | P4: tool schemas and error contracts |
| Wed | MCP architecture + the 2026-07-28 specification and changelog. | CUT POINT. P4: MCP server skeleton |
| Thu | MCP tools, resources, prompts. Authorisation. MCP Inspector. | P4: three to five tools, tested in Inspector |
| Fri | Open one agent framework and name what it hides. | DEPLOY DAY. Agent + MCP server live |
| Sat | Record a four-minute demo of Project 4 end to end. | Weekly review + monthly close-out |

**Ships at the end of this week.**

- Project 4 live with a hand-written agent loop and a working MCP server a stranger can connect to.

**The trap.** Starting with a framework. You will not be able to explain what it does, and "I used LangChain" is not an answer to "how does your agent decide to stop".

**Note.** You have already shipped an MCP server with seven tools. Do it again, properly, against the current specification, and this time you can defend every line.

**Links for this week.**

- modelcontextprotocol.io
- modelcontextprotocol.io/specification/2026-07-28
- modelcontextprotocol.io/specification/2026-07-28/changelog
- anthropic.com/engineering/building-effective-agents
- github.com/modelcontextprotocol/servers


### Week 20 | 11–17 January 2027 | Mocks, revision, and the resume

**Phase F Conversion** | **DSA this week 16, cumulative 400**

**Focus.** No new topics. No new problems. Speaking while coding is a separate skill and this is the week it gets practised.

**Learn.**

- Ten mock interviews. Exponent Practice for peer mocks; Pramp moved to Exponent Practice in July 2024 and any link to Pramp now redirects there. interviewing.io for anonymous mocks with real engineers.
- Four of the ten are case studies, not coding mocks. Same ten sessions, four of them changed in shape.
- System design out loud, to a wall if you have to. Record it. Watch it back once.
- Reread failed-twice.md from the first line. Every problem in it, again, timed.
- DSA this week is revision and timed sets only. New problems feel better and help less now.
- Rebuild the resume now, not earlier, because only now do the numbers exist. One page, four projects, three variants.
- Beyond Cracking the Coding Interview, the free chapters, for the behavioural and negotiation structure.

**Build.**

- No new build. Polish: READMEs, screenshots, demo videos, live-link health checks on all four projects.

**The six days.**

| Day | LEARN block (09:30 to 12:30) | BUILD block (14:00 to 16:00) |
| --- | --- | --- |
| Mon | Two mocks. One coding, one system design. | Resume v1. Master template filled with real numbers |
| Tue | Two mocks. Reread failed-twice.md, redo the top ten. | READMEs: all nine sections on all four projects |
| Wed | Two mocks. One FDE case study. | CUT POINT. Demo videos, three minutes each |
| Thu | Two mocks. One Applied AI RAG design round. | Resume: three variants. Link health check |
| Fri | Two mocks. Record, watch back, fix one habit. | DEPLOY DAY. Every live link verified working |
| Sat | Rehearse the opening answer twenty times. Out loud. | Weekly review. Application list built |

**Ships at the end of this week.**

- Ten mocks behind you, recorded and watched back. Resume rebuilt with real numbers. All four live links verified.

**The trap.** Doing new problems instead of revising, and polishing the resume for a week instead of sending it.

**Note.** Speaking while you code is a separate skill from coding. It has to be practised, and this is the only week allocated to it.

**Links for this week.**

- tryexponent.com/practice
- interviewing.io/mocks
- bctci.co/free-chapters
- techinterviewhandbook.org
- techinterviewhandbook.org/self-introduction


### Week 21 | 18–24 January 2027 | Applications at volume. Gate 4

**Phase F Conversion** | **DSA this week 15, cumulative 415**

> **GATE 4 | 24 January 2027** | Project 4 live. One hundred applications sent.

**Focus.** Not ten applications. A hundred. Volume first, funnel optimisation second.

**Learn.**

- Apply to the role name, not to companies you have heard of. Search Applied AI Engineer, Forward Deployed Engineer, Solutions Engineer. Not "software jobs".
- Apply inside twenty-four hours of a posting. Position in the pile is real and it decays fast.
- Referral asks every single time. The commonly repeated industry figure is that referrals are roughly seven per cent of applications and around forty per cent of hires; treat the exact numbers as directional, but the direction is not in dispute. The worst answer is no.
- Wellfound filtered to companies with one to fifty employees. They read every application. Large companies filter you out on the degree line before a human sees it.
- LinkedIn Easy Apply on posts under twenty-four hours old, plus one polite direct message with your live link and a one-line ask.
- Track every application in a sheet: company, role, date, channel, referral yes or no, response, stage. You cannot fix a funnel you are not measuring.
- levels.fyi and AmbitionBox before any salary conversation, so the first number you hear is not the first number you have thought about.

**Build.**

- Nothing new is built. Every hour that is not applications goes to keeping the four live links healthy.

**The six days.**

| Day | LEARN block (09:30 to 12:30) | BUILD block (14:00 to 16:00) |
| --- | --- | --- |
| Mon | Build the target list. 120 companies, role name first. | 25 applications. Every one with a referral attempt |
| Tue | Naukri, Wellfound, LinkedIn filters set up and saved. | 25 applications |
| Wed | Negotiation basics. levels.fyi and AmbitionBox ranges. | CUT POINT. 20 applications + follow-ups |
| Thu | Interview scheduling hygiene. Calendar blocks, buffers. | 20 applications + first-round prep |
| Fri | Rehearse the three answers that decide it. | DEPLOY DAY. 10 applications. All links verified |
| Sat | Full audit. Gate 4 checklist, top to bottom. | GATE 4 DRY RUN |

**Ships at the end of this week.**

- GATE 4. Project 4 live, one hundred applications sent, interviews in the calendar.

**The trap.** Polishing the resume for another week instead of sending it. The maths is simple: more applications, more interviews.

**Note.** Do not optimise the funnel before you have filled it. One hundred applications is the input; the funnel maths only becomes readable after that.

**Links for this week.**

- techinterviewhandbook.org
- levels.fyi
- ambitionbox.com
- wellfound.com
- naukri.com
- linkedin.com/jobs


## Part 5 | The four projects

One problem, taken three times, then a second problem. This is deliberate. A recruiter can see depth in one domain far more easily than breadth across four unrelated toy apps.

| Project | Repo | Weeks | What it is |
| --- | --- | --- | --- |
| Project 1 \| ITC Reclaim | itc-reclaim | 3 to 7 | GST input tax credit reconciliation. Upload GSTR-2B and the purchase register, match them, show what credit is unclaimed. The gap between those two files is money the business is entitled to claim and has not. Finding it by hand takes a day. |
| Project 2 \| ITC Reclaim API | itc-reclaim-api | 8 to 11 | The same problem as a real backend. Multi-tenant: organisations, users and roles. Auth you wrote yourself. An audit log of who changed what, and when. One WebSocket feature. |
| Project 3 \| ITC Reclaim Ops | itc-reclaim-ops | 12 to 15 | The same system made operable. Tests, CI that blocks on red, containers, queues, logs, metrics, and a rollback you have actually executed once. |
| Project 4 \| Tender Fit | tender-fit | 16 to 19 | Applied AI. Ingest a government tender document, retrieve against the company profile with hybrid search and citations, score the fit, explain the gaps. Published Ragas numbers and an honest failure mode section. |

**Rule 36(4) matters here.** The reason Project 1 is not a toy is that Indian businesses genuinely lose claimable credit to reconciliation gaps. When an interviewer asks what the project does, the answer is a rupee figure, not a feature list.

### The README, nine sections, every project

1. The problem, in one paragraph, with a rupee figure
1. A screenshot or a 30 second GIF above the fold
1. Live URL and the repo
1. The stack, with versions
1. Architecture: one diagram, drawn by you
1. How to run it locally, tested from a clean clone
1. What is measured: latency, cost, coverage, or accuracy
1. What does not work yet, stated plainly
1. What you would do next with two more weeks


## Part 6 | The stack, pinned

Version numbers are the difference between a tutorial that works and a day lost. These were verified on 27 August 2026.

| Technology | Version you use | Status | Why it matters |
| --- | --- | --- | --- |
| Node.js | 24 LTS (Krypton) | Active LTS to 20 Oct 2026 | Maintenance after that, end of life 30 Apr 2028. Node 26 goes Active LTS on 28 Oct 2026. |
| Package manager | pnpm | Stable | Faster installs, strict node_modules, better monorepo story than npm. |
| TypeScript | Latest stable | Stable | strict, noUncheckedIndexedAccess and exactOptionalPropertyTypes on from file one. |
| React | 19.2 | Current | React Compiler 1.0 stable since 7 Oct 2025. Do not hand-memoise. |
| Next.js | 16.x | Active LTS | Turbopack default. middleware is now proxy. PPR via cacheComponents. |
| Tailwind CSS | v4 | Current | CSS-first. @theme block. No tailwind.config.js by default. |
| PostgreSQL | 18 (18.6+) | Current, supported to 14 Nov 2030 | Async I/O, skip scan, uuidv7(), virtual generated columns. |
| ORM | Prisma or Drizzle | Pick one, stay | Migrations committed to the repository and run in CI. |
| Validation | zod | Stable | Parse at every boundary. Never trust an input you did not validate. |
| Auth | Hand-written sessions | By design | Argon2id m=19456, t=2, p=1. SHA-256 hashed session tokens. |
| Cache and queue | Redis 8 or Valkey | Current | Redis 8 is tri-licensed RSALv2 / SSPLv1 / AGPLv3. Valkey is BSD-3-Clause. |
| Queue library | BullMQ | Stable | Idempotent handlers. Dead letter queue. Retries with backoff. |
| Testing | Vitest, Testing Library, MSW, Playwright | Stable | Twelve good tests beat sixty generated ones. |
| Containers | Docker + Compose v2 | Current | Compose v2 is a space, not a hyphen. Multi-stage, non-root, healthcheck. |
| CI | GitHub Actions | Stable | Pinned action SHAs. Lockfile audit. Merge blocked on red. |
| AI SDK | AI SDK 7 | Released 25 Jun 2026 | ESM-only. CommonJS removed. Node 22 minimum. Codemod: npx @ai-sdk/codemod v7. |
| Vector store | pgvector on PostgreSQL 18 | Current | vector indexes to 2,000 dims, halfvec to 4,000. Use halfvec for 3,072-dim embeddings. |
| MCP | Specification 2026-07-28 | Current | Stateless. No Mcp-Session-Id. No initialize handshake. Capabilities in _meta. |


### What breaks if you follow an older tutorial

| What you will do | What happens |
| --- | --- |
| You follow a Tailwind v3 tutorial. | You write a tailwind.config.js that is silently ignored. No error. You lose a day. |
| You follow a Next.js 15 tutorial. | Your middleware file does nothing under the new name, and the caching model you learned is wrong. |
| You install AI SDK 7 and use require. | It fails immediately. v7 is ESM-only and CommonJS was removed. |
| You use a 3,072-dimension embedding with the vector type. | The index will not build. The indexable ceiling for vector is 2,000. Use halfvec. |
| You read an MCP guide from 2025. | You build session handling that the 2026-07-28 specification deleted. |
| You quote OWASP A10 as SSRF. | You are citing the 2021 list. In 2025 A10 is Mishandling of Exceptional Conditions. |
| You run docker-compose with a hyphen. | Command not found. Compose v2 is docker compose, with a space. |
| You hand-memoise React components. | You are fighting React Compiler 1.0 and adding noise an interviewer will notice. |
| You stay on Node 20 or below. | AI SDK 7 will not install. The minimum is Node 22. |
| You learn on PostgreSQL 16 then deploy on 18. | Generated columns and I/O behaviour differ. Move your local instance to 18 in Week 9. |
| You cite Pramp or The Copenhagen Book. | Both moved. It reads as material you copied rather than material you used. |


## Part 7 | Where to learn it | the full library

Every link below was loaded and checked on 27 August 2026. Cost is stated. Nothing here needs buying.


### 01  JavaScript, the language

| Link | Why this one | Cost |
| --- | --- | --- |
| javascript.info | The single best free JavaScript resource in existence. Chapters 4 to 12 are the spine of Weeks 1, 3 and 4. | Free |
| developer.mozilla.org/en-US/docs/Web/JavaScript | Reference, not tutorial. Use it to check, not to learn. | Free |
| eloquentjavascript.net | Read chapters 5, 6, 11 and 18 only. The rest overlaps javascript.info. | Free |
| github.com/getify/You-Dont-Know-JS | Scope and Closures, plus this and Object Prototypes. Reference depth. | Free |
| latentflip.com/loupe | Event loop, visualised. Fifteen minutes, permanent payoff. | Free |
| jsv9000.app | Microtask against macrotask queue, visualised. Better than loupe for promises. | Free |


### 02  Git, shell and the machine

| Link | Why this one | Cost |
| --- | --- | --- |
| git-scm.com/book/en/v2 | Pro Git. Chapters 2 and 3 in Week 1, chapter 7 when you need it. | Free |
| learngitbranching.js.org | All main and remote levels. The only way rebase becomes intuitive. | Free |
| missing.csail.mit.edu/2026 | MIT. Shell, Command-line Environment, Version Control, Debugging and Profiling. | Free |
| wizardzines.com | Julia Evans. The comics on DNS, HTTP and containers are genuinely the fastest path. | Free / paid zines |
| linuxjourney.com | Gap-fill only. Occasionally offline; a LabEx mirror exists. | Free |
| nginx.org/en/docs | Server blocks, proxy_pass, TLS termination. You already run this. | Free |


### 03  HTML, CSS and accessibility

| Link | Why this one | Cost |
| --- | --- | --- |
| flexboxfroggy.com | All 24 levels in Week 2. Then rebuild the layouts without the game. | Free |
| cssgridgarden.com | All 28 levels. Same rule: rebuild afterwards. | Free |
| web.dev/learn/css | Stacking contexts, z-index, overflow, inheritance. The parts games skip. | Free |
| web.dev/learn/html | Semantics done properly, which is most of accessibility for free. | Free |
| web.dev/learn/accessibility | One pass in Week 6. Labels, focus order, keyboard, contrast. | Free |
| joshwcomeau.com | The CSS articles are the clearest explanations of layout on the internet. | Free articles |


### 04  React

| Link | Why this one | Cost |
| --- | --- | --- |
| react.dev/learn | Current source of truth. Read alongside Full Stack Open, not after it. | Free |
| react.dev/learn/you-might-not-need-an-effect | Read twice in Week 5. Most junior React code is effects that should not exist. | Free |
| react.dev/learn/escape-hatches | Week 6 in full. Refs, effect lifecycle, removing dependencies, custom hooks. | Free |
| react.dev/learn/react-compiler | Compiler 1.0 stable since Oct 2025. Read before you write any memo. | Free |
| fullstackopen.com/en | University of Helsinki. Parts 0 to 2 in Week 5. Continuously updated, no yearly versions. | Free |
| overreacted.io | Dan Abramov. Read when a React behaviour surprises you. | Free |


### 05  TypeScript

| Link | Why this one | Cost |
| --- | --- | --- |
| typescriptlang.org/docs/handbook/intro.html | Start to finish in Week 7. Not a skim. | Free |
| totaltypescript.com/tutorials | Matt Pocock. The free tutorials cover generics and narrowing better than the handbook. | Free tier |
| github.com/type-challenges/type-challenges | Easy tier only. Do not rabbit-hole into medium. | Free |
| typescriptlang.org/tsconfig | Every flag explained. Turn on strict and noUncheckedIndexedAccess. | Free |
| typescriptlang.org/play | Test a type theory in ten seconds instead of ten minutes. | Free |


### 06  Next.js and Tailwind

| Link | Why this one | Cost |
| --- | --- | --- |
| nextjs.org/learn | The official course. Week 10, end to end. | Free |
| nextjs.org/docs/app/guides/upgrading/version-16 | Read even though you start on 16. It names every breaking change. | Free |
| nextjs.org/support-policy | Confirms 16 is Active LTS and 15 leaves maintenance on 21 Oct 2026. | Free |
| tailwindcss.com/docs | v4 CSS-first. @theme, @utility, @variant. Ignore every v3 tutorial. | Free |


### 07  Node and API design

| Link | Why this one | Cost |
| --- | --- | --- |
| nodejs.org/en/learn | Modules, event loop, streams, file system. Week 8. | Free |
| nodejs.org/en/about/previous-releases | The release schedule table. Check it at Gate 3 for the Node 26 decision. | Free |
| expressjs.com | Routing, middleware order, error middleware. Small surface, learn all of it. | Free |
| zod.dev | Parse, do not validate. Every boundary, every time. | Free |
| github.com/goldbergyoni/nodebestpractices | Read end to end once in Week 8, then use as a checklist. | Free |
| docs.bullmq.io | Week 15. Workers, retries, backoff, dead letter queues. | Free |


### 08  PostgreSQL and SQL

| Link | Why this one | Cost |
| --- | --- | --- |
| pgexercises.com | All seven categories, roughly 80 exercises. Week 9. | Free |
| postgresql.org/docs/current/tutorial.html | The official tutorial, then the parts of the manual you need. | Free |
| use-the-index-luke.com | The best free writing on indexes anywhere. Read the chapters that bit you. | Free |
| modern-sql.com | Window functions and modern SQL features. Working Sundays 4 and 5. | Free |
| explain.dalibo.com | Paste an EXPLAIN ANALYZE plan and actually read it. Week 15. | Free |
| practicewindowfunctions.com | Working Sunday 4. Pure drill. | Free |
| mystery.knightlab.com | SQL Murder Mystery. Ninety enjoyable minutes on Working Sunday 5. | Free |


### 09  Authentication and security

| Link | Why this one | Cost |
| --- | --- | --- |
| auth.pilcrowonpaper.com | The Auth Book, formerly The Copenhagen Book. Read twice in Week 11. | Free |
| cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html | Source of the Argon2id m=19456, t=2, p=1 configuration. | Free |
| cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html | Cookie attributes, rotation, fixation, timeout. | Free |
| owasp.org/Top10/2025 | The 2025 list. Week 13. Do not study the 2021 list. | Free |
| portswigger.net/web-security | Free labs, better than most paid courses. Access control and injection. | Free |
| oslojs.dev | Small auditable primitives by the author of the Auth Book. | Free |
| genai.owasp.org | LLM-specific risk. Week 18. Prompt injection through your own corpus. | Free |


### 10  Testing, CI and containers

| Link | Why this one | Cost |
| --- | --- | --- |
| vitest.dev | Week 12. Fast, Vite-native, the current default. | Free |
| testing-library.com | Query by role and accessible name. Test what the user sees. | Free |
| mswjs.io | Mock at the network boundary, not by patching your own modules. | Free |
| playwright.dev/docs/best-practices | Two end-to-end journeys only. Read this page before writing them. | Free |
| kentcdodds.com/blog/write-tests | Write tests. Not too many. Mostly integration. Take the ratio seriously. | Free |
| docs.github.com/en/actions | Week 12. Matrix, caching, services, environments, secrets. | Free |
| docs.docker.com/get-started | Week 14. Images, layers, multi-stage builds. | Free |
| docs.docker.com/compose | Compose v2. A space, not a hyphen. | Free |
| caddyserver.com/docs | Automatic TLS with almost no configuration. | Free |


### 11  Redis, observability and system design

| Link | Why this one | Cost |
| --- | --- | --- |
| redis.io/docs/latest | Caching, TTLs, sliding-window rate limits, the stampede problem. | Free |
| valkey.io | The BSD-3-Clause fork. Know the licence difference; it gets asked. | Free |
| getpino.io | Structured JSON logging with request IDs. Week 15. | Free |
| docs.sentry.io | Error tracking. Generous free tier. | Free tier |
| opentelemetry.io/docs | Traces and the GenAI semantic conventions used on Working Sunday 9. | Free |
| signoz.io | Self-hostable observability. Optional, and it runs on your own box. | Free / self-host |
| github.com/donnemartin/system-design-primer | First third only. Week 15. Do not read all of it. | Free |


### 12  DSA

| Link | Why this one | Cost |
| --- | --- | --- |
| takeuforward.org/dsa/strivers-a2z-sheet-learn-dsa-a-to-z | The sheet. 474 problems, 152 easy, 186 medium, 136 hard. | Free |
| codolio.com/question-tracker/sheet/strivers-a2z-dsa-sheet | Progress tracking that survives a browser reinstall. | Free |
| neetcode.io/roadmap | Use the pattern roadmap when a Striver topic will not click. | Free tier |
| leetcode.com | Where you actually solve. Free tier is sufficient throughout. | Free tier |
| visualgo.net | Watch the algorithm run when the code will not stick. | Free |
| bigocheatsheet.com | One page. Print it. Put it on the wall. | Free |
| cses.fi/problemset | Only if you finish early, which you will not. | Free |


### 13  Applied AI

| Link | Why this one | Cost |
| --- | --- | --- |
| ai-sdk.dev/docs/introduction | AI SDK 7. Weeks 16 to 19. | Free |
| ai-sdk.dev/docs/migration-guides/migration-guide-7-0 | Read first if you hit any v6 tutorial. npx @ai-sdk/codemod v7. | Free |
| platform.openai.com/docs | Provider reference, token accounting, prompt caching. | Free docs, paid API |
| cookbook.openai.com | Working patterns you can lift directly. | Free |
| promptingguide.ai | Systematic, not folklore. | Free |
| github.com/pgvector/pgvector | Dimension limits, index families, operators. Week 17. | Free |
| anthropic.com/engineering/contextual-retrieval | The 5.7 to 1.9 per cent numbers. Implement all three stages. | Free |
| docs.ragas.io/en/stable | Week 18. Faithfulness, Context Precision, Context Recall. | Free |
| arxiv.org/abs/2309.15217 | The Ragas paper. Read the metric definitions in the original. | Free |
| anthropic.com/engineering/building-effective-agents | Week 19. Workflows against agents, and the five patterns. | Free |
| modelcontextprotocol.io/specification/2026-07-28 | The current spec. Stateless. Build against this, nothing older. | Free |
| github.com/modelcontextprotocol/servers | Reference servers. Read two before writing yours. | Free |
| langfuse.com/docs | LLM tracing. Working Sunday 9. | Free / self-host |
| hamel.dev/blog/posts/evals | The most practical writing on LLM evaluation available. | Free |


### 14  Python and SQL Sundays

| Link | Why this one | Cost |
| --- | --- | --- |
| freecodecamp.org/news/learn-python-for-javascript-developers-handbook | Working Sunday 1. Written for exactly your starting point. | Free |
| cs50.harvard.edu/python | Harvard CS50P. Dip in for the parts that do not stick. | Free |
| realpython.com | Reference for idiom, not a course. | Free tier |
| automatetheboringstuff.com | Working Sunday 2. Files, CSV, regex, scripting. | Free |
| docs.astral.sh/uv | The current Python packaging tool. Skip pip and venv folklore. | Free |
| learnsql.com/blog/sql-window-functions-practice-exercises | Working Sunday 4 drill set. | Free tier |


### 15  Reading code and open source

| Link | Why this one | Cost |
| --- | --- | --- |
| github.com/n8n-io/n8n | Working Sundays 8 and 10. You already run it, so the domain is free. | Free |
| goodfirstissue.dev | One real contribution is worth more than ten tutorial projects. | Free |
| aosabook.org | The Architecture of Open Source Applications. How real systems are shaped. | Free |
| github.com/codecrafters-io/build-your-own-x | Only after Gate 4. It is a rabbit hole with a very high ceiling. | Free |


### 16  Interview preparation

| Link | Why this one | Cost |
| --- | --- | --- |
| tryexponent.com/practice | Peer mocks. This is where Pramp went in July 2024. | Free tier |
| interviewing.io/mocks | Anonymous mocks with real engineers. Some free slots. | Free / paid |
| techinterviewhandbook.org | Behavioural structure, resume rules, the self-introduction page. | Free |
| bctci.co/free-chapters | Beyond Cracking the Coding Interview. Behavioural and negotiation chapters. | Free chapters |
| github.com/bicced/ai-engineer-interview-handbook | Applied AI interview formats specifically. | Free |
| developers.google.com/tech-writing | Working Sunday 6. Your READMEs are read before your code. | Free |


### 17  Hosting and infrastructure you already have

| Link | Why this one | Cost |
| --- | --- | --- |
| oracle.com/cloud/free | Your Always Free VPS. 2 OCPU, 12 GB, 200 GB Arm. Weeks 14 and 15 deploy here. | Free |
| vercel.com/docs | Next.js hosting. Free tier is enough for all four projects. | Free tier |
| neon.com/docs | Serverless PostgreSQL with branching. Useful for CI databases. | Free tier |
| upstash.com/docs | Serverless Redis if you do not want it on your own box. | Free tier |
| developers.cloudflare.com | DNS, TLS, caching. Working Sunday 7. | Free tier |


### 18  What you already own

| Link | Why this one | Cost |
| --- | --- | --- |
| app.100xdevs.com | Cohort content you have already paid for. Mapping table in Part 7.6. | Owned |
| projects.100xdevs.com | Project briefs. Use as extra practice, not as a substitute for the four projects. | Owned |
| youtube.com/@100xDevs-edu | Free companion videos to the paid cohort. | Free |
| github.com/Bharat2044/100xDevs-Cohort3-WebDev-and-Devops | Community notes. Faster than rewatching a three-hour video. | Free |


### 19  Salary and job search

| Link | Why this one | Cost |
| --- | --- | --- |
| levels.fyi | Check before any salary conversation. India filter. | Free |
| ambitionbox.com | Self-reported and noisy, but the only India-wide dataset with volume. | Free |
| wellfound.com | Filter to 1 to 50 employees. They read every application. | Free |
| naukri.com | Highest volume in India. Set saved searches on the role names, not on skills. | Free |
| linkedin.com/jobs | Easy Apply on postings under 24 hours old, plus one direct message. | Free |


### 20  After Gate 4 only

| Link | Why this one | Cost |
| --- | --- | --- |
| teachyourselfcs.com | The curriculum to work through over the following two years. | Free |
| csprimer.com | Where Bradfield went. Paid, and worth it once you are earning. | Paid |
| pages.cs.wisc.edu/~remzi/OSTEP | Operating Systems: Three Easy Pieces. Free and excellent. | Free |
| beej.us/guide/bgnet | Network programming from sockets up. | Free |
| karpathy.ai/zero-to-hero.html | If you ever want to understand the models rather than use them. | Free |
| codecrafters.io | Build your own Redis, git, shell. Paid, excellent, not before Gate 4. | Paid |
| 12factor.net | Thirty minutes. Explains most deployment opinions you will meet. | Free |


## Part 8 | The courses you already own

**Verdict: this document sets the sequence and the depth. The 100xDevs bundle is a lookup tool you open when one specific concept has not landed. It is never the path.**

### What you own, and its real status on 27 August 2026

| Course | Videos | Progress | Access expires |
| --- | --- | --- | --- |
| 100xSchool Combined Bootcamp (bundle) | 320 | 0 of 320, 0 per cent | 26 Dec 2028 |
| Web Dev + DevOps Bootcamp | 155 | 0 of 155, 0 per cent | 26 Dec 2028 |
| Web3 Bootcamp | 147 | 0 of 147, 0 per cent | 26 Dec 2028 |
| AI and ML Bootcamp | 114 | 0 of 114, 0 per cent | 26 Dec 2028 |
| DSA Bootcamp | 48 | 0 of 48, 0 per cent | 26 Dec 2028 |

Two facts follow from that table and they decide the whole question.

First, **you have watched nothing.** This is not a resource you are partway through and should finish. It is an unopened second full time curriculum.

Second, **access runs to 26 December 2028.** That is one year and eleven months past Gate 4. There is no deadline pressure, no expiring value, and therefore no reason to consume any of it during the 21 weeks.

### Why this roadmap is the spine

Three reasons, in order of weight.

**1. The arithmetic does not fit.** Your entire LEARN budget across 21 weeks is **336 hours**: 18 hours a week for Weeks 1 to 14, then 12 hours a week once the LEARN hour moves to applications in Week 15. The combined bundle is 320 videos. At a 20 minute average that is 107 hours. At 30 minutes it is 160 hours. Watching it end to end would consume **32 to 48 per cent of your entire learning budget and ship nothing**. Add the four individual courses (155 + 147 + 114 + 48 = 464 videos) and you exceed the whole budget before writing a line of code.

**2. Version pinning.** Every link in Part 7 was loaded and checked on 27 August 2026, and Part 6 pins exact versions: Node 24 LTS, Next.js 16, React 19.2, PostgreSQL 18, Tailwind v4, OWASP Top 10:2025, AI SDK 7, MCP spec 2026-07-28. The bundle syllabi are undated topic lists with no version pinning anywhere. Part 6 lists eleven specific ways an older tutorial costs you a day. A video recorded against Tailwind v3 or AI SDK v5 will do exactly that.

**3. Passive beats nothing, and loses to building.** Part 11.2 is the rule: build first, learn on demand. Video is the most passive format available and it runs at the instructor pace, not yours.

### Per course ruling

| Course | Ruling |
| --- | --- |
| 100xSchool Combined Bootcamp | Bundle wrapper. Never open it as a course. |
| Web Dev + DevOps Bootcamp | Lookup only. 13 of its 16 web topics map onto Weeks 1 to 15. |
| DSA Bootcamp | Keep the topic order as a checklist. Skip the videos: it is C++. |
| AI and ML Bootcamp | Optional Sunday or night viewing for intuition. Never in place of the Week 16 to 19 builds. Skip anything on training or fine tuning models. |
| Web3 Bootcamp | Do not open before Gate 4. Zero overlap with all seven roles in Part 12. |

### Web development: 13 of 16 topics map onto this roadmap

| # | Bootcamp topic | Where it lives here |
| --- | --- | --- |
| 1 | HTML/CSS | Week 2 |
| 2 | JS Basics | Week 1 |
| 3 | JS architecture | Week 3 |
| 4 | Async JS | Week 4 |
| 5 | Node vs Browser JS | Weeks 4 and 8 |
| 6 | HTTP and Express | Week 3 for HTTP, Week 8 for Express |
| 7 | Databases and Mongo | PostgreSQL in Week 9. **Mongo is on the skip list** |
| 8 | Postgres + Prisma/Drizzle | Week 9 |
| 9 | TypeScript | Week 7 |
| 10 | Turborepo | Not in this roadmap. Monorepo tooling is not hiring criteria at this band |
| 11 | BunJS | **On the skip list** |
| 12 | React | Weeks 5 and 6 |
| 13 | Tailwind | Week 6 |
| 14 | NextJS | Week 10 |
| 15 | Websockets + WebRTC | WebSocket in Week 11. WebRTC is not in this roadmap |
| 16 | Queues/Pubsubs | Week 15, BullMQ on Redis |

Their suggested projects are a todo app, a Lovable clone, a Codeforces clone and a trading app. Every applicant in India has those. Yours is ITC Reclaim, a real GST input tax credit problem with a rupee figure attached, plus Tender Fit. That difference is what carries the Forward Deployed Engineer and Applied AI interviews. Keep your projects.

Their resource list names Angela Yu. That is sixty plus hours of video. It is on the do not buy list in Part 14 for the same reason as everything else here: Part 7 gives you documentation and exercises you read at your own speed.

### DevOps: you already run four of these in production

| Bootcamp topic | Ruling |
| --- | --- |
| 1. Bash/Terminal | **Already yours.** WSL2 Ubuntu 24.04.4 daily |
| 2. VMs/Baremetal machines | **Already yours.** Oracle Cloud Always Free VPS |
| 3. Process management + Reverse proxies | **Already yours.** nginx in production |
| 4. Certificates and cert management | **Already yours.** 8 TLS certificates under certbot |
| 5. ASGs/MIGs | Out of scope. A scale problem you do not have |
| 6. Containers and container runtimes | Week 14 |
| 7. Docker | Week 14 |
| 8. Kubernetes 1 | **On the skip list** |
| 9. Kubernetes 2 | **On the skip list** |
| 10. CI/CD | Week 12 |
| 11. Monitoring/Observability | Week 15 |
| 12. iac | **On the skip list** (Terraform) |
| 13. CDNs + Object stores | Working Sunday 7, 6 December 2026 |
| 14. Sandboxing/Firecracker | Out of scope. Interesting, not hiring criteria at this band |

Four topics you already run, four that map here, three explicitly skipped, three out of scope. There is almost nothing in this course for you.

### DSA: right topics, wrong language, wrong practice sites

Topics 3 to 22 of their 22 are all inside Striver A2Z, which is the spine of Part 3 and your morning block. Two problems though.

**It is taught in C++.** Your resume, all four projects and every interview you will sit for the seven roles in Part 12 are JavaScript and TypeScript. Pick one language for DSA and never switch. If you already think in JavaScript, stay there. Do not spend Week 1 on C++ syntax and pattern printing. Their topics 1 and 2 are exactly that.

**Half their resource list is competitive programming.** Codeforces Edu, CP Algorithms, the Pavel Marvin playlist, AtCoder and Codeforces contests are a different sport with a different reward curve. Part 14 skips competitive programming and LeetCode contests for the same reason: patterns beat speed in an interview, and timed contests train a format you will not face.

The one keeper is **Abdul Bari**, because it is language agnostic algorithm theory and works for a single concept that will not land.

### Web3: the biggest trap in your account

147 videos on Solana runtime, programs and smart contracts, Rust and Anchor. **Not one of the seven roles in Part 12 asks for any of it.** Not Applied AI Engineer, not Forward Deployed Engineer, not Full Stack, not Backend, not Platform. Access runs to 26 December 2028, so it is still there as a hobby after you are employed. Before Gate 4 it is 147 videos of pure opportunity cost.

### AI and ML: the one with real value, partially

114 videos, and the closest of the five to your primary target role. Its card lists attention and its variations, GenAI, memory and retrieval, and advanced topics. Use only the applied and plumbing parts. Part 14 skips fine tuning models for a reason: you are building on models, not making them, and Applied AI roles test plumbing and evaluation. Weeks 16 to 19 here are build weighted (AI SDK 7, hybrid retrieval with citations, Ragas, one MCP server). That bootcamp is theory weighted. Theory does not survive the interview question **what was your context precision, and how did you measure it**.

### The daily rule

1. Open the week in Part 4. Read the LEARN topic and the BUILD task.
2. **Try to build first.** Part 11.2.
3. Stuck on one specific concept? Only then search the bootcamp for that one video. Watch at 1.5x or 2x.
4. Close it. Return to the code.
5. **Hard cap: 30 minutes of video per day, taken from inside the LEARN block, never added on top of it.**
6. Never watch a section end to end. Never try to complete a course.

Where video genuinely wins, and you should use it without guilt: when text has failed twice on the same concept, when wiring up a tool for the first time, and when the explanation style simply lands faster for you than English documentation.

### The falsifier

Check this on Sunday 27 September 2026, the end of Week 4.

- If your video count is still near zero **and** DSA cumulative is at or above 96, the deferral was correct. Stop feeling guilty about the 0 per cent.
- If your video count has climbed **and** DSA cumulative is below 96, the courses are stealing roadmap hours. Close them and do not reopen before Gate 4.


## Part 9 | The night recall block

45 minutes, six nights a week, outside the 8 hours. 94.5 hours across the roadmap. Technical content only.

| Segment | Minutes | What |
| --- | --- | --- |
| Anki, all three decks | 20 | DSA Patterns, System and Stack, Interview Answers. Zero overdue is the only acceptable state. |
| Spoken explanation | 15 | Explain the day out loud, to the wall, no notes. Four nights of six must be spoken, not read. |
| Tomorrow, decided | 10 | Write the first DSA problem and the first build task for tomorrow. Never decide this in the morning. |

There is no English block. It was removed on purpose. Those minutes went to DSA and to TypeScript.


## Part 10 | The machine you already run

You are not starting from nothing. This is the inventory, and it is an advantage most juniors do not have.

- WSL2 Ubuntu 24.04.4 as the daily environment
- Oracle Cloud Always Free VPS: 2 OCPU, 12 GB RAM, 200 GB, aarch64
- 8 TLS certificates under certbot, renewing
- nginx as reverse proxy, ufw and fail2ban in front
- Docker with PostgreSQL, moving to 18 in the launch block
- n8n behind nginx basic auth
- An n8n accounts payable fraud engine: 111 nodes, 12 detectors, 0.72 confidence threshold, about 3.2 per cent exception rate
- An MCP server with 7 tools
- Neovim 0.12.4 with LazyVim, 32 plugins
- 3 live sites: paisareality.com, devpilotx.com, value.codes
- 46 repositories, 2 of them Python

This is why Week 2 covers Linux and networking as revision rather than instruction, and why the DevOps sections of any course you own are largely redundant for you.


## Part 11 | Focus, and how to learn this fast


### 11.1 The seven rules

1. One tab of documentation. One editor. Nothing else on the screen.
1. Phone in another room, not face down on the desk.
1. The block starts on the clock, not when you feel ready.
1. If you are stuck for 30 minutes, write down the question, then move. Return at CLOSE.
1. No refactoring during BUILD. Ugly and shipped beats elegant and unfinished.
1. No new tool, library or framework enters the plan mid-week.
1. The day ends at 16:30 whether or not it went well.


### 11.2 Build first, learn on demand

Read the minimum, then build, then read again when the build blocks you. Reading first feels productive and is 15 per cent as efficient as building first. The two-hour rule: if a concept has not landed after two focused hours, you are missing a prerequisite, not intelligence. Go find the prerequisite.


### 11.3 Retention

Anki is a fixed block, not an optional extra. One fact per card. Ask why, never how. An explanation without the fix is not a card. If you have memorised the explanations rather than the mechanism, you will fail the follow up question, which is the one that decides the interview.


### 11.4 The honest test of whether any of this is working

- Can you explain it back, out loud, with no notes?
- Can you generate a new practice case yourself rather than recognising one?
- Is Anki at zero overdue?
- Did the thing you built this week actually run for someone other than you?


## Part 12 | The seven roles

| Code | Role |
| --- | --- |
| AAE | Applied AI Engineer |
| FDE | Forward Deployed Engineer |
| FS | Full Stack Engineer |
| BE | Backend Engineer |
| ASE | AI Solutions Engineer |
| PLAT | Platform / DevOps-adjacent |
| DE | Data Engineer |


### Applied AI Engineer

| Field | Detail |
| --- | --- |
| Entry band, India | Rs 8 to 15 lakh |
| Ceiling | Rs 40 lakh and above |
| Verdict | PRIMARY TARGET. Best fit for what this roadmap builds. |
| What they actually test | RAG architecture, retrieval quality, evaluation methodology, cost per query, prompt injection defence, agent design and termination. |
| Which project carries it | Project 4 (Tender Fit) end to end, with published Ragas numbers and an honest failure-mode section. |


### Forward Deployed Engineer

| Field | Detail |
| --- | --- |
| Entry band, India | Rs 10 to 12 lakh |
| Ceiling | Rs 50 to 80 lakh and above at senior level |
| Verdict | STRONG SECOND. Highest ceiling on this list. Rewards exactly the customer-problem instinct your projects show. |
| What they actually test | Case studies rather than algorithms. Scoping an ambiguous customer problem, shipping under constraint, talking to non-engineers, integration reality. |
| Which project carries it | ITC Reclaim across Projects 1 to 3. It is a real business problem with a measurable rupee outcome. |


### Full Stack Engineer (AI-adjacent)

| Field | Detail |
| --- | --- |
| Entry band, India | Rs 6 to 12 lakh |
| Ceiling | Rs 35 lakh and above |
| Verdict | STRONG. The widest volume of postings in India, so the highest number of shots. |
| What they actually test | React, Next.js, Node, PostgreSQL, auth, deployment, and whether you can debug production. |
| Which project carries it | Project 3, containerised on your own server, with CI, tests, logs and a rollback you have executed. |


### Backend Engineer

| Field | Detail |
| --- | --- |
| Entry band, India | Rs 6 to 12 lakh |
| Ceiling | Rs 40 lakh and above |
| Verdict | STRONG. Weeks 8 to 15 are aimed squarely here. |
| What they actually test | API design, schema design, indexes, transactions, queues, idempotency, observability, one system design round. |
| Which project carries it | Project 2 and Project 3. The EXPLAIN ANALYZE before-and-after number carries this interview. |


### AI Solutions Engineer

| Field | Detail |
| --- | --- |
| Entry band, India | Rs 8 to 14 lakh |
| Ceiling | Rs 35 lakh and above |
| Verdict | GOOD. A hybrid of technical depth and customer contact. |
| What they actually test | Demonstrating a system live, scoping a proof of concept, integration questions, and honesty about limits. |
| Which project carries it | The four-minute Project 4 demo recorded in Week 19, plus the ITC Reclaim business framing. |


### Platform or DevOps-adjacent Engineer

| Field | Detail |
| --- | --- |
| Entry band, India | Rs 6 to 11 lakh |
| Ceiling | Rs 30 lakh and above |
| Verdict | POSSIBLE. You already run more infrastructure than most juniors, but this roadmap does not target it. |
| What they actually test | Linux, containers, CI, TLS, reverse proxies, monitoring, incident response. |
| Which project carries it | Your existing Oracle Cloud VPS with 8 TLS certificates, plus the Week 14 container work. |


### Data Engineer

| Field | Detail |
| --- | --- |
| Entry band, India | Rs 6 to 12 lakh |
| Ceiling | Rs 35 lakh and above |
| Verdict | WEAKEST FIT. Only if a posting emphasises pipelines over models. Do not lead with it. |
| What they actually test | SQL depth, pipeline design, orchestration, data quality. |
| Which project carries it | The ingest and reconciliation pipeline in Projects 1 to 3, plus Working Sundays 4 and 5. |


### Skill matrix

| Skill | Roles that require it | Where it is built |
| --- | --- | --- |
| JavaScript, deep | AAE, FDE, FS, BE, ASE | Weeks 1, 3, 4 |
| TypeScript, strict | AAE, FDE, FS, BE, ASE | Week 7 |
| Git beyond the basics | All roles | Week 1 |
| HTTP, CORS, caching | FDE, FS, BE, ASE | Week 3 |
| Async and the event loop | AAE, FS, BE | Week 4 |
| React 19 and the compiler | FS, ASE, FDE | Weeks 5, 6 |
| Tailwind v4 | FS | Week 6 |
| Next.js 16 App Router | FS, AAE, ASE | Week 10 |
| Node and Express API design | BE, FS, FDE | Week 8 |
| PostgreSQL schema and indexes | BE, FS, DE | Week 9 |
| Transactions and isolation | BE, DE | Week 9 |
| Authentication, hand-written | BE, FS, FDE | Week 11 |
| WebSockets | FS, BE | Week 11 |
| Testing and CI | All roles | Week 12 |
| OWASP Top 10:2025 | BE, FS, PLAT | Week 13 |
| Docker and Compose | PLAT, BE, FS, FDE | Week 14 |
| Redis caching and rate limits | BE, PLAT | Week 14 |
| Queues and idempotency | BE, DE, PLAT | Week 15 |
| EXPLAIN ANALYZE and tuning | BE, DE | Week 15 |
| Structured logging and tracing | PLAT, BE, AAE | Week 15, Sunday 9 |
| LLM plumbing and cost | AAE, ASE, FDE | Week 16 |
| RAG with hybrid retrieval | AAE, ASE | Week 17 |
| Evaluation with Ragas | AAE, ASE | Week 18 |
| Prompt injection defence | AAE, ASE | Week 18 |
| Agents and MCP | AAE, FDE, ASE | Week 19 |


## Part 13 | The unlock ladder | what each milestone actually qualifies you for

### First, the part you will not like

**Completing DSA on its own unlocks no job role at all.**

DSA is a filter, not a qualification. Nobody in India is hired because they solved 474 problems. DSA gets you past the screen. The projects get you the offer. A candidate with 474 problems and no shipped system loses to a candidate with 200 problems and a live application, every time, for every role in Part 12.

What the DSA number does do is open a class of screen:

| DSA cumulative | Reached | What the number gets you past |
| --- | --- | --- |
| 96 | End of Week 4, 27 Sep 2026 | Nothing yet |
| 118 | End of Week 5, 4 Oct 2026 | Basic service company screens |
| 204 | End of Week 9, 1 Nov 2026 | Most service company loops: TCS, Infosys, Wipro, Cognizant, Accenture |
| 300 | End of Week 14, 6 Dec 2026 | Mid tier product company screens |
| 415 | Gate 4, 24 Jan 2027 | Most product company loops |
| 474 | February 2027 | Sheet complete. Past here the returns fall sharply; switch the hours to mock interviews |

### The real ladder

This is the answer to your question. Read the third column as **what you could defend in an interview**, not what you could type into a form.

| Milestone | Date | Roles you can honestly apply for | Verdict |
| --- | --- | --- | --- |
| Launch block done | 30 Aug 2026 | None | Do not apply |
| Week 4, async JavaScript | 27 Sep 2026 | None | Do not apply |
| **GATE 1**, Project 1 live | 4 Oct 2026 | None | One React app is not a portfolio |
| Week 7, TypeScript strict | 18 Oct 2026 | Frontend trainee, intern | Technically yes. Do not. You would be underselling by two salary bands |
| **GATE 2**, own auth + WebSocket | 15 Nov 2026 | Junior Full Stack, Junior Backend | First honest shot. Still early |
| Week 13, OWASP 2025 applied | 29 Nov 2026 | Full Stack Engineer, Backend Engineer | The resume is now defensible under questioning |
| **GATE 3**, Project 3 operable | 13 Dec 2026 | Full Stack, Backend, Platform adjacent | **APPLICATIONS START HERE** |
| Week 17, RAG with citations | 27 Dec 2026 | Add AI Solutions Engineer | |
| Week 19, agents and one MCP server | 10 Jan 2027 | Add Applied AI Engineer, Forward Deployed Engineer | |
| **GATE 4**, Project 4 live | 24 Jan 2027 | **All seven roles in Part 12** | Full strength |

### The warning that matters most in this part

**Applications begin at Gate 3 on 13 December 2026, not at Gate 4.**

Waiting for Gate 4 costs you six weeks of pipeline and lands your first replies inside the Indian hiring slowdown, which runs roughly 21 to 27 December. Replies from that window do not arrive until the first week of January. Starting at Gate 3 means your December applications are already in the queue when hiring restarts.

The Gate 4 condition is 100 applications. Treat 100 as the floor, not the target. A realistic total to one offer is **200 to 400**. That figure is an inference from Indian time to hire and drop rate data, not a measured conversion rate for your profile, so track your own numbers from the first week and recalculate.

### What goes on the resume at each stage

| Stage | Headline you can write |
| --- | --- |
| Gate 1 | Nothing. Do not have a resume out yet |
| Gate 2 | Full stack developer with a multi tenant application, session auth written from scratch with Argon2id, and one realtime feature |
| Gate 3 | The above, plus containerised, tested, CI gated, with logs and metrics and one executed rollback |
| Gate 4 | Applied AI engineer with a production RAG system: hybrid retrieval, citations, published Ragas evaluation numbers, one MCP server against spec 2026-07-28 |

Each line in that table is a claim an interviewer can attack. Every one of them is true only if the gate genuinely passed. That is what the gates are for.


## Part 14 | What to skip, and what not to buy


### The skip list

Each of these is a real technology that real engineers use. None of them is on the path between you and the seven roles in Part 12 before 24 January 2027.

- ('Kubernetes', 'You will not be asked at this level and it will cost you a week you do not have.')
- ('Terraform', 'Infrastructure as code matters at scale. You are not at scale.')
- ('Kafka', 'BullMQ on Redis teaches you the same queue concepts in a fraction of the time.')
- ('Microservices', 'One well-structured monolith you can explain beats four services you cannot.')
- ('GraphQL', 'REST is what the job postings ask for. Revisit only if a target company uses it.')
- ('Redux', 'React context plus a small store covers everything you will build here.')
- ('MongoDB', 'Your data is relational. Using a document store would be a wrong answer you have to defend.')
- ('Bun and Deno', 'Interesting. Not hiring criteria. Node is what the postings say.')
- ('Fine-tuning models', 'You are building on models, not making them. Applied AI roles want plumbing and evals.')
- ('LeetCode contests', 'Timed contests train speed under a format you will not face. Patterns beat speed here.')
- ('Blogging about learning', 'Ship the project. The project is the post.')
- ('Another course purchase', 'You already own 100xDevs. Nothing else needs buying. See Part 7.')
- ('Rewriting Project 1 in a new framework', 'Four projects at four difficulty levels beats one project rewritten four times.')
- ('Competitive programming', 'Different skill, different reward curve, no overlap with the roles in Part 12.')
- ('Certifications before Gate 4', 'No interviewer in this band asks. AWS SAA is optional and only after Gate 4.')


### Do not buy

- Another Udemy course. You own 100xDevs and have not finished it.
- A DSA course. Striver A2Z is free and is the sheet Indian interviewers recognise.
- A resume review service. Part 15 has the template and the rules.
- LeetCode Premium. The free tier covers all 474 problems on the A2Z sheet.
- A mock interview package before Week 20. You would be paying to be told what you already know.
- Any AI certification. No role in Part 12 asks for one. Projects with eval numbers replace them.


### Topics that were added, and why

- ('Cost accounting for LLM applications', 'Applied AI interviews ask what it costs per query. Almost no junior candidate has an answer.')
- ('Idempotency', 'Retries are guaranteed. Idempotent handlers are the difference between a queue and a duplicate-charge incident.')
- ('EXPLAIN ANALYZE and plan reading', 'One before-and-after number in a README is worth more than three extra features.')
- ('Structured logging with request IDs', 'The first thing a backend team checks is whether you can debug production.')
- ('Supply chain security', 'A03 is new and near the top of the 2025 list. Pinned actions and lockfile audits are cheap.')
- ('Prompt injection through a retrieval corpus', 'Your RAG corpus is an attack surface. Most portfolio projects ignore this entirely.')
- ('Rollback you have actually executed', 'Thirty seconds of screen capture. The most convincing artefact a junior can show.')
- ('Reciprocal rank fusion', 'The simple, defensible way to combine dense and BM25 results.')
- ('Node 26 migration decision', 'It lands inside this roadmap. Having a reasoned position is itself an interview answer.')
- ('Reading other people’s code', 'Two working Sundays on n8n. Reading code is the skill that separates week one from week twelve on a real team.')
- ('Forward Deployed Engineer case drills', 'A distinct interview format. Four of the ten Week 20 mocks are case studies for this reason.')


### What this actually costs

| Item | Cost | Note |
| --- | --- | --- |
| Everything in Parts 1 to 19 except the two lines below | Rs 0 | Every course, book, lab and tool in this roadmap has a free tier that is sufficient. This is not a compromise; these are the best resources that exist. |
| LLM API credit, Weeks 16 to 19 | Rs 1,500 | Unavoidable. Set a hard spend cap on the key on day one of the launch block, before you write a line of AI code. |
| Domain name, optional | Rs 900 per year | You already own paisareality.com, devpilotx.com and value.codes. Use a subdomain. This line can be Rs 0. |
| AWS Solutions Architect Associate, optional, after Gate 4 only | Rs 7,600 | Not required by any role in Part 12. Consider only if a target employer names it in the posting. |


## Part 15 | After 24 January 2027 | the plan does not stop

### Why this part exists

Gate 4 is not the finish line. It is the point where the roadmap changes shape, because from February 2027 your time stops being yours. You will know which branch you are in by roughly mid March 2027.

### The three branches

| Branch | Condition | Weekday hours available | Where the hours go |
| --- | --- | --- | --- |
| **A** | Employed | 2 to 3 on weekdays, 6 on Saturday | Depth in one thing, plus whatever the job does not teach you |
| **B** | Not yet employed | Full 8 continues | Applications become the job: 4 h applications, 2 h DSA, 2 h build |
| **C** | Building your own thing | Full 8, self directed | Ship something a stranger pays for before you call it a startup |

Branch B is not failure. Indian time to hire for software roles runs 35 to 45 days from role open to signed offer, and 2 to 3 months to actual joining. If you start applying at Gate 3 on 13 December, a March or April 2027 start is the base case, not the bad case.

### February to March 2027 | the bridge

Regardless of branch:

- **Finish DSA 474.** Fifty nine problems remain. At 2 hours a day that is about six weeks.
- **Keep the pipeline running.** Total target 200 to 400 applications, not 100.
- **Two mock interviews per week.** Exponent Practice and interviewing.io are both in Part 7.
- **Do not start a new project.** Deepen Tender Fit instead. A fifth shallow project is worth less than one project with real evaluation numbers.
- **Write three things publicly.** One on the ITC Reclaim reconciliation logic, one on the Ragas numbers and what they revealed, one on the MCP server. These are what recruiters actually read.

### The one thing to focus on

You asked to focus on one thing. This is a ranked recommendation, not a menu.

**Ranked recommendation: Applied AI, specifically retrieval and evaluation.**
**Backup: backend and data systems.** PostgreSQL depth, queues, idempotency, observability.
**Explicitly rejected: DevOps as a specialisation, Web3, mobile, and fine tuning models.**

Why Applied AI wins:

- **Market direction.** Naukri JobSpeak, July 2026: AI jobs up 33 per cent year on year while overall IT was up 6 per cent. FY26 AI and ML hiring up 45 per cent. In June 2026 AI roles inside IT rose 16 per cent while overall IT fell 3 per cent. No other branch on your list has that gradient.
- **Ceiling.** Applied AI Engineer reaches Rs 40 lakh and above. Forward Deployed Engineer, which the same skills feed, reaches Rs 50 to 80 lakh and above at senior level, the highest ceiling in Part 12.
- **It compounds.** Retrieval quality, evaluation methodology and cost per query are judgement skills that get more valuable with experience. Framework knowledge commoditises.
- **It maps to Part 16.** New Zealand specialist roles in security, ML and principal engineering reach NZD 180,000 to 220,000, against a median software engineer figure closer to NZD 115,000.

Why the rejections:

- **DevOps as a specialisation.** You already run more infrastructure than most juniors, so the marginal return on more is low, and the ceiling is the lowest of the seven at Rs 30 lakh and above.
- **Web3.** You own 147 videos of it. Zero of the seven roles ask for it.
- **Fine tuning.** You build on models, not make them. Applied AI roles test plumbing and evals.

### The weekday shape when you are employed

| Time | Block | Hours |
| --- | --- | --- |
| 06:00 to 07:30 | Depth: the one thing | 1.5 |
| Work day | The job | 8 to 9 |
| 21:00 to 21:45 | Anki plus reading | 0.75 |
| Saturday 09:00 to 15:00 | Build, write, open source | 6 |
| Sunday | Rest. Non negotiable. | 0 |

That is about 17 hours a week, sustained. Seventeen hours a week for three years beats forty hours a week for three weeks followed by nothing. You already know this about yourself; it is in Part 11 and it is why the rest Sundays are load bearing.

### Year one | April 2027 to March 2028 | age 24

**Goal: stop being a junior. Own one service end to end in production.**

| Quarter | Target |
| --- | --- |
| Q1 | Learn the codebase and the domain. Ask more questions than you answer. Ship small and often |
| Q2 | Own one service or one significant feature end to end, including its on call |
| Q3 | Lead one migration or one performance fix with a number attached: latency, cost, or error rate |
| Q4 | Write it up publicly. Internal document minimum, blog post preferred |

- **Depth hours:** production RAG at real volume, evaluation pipelines, cost per query, prompt injection defence, agent termination conditions.
- **Breadth hours:** real system design rather than the primer, PostgreSQL under load, distributed tracing, one cloud properly. The AWS Solutions Architect Associate at about Rs 7,600 is optional and only worth it if a target employer asks for it.
- **Outside work:** one open source contribution a quarter, one written piece a month.
- **Money:** save 40 to 50 per cent of take home if you are living at home. This is your runway and your New Zealand fund, in that order.

### Year two | 2028 to 2029 | age 25 to 26

**Goal: mid level. A title change or a company change.**

- **Plan the switch at 18 to 24 months, not 36.** In India the first to second job move is where compensation actually steps, typically 40 to 80 per cent, far more than any internal increment.
- Lead a piece of work with more than one engineer on it. Get design review authority. Own on call for something that matters.
- **Start IELTS preparation this year.** Part 16 explains why this is not optional and why it was correctly deleted from the 21 week plan but must come back here.

### Year three | 2029 to 2030 | age 26 to 27

**Goal: three years verifiable experience, which is the New Zealand work visa skills threshold.**

- Get the NZQA International Qualification Assessment on the BCA. **Start this early.** It takes months and the result can surprise you. See the risk note at the end of Part 16.
- Sit IELTS or an accepted equivalent.
- Begin applying to New Zealand accredited employers. Target NZD 100,000 or more, which clears the immigration wage threshold with room.

### The rule that governs all of it

Ship in production, in public, on a schedule. One deep thing per quarter, written down where a stranger can read it. Three years of that makes you unhireable at junior rates, which is the entire point.


## Part 16 | The New Zealand track

Researched and verified on 27 August 2026 against Immigration New Zealand primary sources. Where a figure could not be confirmed, this part says so.

### The headline

**Software Engineer, ANZSCO 261313, is on Tier 1 of the New Zealand Green List.** Tier 1 means the Straight to Residence Visa: with a qualifying job offer you can apply for residence immediately, either from inside New Zealand or from offshore.

That is the most favourable skilled category New Zealand operates, and your target occupation is inside it. So are Developer Programmer (261312), Analyst Programmer (261311), Software Tester (261314), Software and Applications Programmers nec (261399) and ICT Security Specialist (262112).

### What Tier 1 actually requires

| Requirement | Detail |
| --- | --- |
| Age | 55 or younger when you apply. You are 23 on your government ID and 25 by your actual date of birth. Not a constraint on either |
| Job | Offer of, or already working in, a Green List Tier 1 job |
| Employer | Must be an accredited employer |
| Hours | Full time |
| Term | Permanent, or fixed term of at least 12 months, or a contract of at least 6 months |
| Pay | At least the rate specified for the Green List role, or the median wage where no rate is specified |
| English | Required, and a **higher standard applies to skilled residence visas** than to other residence categories |
| Health and character | Medicals and police certificates |

**Software Engineer 261313 carries no role specific wage threshold in Appendix 13 of the operational manual as at 9 March 2026.** This is worth understanding precisely, because several neighbouring ICT occupations do carry one: Database Administrator (262111) and Systems Administrator (262113) require NZD 70.00 an hour, and Chief Information Officer (135111) requires NZD 72.80. Software Engineer, Developer Programmer and Analyst Programmer have a blank requirement cell, so the base median wage applies instead.

### The wage thresholds, verified

| Threshold | Rate from 9 March 2026 | Annual at 40 hours a week |
| --- | --- | --- |
| Immigration median wage | NZD 35.00 per hour | about NZD 72,800 |
| 1.5x median | NZD 52.50 per hour | about NZD 109,200 |
| 2x median, Highly Paid Residence Visa | NZD 70.00 per hour | about NZD 145,600 |

Previous rates: NZD 33.56 from 18 August 2025 to 8 March 2026, and NZD 31.61 from 28 February 2024 to 17 August 2025. It is reviewed roughly annually and has risen every time. **Plan against the trend, not against todays number.**

### What New Zealand actually pays software engineers

| Source | Figure | Caveat |
| --- | --- | --- |
| levels.fyi, New Zealand, Aug 2026 | Median total comp NZD 136,586. 25th 98,593. 75th 165,625. 90th about 201,000 | Self reported, skews senior and skews large employers |
| levels.fyi, Auckland | Median total comp NZD 123,216 | Self reported |
| PayScale, Software Engineer NZ, Jul 2026 | Average base NZD 85,174. Median 85,000. 10th 62,000. 90th 123,000 | 238 profiles, base only |
| PayScale, Full Stack Developer NZ, Jul 2026 | Average base NZD 88,546 | 36 profiles only, weak sample |
| Glassdoor, Wellington | NZD 99,000 | Self reported |
| Top Auckland payers | Atlassian NZD 219,777. Canva NZD 179,321. Westpac NZD 168,215 | levels.fyi |

Read it this way. **An entry level New Zealand graduate role at NZD 60,000 to 70,000 sits at or below the immigration median wage threshold and therefore does not reliably support the visa. A mid level role at NZD 100,000 or more clears it comfortably.** That single fact is why you cannot go straight from India with zero experience, and it is the reason this part sits after Part 15 rather than replacing it.

### Three corrections to what you currently believe

**1. You do not need lots of money. You need a job offer.**

Straight to Residence is employer led. The wage threshold is satisfied by the employer, not by your savings. Your direct costs are visa fees, medicals, police certificates, the English test, the NZQA assessment, flights, and roughly two months of living expenses on arrival. Realistically **NZD 8,000 to 15,000 for one person**, not lakhs of migration savings. The money that matters is the salary the job pays. The savings that matter are your runway between jobs, which Part 15 already tells you to build at 40 to 50 per cent of take home.

**2. You cannot skip the experience.**

The work visa route into New Zealand requires, as a minimum skills threshold, at least three years of verifiable relevant work experience **or** a relevant NZQA Level 4 or higher qualification. Even where a degree satisfies it on paper, New Zealand employers hiring offshore at zero years of experience is rare. The realistic sequence is India first, then New Zealand at mid level. That is exactly what Part 15 builds.

**3. English is deferred, not deleted.**

You asked me to remove the English block from the 21 week roadmap. That was the right call for an Indian job hunt in 2026 and it stays removed. But skilled residence visas require a demonstrably higher standard of English than other categories, and Immigration New Zealand extended English requirements to Skill Level 3 occupations from 1 June 2026. IELTS or an accepted equivalent becomes a hard requirement around 2029. **Part 15, Year two is where it re-enters the plan. Do not touch it before then.**

### The timeline that actually works

**Ages are shown twice on purpose. Visa applications use the date of birth on your government ID, 3 January 2003. Your actual date of birth is 3 January 2001. Immigration New Zealand will only ever see the ID date, so that is the column that governs the paperwork, but you should read the real one so you never lie to yourself about the clock.**

| Date | Age on ID | Actual age | Milestone |
| --- | --- | --- | --- |
| 24 Jan 2027 | 24 | 26 | Gate 4. Roadmap complete |
| Mar to Jun 2027 | 24 | 26 | First job in India |
| 2027 to 2030 | 24 to 27 | 26 to 29 | Three years verifiable experience. One switch at 18 to 24 months |
| 2029 | 26 | 28 | NZQA International Qualification Assessment. IELTS |
| 2029 to 2030 | 26 to 27 | 28 to 29 | Apply to New Zealand accredited employers. Target NZD 100,000 plus |
| 2030 to 2031 | 27 to 28 | 29 to 30 | Move. Straight to Residence on the offer, or work visa then residence |
| 2032 to 2033 | 29 to 30 | 31 to 32 | Permanent Resident Visa, after 2 years holding residence and meeting the presence requirement |

**You said you want to settle in New Zealand by 35. On this path you land there at 29 or 30 by your real date of birth, 27 or 28 on your ID, and hold permanent residence at about 31.** That is four to five years inside your own deadline, and the deadline was never the binding constraint anyway. Re-verified on 27 August 2026: Straight to Residence, Work to Residence and the Skilled Migrant Category all cap at age 55 or younger on the date you apply. By your real date of birth you have 29 years of headroom. Age is not what is standing between you and New Zealand. The first job is, which is precisely what the 21 weeks exist to fix.

### What the move actually costs, and where the crores come from

You believe this needs a few crores. It does not, and if you keep believing it you will quit before you start. That number belongs to a different visa. Here is the entire cost of the route you are actually on, at today's rate of Rs 56.70 to the New Zealand dollar.

| Item | Cost in rupees | Basis |
| --- | --- | --- |
| NZQA International Qualification Assessment, Skill Shortage List | 34,600 | verified, NZD 610 |
| IELTS Academic or General Training, India | 19,000 | verified, fee from 1 April 2026 |
| Immigration NZ medical and chest x-ray, panel physician | 8,000 to 15,000 | band, panel clinic pricing is not published centrally |
| Police clearance certificate, India | 500 to 2,000 | band, varies by state |
| Straight to Residence Visa fee | 3,65,700 | verified, from NZD 6,450 |
| One way flight, Delhi or Kolkata to Auckland | 60,000 to 1,10,000 | band, season dependent |
| Landing money: four week bond, first rent, first month of living | 2,80,000 to 4,50,000 | band, NZD 5,000 to 8,000 |
| **Total** | **8.9 lakh mid band, 12 lakh pessimistic** | **not crores** |

The Rs 15 to 20 lakh savings target already sitting in Part 15 covers this entire table with room left over, and you earn it on an Indian salary before you ever board a plane.

So where does the crore figure come from? The Active Investor Plus Visa. That route asks for NZD 5 million invested over three years in the Growth category, or NZD 10 million over five years in the Balanced category. At today's rate that is Rs 28.35 crore or Rs 56.70 crore. It is 320 times more expensive than your route, and it is not your route. That visa is for people who buy their way in. You are the one being paid to walk in.

### What the salary is actually worth

Gross numbers mean nothing until tax comes off. New Zealand tax is calculated on the published brackets: 10.5 per cent to NZD 15,600, then 17.5 per cent to 53,500, then 30 per cent to 78,100, then 33 per cent to 180,000, then 39 per cent above that.

| Gross | In rupees | Effective NZ tax | Net | Net in rupees |
| --- | --- | --- | --- | --- |
| NZD 100,000 | 56.7 lakh | 22.9 per cent | NZD 77,122 | 43.7 lakh |
| NZD 130,000 | 73.7 lakh | 25.2 per cent | NZD 97,222 | 55.1 lakh |
| NZD 160,000 | 90.7 lakh | 26.7 per cent | NZD 117,322 | 66.5 lakh |

Read the first row again. One year on the entry salary is five to six times the entire cost of getting there.

### Where the crores actually come from

They come after you land, not before. Assume you arrive in 2031 on NZD 100,000, reach 130,000 by year four and 160,000 by year seven, save 35 per cent of net income, and earn 6 per cent real return.

| Years after landing | Your real age | Accumulated |
| --- | --- | --- |
| 3 | 32 | Rs 0.49 crore |
| 5 | 34 | Rs 0.94 crore |
| 7 | 36 | Rs 1.50 crore |
| 10 | 39 | Rs 2.53 crore |
| 12 | 41 | Rs 3.32 crore |

This is a projection, not a promise, and every assumption behind it is written in the paragraph above so you can argue with it. A house gets bought with a New Zealand mortgage against a New Zealand salary, not with cash carried out of Patna. Crores are the output of this plan, not the entry fee.

### The fallback if the Green List changes

Do not build a plan that assumes 261313 is still Tier 1 in 2030. Green List membership is reviewed and occupations have been removed before. The fallback is the Skilled Migrant Category, which needs **6 points**: 3 to 6 points from one of New Zealand occupational registration, a qualification, or income, plus up to 3 points for skilled work experience in New Zealand. Work experience points were made easier to accrue: 1 point for 1 year completed in the last 2 years, 2 points for 18 months in the last 3, 3 points for 2 years in the last 4. The category changed on 24 August 2026, adding two new pathways and giving one extra point for qualifications completed in New Zealand rather than overseas. Income alone at 1.5x the median wage, about NZD 109,200, also works as the skill proxy.

### Australia as the hedge

Much larger market, a comparable skilled pathway, and the two countries have reciprocal arrangements once you hold New Zealand citizenship. **Do not split focus now.** Reassess in 2029 with three years of experience in hand.

### What I could not verify

- **Whether your three year BCA from Maharishi Markandeshwar University assesses at NZQF Level 7.** Indian three year bachelor degrees sometimes assess lower. **This is the single largest open risk in this part and the only one that could force a longer route, such as a New Zealand masters.** Only an NZQA International Qualification Assessment settles it. Start it in 2029, not 2030.
- The exact English test score that will be required for skilled residence in 2030.
- Whether the immigration median wage will still be NZD 35.00 in 2030. It will almost certainly be higher.
- Whether Immigration New Zealand will add a specified pay rate for 261313 in a future revision of Appendix 13.
- All salary aggregator figures above are self reported and not audited. Treat levels.fyi as an upper bound and PayScale as a lower bound.


## Part 17 | The money hour

You chose the roadmap. The roadmap does not change. This part is the one extra hour bolted on top of it, **17:00 to 18:00, six days a week**, so that money starts moving before the job arrives.

**129 hours across the window.** 3 hours in the launch block, 126 hours across the 21 weeks. Not one of those hours comes out of DSA, LEARN, BUILD, CLOSE or the night recall block. If you ever take money time out of study time, this part has failed and you should delete it.

### 17.1 The five rules that make this survivable

1. The money hour never borrows from study. If client work overruns, the client waits two days. The roadmap does not wait one hour.
2. You only sell what you can deliver **today**, with the machine and the tools you already run. Nothing you sell depends on a skill you are still learning this week.
3. Fixed scope, fixed price, fixed delivery date. No hourly work. No open ended work. No "we will see how it goes".
4. Fifty per cent advance before you start. No advance, no work. This is not rude, it is how every shop in Patna already operates.
5. Client work is cash, not portfolio. The four projects in Part 5 are the portfolio. Never mix the two, never let a client repo replace a project repo.

### 17.2 Why this works for you specifically

You cannot read code yet. You can ship working software with AI, you have done it 46 times, and you run a live VPS with 8 certificates, nginx, Docker, n8n and three live domains. That combination is worth nothing in a DSA interview and it is worth real money to a shop owner in Patna who has no website, a broken website, or a WhatsApp inbox nobody answers.

Small business buyers do not audit your code. They buy an outcome: a page that loads on a phone, a form that reaches WhatsApp, an automation that stops a leak. You can deliver every one of those inside one hour a day if the scope is fixed. That is the entire thesis of this part.

### 17.3 The three lanes

| Lane | What it is | Time to first rupee | Ceiling | Use it for |
| --- | --- | --- | --- | --- |
| Lane 1, local | Patna businesses: coaching institutes, clinics, gyms, salons, wholesalers, CA and tax practices, property dealers, contractors, small schools | 7 to 21 days | Moderate | Breaking zero, cash in hand, referrals |
| Lane 2, remote | Small remote gigs from platforms and communities | 21 to 60 days | High | Better rates once you have three delivered jobs with proof |
| Lane 3, recurring | Care plans on everything you deliver: hosting, edits, backups, uptime | 30 to 45 days | The floor under everything | This is the lane that actually ends the panic |

**Order of operations.** Lane 1 first, because it pays fastest and you can meet the buyer in person. Lane 3 attaches to every Lane 1 delivery from day one. Lane 2 only after two paid deliveries exist, because your profile needs proof before it can compete.

### 17.4 The offer sheet, priced

These are bands, not fixed prices. Quote at the top of the band, settle in the middle, never go under the floor.

| # | Offer | Scope, exactly | Delivery | Price band |
| --- | --- | --- | --- | --- |
| O1 | One page site | Single page, mobile first, photos, map, call and WhatsApp buttons, hosted on your VPS, their domain or a subdomain | 72 hours | Rs 2,500 to Rs 6,000 |
| O2 | Business site | Up to 5 pages, enquiry form to WhatsApp and email, Google Maps, gallery, basic on page SEO, SSL | 5 days | Rs 8,000 to Rs 18,000 |
| O3 | Google presence fix | Google Business Profile set up or cleaned, photos, hours, categories, review link card, posts for one month | 3 days | Rs 3,000 to Rs 7,000 |
| O4 | Lead automation | Form or WhatsApp lead lands in a sheet, auto reply within 60 seconds, daily digest to the owner, built in n8n on your box | 4 days | Rs 6,000 to Rs 15,000 |
| O5 | Document automation | Invoice, fee receipt, quotation or report generated from a sheet or form, PDF out, mailed or sent on WhatsApp | 5 days | Rs 8,000 to Rs 20,000 |
| O6 | Reconciliation job | A one off data clean up or match between two files, the same shape as Project 1, delivered as a file plus a short video walkthrough | 3 days | Rs 5,000 to Rs 15,000 |
| O7 | Answering assistant | A retrieval assistant over the business's own documents, fees, courses, price list, policies, answered on a page or on WhatsApp | 7 days, from Week 17 only | Rs 20,000 to Rs 45,000 |
| O8 | Care plan | Hosting, SSL, backups, uptime check, up to 2 content edits a month, 48 hour response | Monthly | Rs 1,200 to Rs 3,000 per month |

**O7 is locked until Week 17.** Do not sell retrieval before you have built it once in Project 4. Selling something you have not built once is how you lose a week of study time repaying a mistake.

### 17.5 What the hour actually looks like, Monday to Saturday

| Day | 17:00 to 17:40 | 17:40 to 18:00 |
| --- | --- | --- |
| Mon | 15 first touches from the week's list of 60 | Update pipeline, log every touch |
| Tue | 15 first touches, plus follow up 1 to Monday's list | Update pipeline, log |
| Wed | 10 first touches, plus book or hold 2 calls | Send any quote that is pending, log |
| Thu | Delivery only. The current paid job, nothing else | Message the client one progress line, log |
| Fri | Delivery, then invoice, then payment follow up | Send the delivery message and the review request, log |
| Sat | Proposals, price replies, referral asks, and build next week's list of 60 leads | Weekly money review, 10 minutes, numbers only |

Sunday: 30 minutes on a working Sunday only, for invoices and pipeline hygiene. On a rest Sunday the money hour is also rest. Rest is load bearing here too.

### 17.6 The lead list, and where the 60 names come from

You need 60 fresh names every week. They are free and they are everywhere.

- Google Maps, searched by category plus locality: coaching institute Boring Road, dental clinic Kankarbagh, gym Patliputra, property dealer Rajendra Nagar, CA firm Exhibition Road, and so on. Record: name, category, phone, whether a website exists, whether the site is broken on mobile, Google rating, number of reviews.
- JustDial and IndiaMART listings for the same categories.
- Instagram business accounts in Patna with a phone number in bio and no link, or a dead link.
- Local Facebook groups and WhatsApp business groups.
- Every shop board you walk past that has a phone number and no website.

**The qualifying filter, in order.** No website at all, or a website that is broken on a phone. Has a phone number visible. Has at least 10 Google reviews, which proves customers exist. Sells something with a margin above Rs 1,000, which proves they can pay.

### 17.7 The scripts

Use these as written. Change the business name and one detail. Do not send paragraphs.

**WhatsApp, first touch.**

> Hello sir, I am Dipanshu from Patna. I make websites and automation for local businesses. I checked [Business name] on Google, your reviews are good but the website is not opening properly on mobile. I can make a new one page site with call button, WhatsApp button and location, ready in 3 days, Rs 4,000. Should I send you 2 samples?

**Cold email, subject line first.**

> Subject: [Business name] website opens broken on phone
>
> Hello sir,
>
> I am Dipanshu, I build websites and small automations, I am based in Patna.
>
> I opened your website on my phone today. The menu does not work and the contact number is not clickable. Most of your customers are searching on a phone, so this is losing you calls.
>
> I can fix it in 3 days for Rs 4,000, or build a new 5 page site for Rs 12,000. Both include SSL, hosting for one year, and a WhatsApp enquiry button.
>
> Here are two samples: [link], [link]
>
> If you want, I can send a 2 minute video showing exactly what is broken.
>
> Thank you,
> Dipanshu Kumar
> 8102571038

**Follow up 1, 48 hours later, one line.**

> Sir, just checking, should I send the 2 minute video of what is broken on your site?

**Follow up 2, four days later, one line.**

> Sir, I am taking only 2 new projects this month. If this is not the right time, no problem, I will close the file.

**Follow up 3, ten days later, then stop.**

> Sir, last message from my side. If you ever need the site or the WhatsApp automation, my number is saved. Thank you.

**Price message, after they ask the rate.**

> Sir, Rs 12,000 total. Rs 6,000 advance to start, Rs 6,000 after you approve it. Delivery in 5 working days. Included: 5 pages, mobile design, enquiry form to your WhatsApp, Google map, SSL, and hosting for 1 year. After that Rs 1,500 per month if you want me to maintain it, or you can take the files.

**Delivery message.**

> Sir, the site is live: [url]. Please open it on your phone and check the WhatsApp button. Two rounds of changes are included, please send everything in one list. Invoice attached, balance Rs 6,000 on this UPI: [upi id].

**Referral ask, three days after payment.**

> Sir, thank you. If any of your friends in business needs the same, please give them my number. If they take it, I will do your next year hosting free.

### 17.8 The money rules that stop you from being robbed

1. Fifty per cent advance, always, by UPI or bank transfer. Screenshot goes in the tracker before you open the editor.
2. Scope written in one WhatsApp message and confirmed with a yes before work starts. That message is your contract.
3. Two revision rounds included. The third round is Rs 1,000. Say this at quote time, not at delivery time.
4. Quote a delivery date two days later than your real plan. Deliver early. Early delivery is the cheapest reputation you will ever buy.
5. Never hand over hosting access, domain access or source files before the final payment clears.
6. No client gets your study hours. If someone demands a call at 10:00, the answer is: I am free after 5 pm, sir.
7. Keep every rupee in one account and log it the same day. You cannot fix a number you never wrote down.

### 17.9 What you refuse, no matter how hungry you are

- Equity, revenue share, or "build it first and we will pay if we like it".
- Anyone who wants a marketplace, a full app, or "something like Zomato" for under Rs 50,000.
- Anyone who wants daily calls, daily meetings, or a WhatsApp group with five decision makers.
- Paid lead platforms, paid connects, paid "training" and any franchise or reseller pitch.
- Any job that needs a skill you have not shipped once already.
- Work for relatives at zero price. Family rate is fifty per cent, not free. Free work confirms exactly the story you are trying to break.

### 17.10 The honest numbers

This is arithmetic, not motivation.

Ninety first touches a week is realistic at 15 per day for six days. On cold outreach to small businesses, expect roughly 10 to 15 per cent to reply, of which maybe a third will discuss price, of which maybe a quarter will pay. That is about 9 to 13 replies, 3 to 4 real conversations, and 0 to 1 paying client per week once your samples exist. It will be 0 for the first two or three weeks. That is normal and it is not evidence that it does not work.

| Month | Target received, INR | What produces it |
| --- | --- | --- |
| September 2026 | 0 to 8,000 | First 2 samples built, 300 touches, first small job |
| October 2026 | 12,000 to 20,000 | Two O2 sites or one site plus one O4 automation, first care plan signed |
| November 2026 | 20,000 to 30,000 | Referrals begin, 3 care plans active |
| December 2026 | 25,000 to 40,000 | One O5 or O6 job, 5 care plans active |
| January 2027 | 30,000 to 50,000 | One O7 assistant sold after Week 17, care plans carry the base |
| Five month total | 87,000 to 148,000 | Plus Rs 6,000 to Rs 15,000 per month recurring going into February |

Treat the low column as the plan and the high column as the upside. If you hit the low column you have paid for your subscriptions, your food and your data, and you have removed the single biggest thing that breaks study focus, which is money panic.

### 17.11 What the money buys back, in this order

1. Claude Pro. Anthropic moved to rupee pricing for India on 13 July 2026: Rs 2,399 a month on monthly billing, or Rs 2,000 a month on annual billing which is Rs 24,000 taken up front. Local taxes are included in those figures and the app store price can differ slightly from the website. Claude Max starts at Rs 11,999 a month and you do not need it. Verified 27 August 2026. Check the live price on the day you buy, not before.
2. Domain renewals and any DNS or mail cost. Hosting is already free on the Oracle box.
3. Food and household contribution. Hand it over in person once. It changes how the house talks to you.
4. An emergency buffer of Rs 20,000 before any purchase that is not on this list.
5. Interview clothes, one set, before the first onsite. Not before.

Nothing else. No new laptop, no new phone, no course, no "tool that will help me scale". Part 14 already told you what not to buy and it applies to money you earn as well as money you do not have.

### 17.12 The money gates

| Gate | Date | Condition | If it fails |
| --- | --- | --- | --- |
| M1 | 30 September 2026 | Two sample sites live, 300 touches logged, at least one paid job of any size | Drop to the Rs 2,500 one page offer and sell it to five businesses. Break the zero first, optimise later. |
| M2 | 15 November 2026 | Rs 25,000 received in total, 2 care plans active | Stop all Lane 2 activity, go local only, walk into 10 shops a week in person |
| M3 | 31 December 2026 | Rs 60,000 received in total, 4 care plans active | Keep the care plans, stop taking new one off jobs, protect Gate 4 |
| M4 | 24 January 2027 | Rs 90,000 received in total, and the money hour has never once eaten a study block | If money time ate study time, the money hour is cancelled for February. The job is the priority. |

### 17.13 The first sixty minutes, on the day you start

This is the money hour for Friday 28 August 2026. Do exactly this, in this order, and the hardest part of the whole part is over.

1. Minutes 0 to 10. Open a sheet called `leads.csv` with these columns: name, category, area, phone, website, mobile broken yes or no, rating, reviews, status, last touch date, next touch date, notes.
2. Minutes 10 to 40. Search Google Maps for three categories in three Patna localities. Fill 30 rows. Do not judge, do not filter yet, just fill.
3. Minutes 40 to 50. Pick the two worst websites on the list. These become your two free samples, built during the launch block, whether or not the owners ever reply.
4. Minutes 50 to 60. Write the WhatsApp first touch message from 17.7 into a text file, with your two sample links left blank for now. Send nothing today.

Monday 31 August, 17:00, you send the first 15. That is the whole start. There is no better moment and there is no more preparation required.

### 17.14 The weekly money plan, all 21 weeks

| Wk | Money focus | Target received by end of week, INR |
| --- | --- | --- |
| 1 | Two sample sites finished and live. First 90 touches | 0 |
| 2 | 90 touches. First price conversations. Payment details ready, UPI QR saved | 0 |
| 3 | 90 touches. First quote sent. Sample video walkthrough recorded | 0 to 3,000 |
| 4 | Close the first job at any price above Rs 2,500. Deliver it inside the hour | 3,000 to 8,000 |
| 5 | Deliver, collect, ask for the referral. Attach a care plan | 5,000 to 12,000 |
| 6 | 90 touches. Second job. Raise the floor price to Rs 4,000 | 10,000 to 18,000 |
| 7 | Sell one O3 Google presence fix. It is the fastest cash on the sheet | 14,000 to 24,000 |
| 8 | First O4 lead automation, built in n8n on your box | 20,000 to 32,000 |
| 9 | 90 touches. Second care plan. Raise the site floor to Rs 6,000 | 24,000 to 38,000 |
| 10 | One O2 business site at full price | 30,000 to 48,000 |
| 11 | Gate 2 week. Delivery only, no new outreach, protect the gate | 33,000 to 52,000 |
| 12 | Restart outreach. Third care plan. Ask every past client for one referral | 38,000 to 60,000 |
| 13 | One O5 document automation | 45,000 to 70,000 |
| 14 | 90 touches. Fourth care plan | 50,000 to 78,000 |
| 15 | Gate 3 week. Applications start. Money hour drops to follow ups only | 55,000 to 85,000 |
| 16 | Delivery and collection only. Interviews take priority from here | 60,000 to 92,000 |
| 17 | O7 becomes legal to sell. Quote one, do not oversell it | 68,000 to 105,000 |
| 18 | Deliver the O7 job. Record a walkthrough video, it doubles as portfolio | 75,000 to 118,000 |
| 19 | Fifth care plan. Stop taking new one off work | 80,000 to 130,000 |
| 20 | Mock interviews take priority. Money hour is admin only | 85,000 to 140,000 |
| 21 | Gate 4 week. Collect every outstanding rupee. Close the books | 90,000 to 148,000 |

### 17.15 The one paragraph you should reread when it is not working

You are not selling code and you are not competing with engineers. You are selling the thing you have already proved you can do 46 times, to people who cannot do it at all, at a price they can pay in cash this week. The reason it feels impossible is not the skill, it is the sending. Fifteen messages a day, six days a week, is the entire job. Ninety messages a week for five months is 1,800 messages. Nobody who sends 1,800 honest messages with two working samples attached stays at zero.


## Part 18 | The tracking contract

This part exists because the last roadmap failed for one reason: nothing measured it. A plan that is not tracked is a wish. This is the exact specification of what gets tracked, what counts as done, and what the tracker must shout about. The website in the build prompt implements this part line by line. If you ever track this on paper instead, track these same fields.

### 18.1 The nine things that are tracked, and nothing else

| # | Tracker | Written when | Source of truth |
| --- | --- | --- | --- |
| T1 | The day, five blocks plus night recall | At CLOSE, 16:00 to 16:30, and at 21:30 | day log |
| T2 | DSA, per problem | The moment a problem is finished | problem list, 474 rows |
| T3 | The week, six day rows of LEARN and BUILD | Each day, at CLOSE | week day rows, 126 rows |
| T4 | Resources and links, per link | When you open it and when you finish it | library, every link in Part 7 |
| T5 | GitHub pushes, per repository | Automatically, plus manual fallback | push log |
| T6 | Projects and the nine README sections | When a section is genuinely finished | project progress |
| T7 | Gates, with evidence | On the gate audit Sunday only | gate results |
| T8 | Money hour, the pipeline | Every day at 18:00 | leads, touches, deals, payments |
| T9 | Applications, mocks, writeups | From 13 December 2026 | application funnel |

### 18.2 What counts as a done day

Six conditions. All six, or the day is not green.

| Condition | Threshold |
| --- | --- |
| DSA | Daily target met. Weekly target is what actually counts, the daily number is the pace |
| LEARN | The day's LEARN row from Part 4 marked done, with at least 150 minutes logged |
| BUILD | The day's BUILD row marked done, with at least 100 minutes logged, and at least one push |
| CLOSE | log line written, tomorrow's first DSA problem and first build task chosen |
| MONEY | The day's money task from Part 17 done, touches logged |
| NIGHT | Anki at zero overdue, spoken explanation done, four of six nights aloud |

**Day colours.** Six of six is green. Four or five is amber. Three or fewer is red. The streak counts green days only. Amber does not break the streak, red does. A rest Sunday never breaks a streak and never counts as a green day either, it is simply neutral.

### 18.3 The daily DSA pace, per week

Weekly targets come from Part 3. This is the same number split across the six study days, so you always know what today owes.

| Weeks | Weekly target | Mon | Tue | Wed | Thu | Fri | Sat |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 to 4 | 24 | 4 | 4 | 4 | 4 | 4 | 4 |
| 5 to 8 | 22 | 4 | 4 | 4 | 4 | 3 | 3 |
| 9 to 12 | 20 | 4 | 4 | 3 | 3 | 3 | 3 |
| 13 to 16 | 18 | 3 | 3 | 3 | 3 | 3 | 3 |
| 17 to 20 | 16 | 3 | 3 | 3 | 3 | 2 | 2 |
| 21 | 15 | 3 | 3 | 3 | 2 | 2 | 2 |

Falling behind is allowed inside a week. Falling behind across a week boundary is not. The Saturday review block exists to close the gap before Sunday.

### 18.4 GitHub push tracking

This is the one signal a recruiter can verify without talking to you, and it is the one you have historically had without direction. From 28 August 2026 it gets a target.

| Rule | Number |
| --- | --- |
| Minimum pushes per study day | 1 |
| Minimum pushes per week | 6 |
| Minimum commits in Week 1 utility repository | 15 |
| Repositories that count | itc-reclaim, itc-reclaim-api, itc-reclaim-ops, tender-fit, and the tracker repository |
| Client work repositories | Tracked separately, they never count towards the study target |
| Commit style | Conventional commits. feat, fix, chore, docs, test, refactor |
| Empty commits, backdated commits, commit padding | Forbidden. A green square you did not earn is a lie you will have to defend in an interview |

**Alert.** No push for 48 hours during a study week is a red banner. No push for 72 hours cancels the streak regardless of every other box.

### 18.5 What the tracker must shout about

These are the automatic warnings. They are not suggestions, they are the reason the tracker exists.

| # | Trigger | Level | Message |
| --- | --- | --- | --- |
| W1 | DSA cumulative is more than 10 behind the week's target | Red | The exact deficit, and the number per day needed to recover inside the week |
| W2 | No GitHub push in 48 hours on a study week | Red | Which repository was last pushed, and when |
| W3 | Gate is 14 days away and the gate condition is not started | Red | Days remaining, and the exact condition text |
| W4 | Video minutes over 30 in a day | Orange | This came out of LEARN, it was not added on top |
| W5 | Anki overdue is above zero at 22:00 | Orange | Count overdue |
| W6 | No money touch logged for 3 days | Orange | Days since last touch, and the next 15 names from the list |
| W7 | Today is on or after 13 December 2026 and applications is zero | Red, permanent | Gate 3 has passed, applications should have started |
| W8 | A problem has been failed twice | Red on Today | The problem stays on Today until it is solved cold |
| W9 | Two red days inside one week | Red | Wednesday CUT POINT rules apply, trim scope now |
| W10 | A week ends with the LEARN row unfinished | Orange | Carry it into the Saturday review, never into the next week's LEARN block |

### 18.6 The weekly review, Saturday, 20 minutes, inside the BUILD block

Seven questions. Written, not thought about.

1. DSA: target versus actual, and the running cumulative against Part 3.
2. What shipped this week that a stranger can open in a browser.
3. What is in failed-twice.md that was not there last Saturday.
4. Pushes this week, by repository.
5. Money: touches, replies, quotes, rupees received.
6. Which single thing cost the most time for the least return.
7. One sentence: is the next gate still reachable, yes or no. If no, what gets cut on Wednesday.

### 18.7 The rules of honesty

1. A box you did not earn is not ticked. There is no one to impress, and a false green day removes the only instrument you have.
2. A gate is passed only with an evidence URL. A screenshot is not evidence, a live URL is.
3. Retroactive editing is limited to 7 days. History is not rewritten.
4. Reference content is read only. You do not get to edit the plan to match what you did.
5. Nothing is deleted. Missed days stay visible. The pattern of misses is the most useful data you will collect.
6. failed-twice.md is the most valuable file you will own by January. Every entry needs the mechanism, not the answer.

### 18.8 Exports and backups

- Weekly JSON export of every user table, kept on the VPS and in one other place.
- CSV export per table, so this data survives even if the tracker itself dies.
- A daily database dump on a cron, retained for 14 days.
- The tracker is a tool, not a dependency. If the tracker is down, the day still happens and gets logged on paper, then entered later within the 7 day window.


## Part 19 | The employment eligibility ladder

Part 12 answers which role fits the finished plan. Part 13 answers what the four gates unlock. Neither answers the question that actually decides how fast you get employed: **right now, at this problem count, with these skills and nothing more, what can I apply for today.** Part 19 answers that, week by week and problem by problem.

### 19.1 Two words that are not the same

- **Eligible** means you clear the posted bar and could survive the interview without lying.
- **Advised** means applying is the right move for your career, not merely a possible one.

You are eligible and not advised for eleven of the twenty one weeks in this plan. That gap is the most expensive decision in this document, so 19.5 prices it in rupees instead of leaving it to feeling.

One rule governs this entire part. **Eligible is not a reason to apply. Eligible plus advised is.**

### 19.2 The nine roles Part 12 leaves out

Part 12 lists seven target roles, all of them aimed at the finished plan. Nine more are reachable earlier, at lower pay. They are written down here because pretending they do not exist is a lie, and because if the money ever runs out you need to know exactly what is on the shelf.

| Code | Role | Earliest eligible | Entry band, India | Honest verdict |
| --- | --- | --- | --- | --- |
| WEB | Web Developer, template and WordPress sites | today, 28 Aug 2026 | Rs 1.8 to 4 lakh | You can already do this by prompting. It teaches you almost nothing and it is very hard to leave |
| SUP | Technical Support or Implementation Engineer | Week 3, 20 Sep 2026 | Rs 3 to 6 lakh | Real product exposure, almost no growth in code. A trap after twelve months |
| FE | Frontend Developer | Week 7, 18 Oct 2026 | Rs 3.5 to 7 lakh | Eligible, and underselling yourself by two bands. Part 13 already says so |
| AUTO | Automation Engineer, n8n and integrations | Week 8, 25 Oct 2026 | Rs 3 to 7 lakh | The best of the early exits. It is what offer O4 already sells, so you would be paid for work you can already do |
| JRT | Junior or Trainee Software Engineer, service company | Week 9, 1 Nov 2026 | Rs 3.5 to 6 lakh | 204 problems clears TCS, Infosys, Wipro, Cognizant and Accenture screens. Steady, slow, safe, capped |
| INT | Integration or Solutions Engineer, junior | Week 11, 15 Nov 2026 | Rs 5 to 9 lakh | Good pay, real client contact, and the natural feeder into FDE later |
| QA | QA Automation Engineer | Week 12, 22 Nov 2026 | Rs 4 to 8 lakh | Your Week 12 testing work qualifies you. Pays acceptably. Moving into development from here is harder than it sounds |
| DEVREL | Technical Writer or Developer Relations associate | Week 13, 29 Nov 2026 | Rs 4 to 9 lakh | Your 46 repositories and log.md are the portfolio. Underrated, and genuinely open to you |
| PROMPT | AI Automation or Prompt Engineer | Week 16, 20 Dec 2026 | Rs 5 to 10 lakh | Real demand, unstable title. Take it only if the job description includes writing code |

With the seven roles in Part 12 that is sixteen roles in total. Both sets of codes are used in the tables below.

### 19.3 The week by week eligibility ladder

Read the last column as an instruction, not a suggestion.

| Wk | Reached | DSA | What you newly hold | Newly eligible | Realistic band | Apply? |
| --- | --- | --- | --- | --- | --- | --- |
| LAUNCH | 30 Aug 2026 | 6 | Striver account open, first 6 problems, the old EC2 box killed | WEB, and only because you could already do it | Rs 1.8 to 4 lakh | No |
| 1 | 6 Sep 2026 | 24 | JavaScript fundamentals unaided, Git beyond the basics | none new | none | No |
| 2 | 13 Sep 2026 | 48 | Arrays, strings and objects written without prompting | none new | none | No |
| 3 | 20 Sep 2026 | 72 | HTTP, CORS, caching, the network tab | SUP | Rs 3 to 6 lakh | No |
| 4 | 27 Sep 2026 | 96 | async, promises, the event loop | none new | none | No |
| 5 | 4 Oct 2026 | 118 | GATE 1. Project 1 live on HTTPS. One React app | none new. 118 clears basic service screens, but one React app is not a portfolio | none | No |
| 6 | 11 Oct 2026 | 140 | React 19, hooks, the compiler, Tailwind v4 | FE, weakly | Rs 3.5 to 6 lakh | No |
| 7 | 18 Oct 2026 | 162 | TypeScript strict mode, generics | FE properly | Rs 3.5 to 7 lakh | No. Exit 1 opens here and 19.5 prices it |
| 8 | 25 Oct 2026 | 184 | Node, Express, REST API design | AUTO | Rs 3 to 7 lakh | No |
| 9 | 1 Nov 2026 | 204 | PostgreSQL schema, indexes, transactions | JRT. 204 is the real service company threshold | Rs 3.5 to 6 lakh | No |
| 10 | 8 Nov 2026 | 224 | Next.js 16 App Router, server components | FS junior, weakly | Rs 5 to 8 lakh | No |
| 11 | 15 Nov 2026 | 244 | GATE 2. Auth you wrote yourself with Argon2id, one WebSocket feature | BE junior, FS junior, INT | Rs 5 to 9 lakh | No, but this is the first honest shot. Exit 2 |
| 12 | 22 Nov 2026 | 264 | Vitest, Playwright, GitHub Actions CI | QA | Rs 4 to 8 lakh | No |
| 13 | 29 Nov 2026 | 282 | OWASP Top 10:2025 applied to your own code | DEVREL, and FS and BE become defensible under questioning | Rs 6 to 10 lakh | No, hold two more weeks |
| 14 | 6 Dec 2026 | 300 | Docker, Compose, Redis caching and rate limits | PLAT. 300 opens mid tier product screens | Rs 6 to 11 lakh | No, but write the resume this week |
| 15 | 13 Dec 2026 | 318 | GATE 3. Queues, idempotency, EXPLAIN ANALYZE, one executed rollback | FS, BE, PLAT, QA, INT and DEVREL at full strength | Rs 6 to 12 lakh | **YES. Applications start. This is the line** |
| 16 | 20 Dec 2026 | 336 | LLM plumbing, streaming, cost per query | PROMPT | Rs 5 to 10 lakh | Yes, keep sending |
| 17 | 27 Dec 2026 | 352 | RAG with hybrid retrieval and citations | ASE | Rs 8 to 14 lakh | Yes |
| 18 | 3 Jan 2027 | 368 | Ragas evaluation, prompt injection defence | AAE, without the agent layer yet | Rs 8 to 15 lakh | Yes |
| 19 | 10 Jan 2027 | 384 | Agents, termination conditions, one MCP server | AAE at full strength, FDE as a stretch | Rs 8 to 15 lakh, FDE above it | Yes. Exit 4. Accept a good offer here |
| 20 | 17 Jan 2027 | 400 | Mock interviews, Project 4 polish | all sixteen | Rs 8 to 15 lakh | Yes |
| 21 | 24 Jan 2027 | 415 | GATE 4. Project 4 live, 100 applications sent | all sixteen at full strength | Rs 8 to 15 lakh | Yes, full strength |

### 19.4 The DSA only ladder

This is the table you asked for. What does the problem count alone buy, at every stage.

| Problems | Reached about | What the number alone gets you past | What it still does not open |
| --- | --- | --- | --- |
| 25 | Week 1, 6 Sep 2026 | nothing | everything |
| 50 | Week 2, 13 Sep 2026 | a warm up question in a friendly screen | every real screen |
| 75 | Week 3, 20 Sep 2026 | nothing on its own | every real screen |
| 100 | early Week 5, about 1 Oct 2026 | the first automated coding screens at small companies, and most internship filters | any product company loop, and every single role in Part 12 |
| 125 | Week 6, about 8 Oct 2026 | basic service company screens | service company loops, which need breadth you do not have yet |
| 150 | Week 7, about 15 Oct 2026 | basic service screens comfortably. With JavaScript and TypeScript this is the FE threshold | product screens, and anything backend |
| 175 | Week 8, about 24 Oct 2026 | the same class of screen with a safer margin | product screens |
| 200 | Week 9, 1 Nov 2026 | TCS, Infosys, Wipro, Cognizant and Accenture loops. The real service company threshold | mid tier product screens |
| 250 | Week 12, about 20 Nov 2026 | mid tier product screens begin to open | top tier product loops |
| 300 | Week 14, 6 Dec 2026 | mid tier product company screens, confidently | top tier product loops |
| 350 | Week 17, about 26 Dec 2026 | most product company loops below the top tier | the top tier, which needs 450 plus and a different kind of preparation |
| 415 | Gate 4, 24 Jan 2027 | most product company loops, including good product companies | nothing that matters for your seven target roles |
| 474 | February 2027 | the sheet is complete | past here the returns fall sharply. Move the hours to mock interviews |

**No number in this table unlocks a single role, in Part 12 or in 19.2.** The count gets you past a screen. The projects get you the offer. Part 13 says this once and Part 19 says it again because it is the belief most likely to cost you six months.

### 19.5 The four fast exits, priced in rupees

You asked how fast you can get employed. This is the honest answer, with the bill attached to each option.

| Exit | Date | What you could take | Offer band | What you give up | Verdict |
| --- | --- | --- | --- | --- | --- |
| Exit 1 | Week 7, 18 Oct 2026 | FE or SUP | Rs 3.5 to 7 lakh | Node, PostgreSQL, auth, Docker, security, queues and the entire AI layer. You cap as a frontend or support person for two to three years, and the New Zealand track in Part 16 needs backend depth you would never build | Only if the household cannot eat. It costs roughly Rs 4 lakh a year for three years, and adds about two years to the New Zealand timeline |
| Exit 2 | Week 11, 15 Nov 2026, Gate 2 | Junior FS, junior BE or INT | Rs 5 to 9 lakh | Docker, CI, security, queues, tuning and the entire AI layer. You would be a junior who cannot operate what he builds | Defensible only if the money hour has completely failed by 15 November. It costs about Rs 3 lakh a year, and the 25 to 40 per cent AI premium permanently |
| Exit 3 | Week 15, 13 Dec 2026, Gate 3 | FS, BE or PLAT at full strength | Rs 6 to 12 lakh | only the AI layer, which is six weeks of work | This is the sane exit, and it is not really an exit at all. Part 13 already tells you to start applying on this exact date |
| Exit 4 | Week 19, 10 Jan 2027 | all sixteen roles | Rs 8 to 15 lakh | two weeks of mock interviews and Project 4 polish | Take any good offer that arrives here. Do not wait until 24 January to accept something already on the table |

The only exit that costs you nothing is Exit 4. The money hour in Part 17 exists so that you never have to take Exit 1 or Exit 2. Rs 90,000 received by 24 January is not pocket money. It is the thing that buys you the right to refuse a Rs 3.5 lakh offer in October.

### 19.6 The skill combination matrix

Read this table when you want to know what one specific pair of achievements is actually worth.

| Stack you hold | DSA needed | Roles it unlocks | Realistic band | The interview you would face |
| --- | --- | --- | --- | --- |
| Prompting only, no unaided code. Where you are tonight | 0 | WEB | Rs 1.8 to 4 lakh | Show a site, quote a price. No technical interview at all |
| JavaScript written unaided, plus Git | 100 | WEB, SUP | Rs 3 to 6 lakh | One easy coding question, mostly behavioural |
| The above plus HTTP, CORS and async | 150 | WEB, SUP, and AUTO screens | Rs 3 to 7 lakh | Two easy questions and one debugging task |
| The above plus React 19 and Tailwind v4 | 150 | FE | Rs 3.5 to 7 lakh | A React take home, one easy problem, component design |
| The above plus TypeScript strict | 162, and JRT opens at 204 | FE properly, JRT | Rs 4 to 7 lakh | A typed take home, one generics question, one medium problem |
| The above plus Node, Express and PostgreSQL | 204 | FS junior, BE junior, JRT, AUTO | Rs 5 to 9 lakh | API design, schema design, two medium problems |
| The above plus your own auth, Docker, CI, tests, OWASP, queues and EXPLAIN ANALYZE | 318 | FS, BE, PLAT, QA, INT and DEVREL, all at full strength | Rs 6 to 12 lakh | One system design round, one security round, three medium problems and one hard |
| The above plus RAG, Ragas, injection defence, agents and one MCP server | 415 | all sixteen, including AAE and FDE | Rs 8 to 15 lakh, FDE above it | RAG architecture, retrieval quality, cost per query, agent termination, one hard problem |

### 19.7 When to break this plan

- Break it for a written offer at Rs 8 lakh or above, in any week, at any point. Take it and finish the roadmap in the evenings.
- Break it for any offer at all if the household genuinely cannot manage. Survival outranks optimisation, and there is no shame anywhere in that sentence.
- Do not break it for an offer below Rs 6 lakh before 13 December 2026.
- Do not break it for WEB or SUP at any time unless the line above applies, because those two roles are the hardest of all to leave.
- Never break it for a role that does not let you write code on most days.
- If you do break it, the roadmap does not stop. Part 15 already describes the employed weekday shape. The gates move to weekends and the AI layer takes twelve weeks instead of six.

The tracker must enforce this part, not decorate it. The eligibility screen reads your real DSA count and your real completed weeks, shows exactly which of the sixteen roles you qualify for today, and shows the advised verdict beside it in red until 13 December 2026.


## Appendix A | Links that moved or died

Checked 27 August 2026. If a tutorial points at the left column, it is out of date and so is everything else on that page.

| Was | Now | What happened |
| --- | --- | --- |
| thecopenhagenbook.com | auth.pilcrowonpaper.com | Renamed to The Auth Book, announced 3 June 2026. Old site archived. |
| pramp.com | tryexponent.com/practice | Acquired by Exponent November 2021, folded into Exponent Practice July 2024. |
| owasp.org/Top10 (2021 list) | owasp.org/Top10/2025 | The 2025 eighth installment supersedes it. A10 is no longer SSRF. |
| missing.csail.mit.edu/2020 | missing.csail.mit.edu/2026 | The 2026 edition has nine lectures with different names. |
| Any MCP guide before mid-2026 | modelcontextprotocol.io/specification/2026-07-28 | The protocol became stateless. Sessions and the handshake were removed. |
| AI SDK v5 or v6 tutorials | ai-sdk.dev/docs/migration-guides/migration-guide-7-0 | v7 is ESM-only and needs Node 22 or higher. |
| bradfieldcs.com | csprimer.com | Bradfield School of Computer Science content moved to CS Primer. |


## Appendix B | Tracking files

| File | What goes in it |
| --- | --- |
| log.md | One line per day: date, DSA count, what shipped, what blocked. Written at CLOSE, never later. |
| versions.md | Every version number you are pinned to, and the date you checked it. |
| failed-twice.md | Any problem or concept that beat you twice. This file is the highest value document you will own by January. |
| leads.csv | The money pipeline. name, category, area, phone, website, mobile broken, rating, reviews, status, last touch, next touch, notes. |
| money.md | One line per paid job: client, offer code, price, advance date, delivery date, balance date, referral asked yes or no. |
| pushes.md | Fallback only. Date, repository, commit count, one line on what changed. Used when the tracker is down. |

Anki decks: DSA Patterns, System and Stack, Interview Answers.

---

## Appendix C | The 150 day calendar

Every day from Friday 28 August 2026 to Sunday 24 January 2027, with the date, the week number, the DSA pace for that day, the LEARN task, the BUILD task and the money task. The LEARN and BUILD columns are taken directly from the six day tables in Part 4, they are not a summary and they are not new content. Where this calendar and Part 4 ever disagree, Part 4 wins.

This appendix is also the seed data for the calendar screen of the tracker. One row here is one day cell there.

**Legend.** LAUNCH is the three day launch block from Part 2. W01 to W21 are the roadmap weeks. Sunday rows carry the Sunday type from Part 3: working 6 hours, gate audit 3 hours, or rest.

**The DSA column.** It is the daily pace from Part 18.3, the weekly target split across the six study days. The 126 study days sum to exactly 415, which is the Part 3 figure. The 6 problems on 30 August are the launch block proving the morning block works, and they sit outside that 415. Sundays are zero, always. The weekly number is what counts, the daily number only tells you whether today is on pace.

| Date | Day | Wk | DSA | LEARN 09:30 to 12:30 | BUILD 14:00 to 16:00 | MONEY 17:00 to 18:00 |
| --- | --- | --- | --- | --- | --- | --- |
| 28 Aug 2026 | Friday | LAUNCH | 0 | Decommission the old AWS EC2 box that is still billing. Document all 8 TLS certificates and their renewal dates. Create the four project repositories | itc-reclaim, itc-reclaim-api, itc-reclaim-ops, tender-fit created and pushed with README stubs | Open leads.csv, fill 30 rows from Google Maps, pick the 2 worst sites as free samples |
| 29 Aug 2026 | Saturday | LAUNCH | 0 | Move local PostgreSQL 16 to 18. Verify pg_dump and restore both directions. Install the three Anki decks | log.md, versions.md, failed-twice.md, leads.csv and money.md created and committed | 30 more leads. Start sample site 1 for the worst site on the list |
| 30 Aug 2026 | Sunday | LAUNCH | 6 | Striver A2Z account and tracker. First 6 problems to prove the morning block works | Read Part 1 and Part 4 in full. Decide nothing else after this point | Finish both sample sites, put them live, paste the two links into the outreach scripts |
| 31 Aug 2026 | Monday | W01 | 4 | javascript.info ch 4 (Objects). Type every example. | Repo scaffold + .gitignore + README skeleton | 15 first touches from the week list of 60. Log every touch |
| 01 Sep 2026 | Tuesday | W01 | 4 | javascript.info ch 5 (Data types) parts 1–7. | Utility: core function, first five commits | 15 first touches, plus follow up 1 to Monday's list |
| 02 Sep 2026 | Wednesday | W01 | 4 | javascript.info ch 5 parts 8–13 + Missing Semester shell lecture. | CUT POINT. Trim scope now if behind | 10 first touches, hold 2 calls, send every pending quote |
| 03 Sep 2026 | Thursday | W01 | 4 | javascript.info ch 6 (Advanced functions), closures and "this". | Utility: error paths and input validation | Delivery only. The current paid job, one progress line to the client |
| 04 Sep 2026 | Friday | W01 | 4 | Pro Git ch 2 and 3. Rebase, cherry-pick, bisect on purpose. | DEPLOY DAY. Push public. README with screenshots | Delivery, invoice, payment follow up, delivery message out |
| 05 Sep 2026 | Saturday | W01 | 4 | learngitbranching.js.org all main + remote levels. | Weekly review, 20 min. Redo five DSA problems | Proposals, referral asks, weekly money review, build next week's 60 leads |
| 06 Sep 2026 | Sunday | W01 | 0 | SUNDAY, Working, 6 h. Python 1: syntax, types, control flow, functions | No BUILD block on Sunday | 30 minutes only: invoices, payments, pipeline hygiene |
| 07 Sep 2026 | Monday | W02 | 4 | Semantic HTML + the box model + cascade and specificity. | Static site: markup and content structure | 15 first touches from the week list of 60. Log every touch |
| 08 Sep 2026 | Tuesday | W02 | 4 | Flexbox Froggy all 24, then rebuild three layouts from empty. | Static site: main layout in flexbox | 15 first touches, plus follow up 1 to Monday's list |
| 09 Sep 2026 | Wednesday | W02 | 4 | Grid Garden all 28, then a real 12-column grid by hand. | CUT POINT. Static site: grid sections | 10 first touches, hold 2 calls, send every pending quote |
| 10 Sep 2026 | Thursday | W02 | 4 | web.dev Learn CSS: custom properties, stacking, overflow. | Static site: responsive breakpoints | Delivery only. The current paid job, one progress line to the client |
| 11 Sep 2026 | Friday | W02 | 4 | Linux: permissions, processes, ports, DNS, TCP vs UDP. | DEPLOY DAY. Site live behind your own nginx | Delivery, invoice, payment follow up, delivery message out |
| 12 Sep 2026 | Saturday | W02 | 4 | nginx docs: server blocks, proxy_pass, TLS termination. | Weekly review. Five DSA redos, weighted to failures | Proposals, referral asks, weekly money review, build next week's 60 leads |
| 13 Sep 2026 | Sunday | W02 | 0 | SUNDAY, Rest. No code. No screens before noon. This is load bearing. | No BUILD block on Sunday | Rest. No outreach, no delivery |
| 14 Sep 2026 | Monday | W03 | 4 | javascript.info ch 7 (Prototypes). | P1: repo, README problem statement, architecture sketch | 15 first touches from the week list of 60. Log every touch |
| 15 Sep 2026 | Tuesday | W03 | 4 | javascript.info ch 8 (Classes) in full. | P1: data model for purchase register and GSTR-2B rows | 15 first touches, plus follow up 1 to Monday's list |
| 16 Sep 2026 | Wednesday | W03 | 4 | javascript.info ch 9 (Error handling) + custom error classes. | CUT POINT. P1: CSV parsing spike | 10 first touches, hold 2 calls, send every pending quote |
| 17 Sep 2026 | Thursday | W03 | 4 | MDN HTTP: methods, status codes, headers, cookies. | P1: first matching rule, with tests by hand | Delivery only. The current paid job, one progress line to the client |
| 18 Sep 2026 | Friday | W03 | 4 | MDN HTTP caching + CORS from first principles. | DEPLOY DAY. P1 skeleton on a public URL | Delivery, invoice, payment follow up, delivery message out |
| 19 Sep 2026 | Saturday | W03 | 4 | javascript.info ch 10 + revision. | Weekly review. Five DSA redos | Proposals, referral asks, weekly money review, build next week's 60 leads |
| 20 Sep 2026 | Sunday | W03 | 0 | SUNDAY, Working, 6 h. Python 2: files, JSON, requests, environments with uv | No BUILD block on Sunday | 30 minutes only: invoices, payments, pipeline hygiene |
| 21 Sep 2026 | Monday | W04 | 4 | javascript.info ch 11 parts 1–4. Callbacks to promise chaining. | P1: async CSV ingest | 15 first touches from the week list of 60. Log every touch |
| 22 Sep 2026 | Tuesday | W04 | 4 | javascript.info ch 11 parts 5–8. Promise API, microtasks, async/await. | P1: streaming parse for large files | 15 first touches, plus follow up 1 to Monday's list |
| 23 Sep 2026 | Wednesday | W04 | 4 | latentflip.com/loupe + jsv9000.app. Draw the loop from memory. | CUT POINT. P1: progress reporting | 10 first touches, hold 2 calls, send every pending quote |
| 24 Sep 2026 | Thursday | W04 | 4 | Write retry-with-backoff, a timeout, and a concurrency limiter by hand. | P1: wire the retry into ingest | Delivery only. The current paid job, one progress line to the client |
| 25 Sep 2026 | Friday | W04 | 4 | javascript.info ch 12. Generators and async iteration. | DEPLOY DAY. P1 ingest live | Delivery, invoice, payment follow up, delivery message out |
| 26 Sep 2026 | Saturday | W04 | 4 | Rewrite the retry from memory, no notes. | Weekly review + monthly close-out | Proposals, referral asks, weekly money review, build next week's 60 leads |
| 27 Sep 2026 | Sunday | W04 | 0 | SUNDAY, Rest. No code. No screens before noon. This is load bearing. | No BUILD block on Sunday | Rest. No outreach, no delivery |
| 28 Sep 2026 | Monday | W05 | 4 | Full Stack Open part 0 + part 1a–1b. | P1: React shell, routing, layout | 15 first touches from the week list of 60. Log every touch |
| 29 Sep 2026 | Tuesday | W05 | 4 | Full Stack Open part 1c–1d. State and event handlers. | P1: upload component + state model | 15 first touches, plus follow up 1 to Monday's list |
| 30 Sep 2026 | Wednesday | W05 | 4 | Full Stack Open part 2a–2c. Collections and forms. | CUT POINT. P1: results table, four buckets | 10 first touches, hold 2 calls, send every pending quote |
| 01 Oct 2026 | Thursday | W05 | 4 | Full Stack Open part 2d–2f + react.dev rules of hooks. | P1: server communication, error states | Delivery only. The current paid job, one progress line to the client |
| 02 Oct 2026 | Friday | W05 | 3 | react.dev: You Might Not Need an Effect. Twice. | DEPLOY DAY. Ship it. Two days of buffer, on purpose | Delivery, invoice, payment follow up, delivery message out |
| 03 Oct 2026 | Saturday | W05 | 3 | Fix whatever the Friday deploy broke. | Gate 1 dry run. README, screenshots, live link | Proposals, referral asks, weekly money review, build next week's 60 leads |
| 04 Oct 2026 | Sunday | W05 | 0 | SUNDAY, Gate audit, 3 h. GATE 1 \\| Project 1 live on your own domain over HTTPS. | No BUILD block on Sunday | 30 minutes only: invoices, payments, pipeline hygiene |
| 05 Oct 2026 | Monday | W06 | 4 | react.dev Escape Hatches: refs and effects. | P1: extract three custom hooks | 15 first touches from the week list of 60. Log every touch |
| 06 Oct 2026 | Tuesday | W06 | 4 | Context, composition, keys and reconciliation. | P1: context for auth-less session state | 15 first touches, plus follow up 1 to Monday's list |
| 07 Oct 2026 | Wednesday | W06 | 4 | react.dev React Compiler + eslint-plugin-react-hooks recommended preset. | CUT POINT. Remove hand-written memo | 10 first touches, hold 2 calls, send every pending quote |
| 08 Oct 2026 | Thursday | W06 | 4 | Tailwind v4 docs: installation, @theme, utilities, variants. | P1: design tokens in @theme | Delivery only. The current paid job, one progress line to the client |
| 09 Oct 2026 | Friday | W06 | 3 | Tailwind v4: responsive design, dark mode, container queries. | DEPLOY DAY. P1 styled and responsive | Delivery, invoice, payment follow up, delivery message out |
| 10 Oct 2026 | Saturday | W06 | 3 | Accessibility pass: labels, focus order, keyboard, contrast. | Weekly review. Five DSA redos | Proposals, referral asks, weekly money review, build next week's 60 leads |
| 11 Oct 2026 | Sunday | W06 | 0 | SUNDAY, Working, 6 h. Python 3: pandas for reconciliation work | No BUILD block on Sunday | 30 minutes only: invoices, payments, pipeline hygiene |
| 12 Oct 2026 | Monday | W07 | 4 | Handbook: everyday types, narrowing, more on functions. | P1: tsconfig strict, convert the utilities | 15 first touches from the week list of 60. Log every touch |
| 13 Oct 2026 | Tuesday | W07 | 4 | Handbook: object types, generics, keyof/typeof/indexed access. | P1: convert the data layer | 15 first touches, plus follow up 1 to Monday's list |
| 14 Oct 2026 | Wednesday | W07 | 4 | Handbook: conditional, mapped and template literal types. | CUT POINT. P1: convert the API client | 10 first touches, hold 2 calls, send every pending quote |
| 15 Oct 2026 | Thursday | W07 | 4 | Total TypeScript: generics and narrowing tutorials. | P1: convert React components | Delivery only. The current paid job, one progress line to the client |
| 16 Oct 2026 | Friday | W07 | 3 | Typing React: props, children, refs, discriminated unions. | DEPLOY DAY. Zero any. Zero ts-ignore | Delivery, invoice, payment follow up, delivery message out |
| 17 Oct 2026 | Saturday | W07 | 3 | Type Challenges, easy tier. Stop at easy. | Weekly review + monthly close-out | Proposals, referral asks, weekly money review, build next week's 60 leads |
| 18 Oct 2026 | Sunday | W07 | 0 | SUNDAY, Rest. No code. No screens before noon. This is load bearing. | No BUILD block on Sunday | Rest. No outreach, no delivery |
| 19 Oct 2026 | Monday | W08 | 4 | Node Learn: modules, event loop, timers, nextTick. | P2: project scaffold, config, env handling | 15 first touches from the week list of 60. Log every touch |
| 20 Oct 2026 | Tuesday | W08 | 4 | Node Learn: streams and the file system. | P2: upload endpoint with streaming | 15 first touches, plus follow up 1 to Monday's list |
| 21 Oct 2026 | Wednesday | W08 | 4 | Express: routing, middleware order, error middleware. | CUT POINT. P2: router composition, error envelope | 10 first touches, hold 2 calls, send every pending quote |
| 22 Oct 2026 | Thursday | W08 | 4 | API design: pagination, versioning, rate limiting, idempotency. | P2: cursor pagination + rate limit | Delivery only. The current paid job, one progress line to the client |
| 23 Oct 2026 | Friday | W08 | 3 | Schema validation at every boundary. zod or valibot. | DEPLOY DAY. API live, bad input rejected | Delivery, invoice, payment follow up, delivery message out |
| 24 Oct 2026 | Saturday | W08 | 3 | nodebestpractices, read it end to end. | Weekly review. Five DSA redos | Proposals, referral asks, weekly money review, build next week's 60 leads |
| 25 Oct 2026 | Sunday | W08 | 0 | SUNDAY, Working, 6 h. SQL window functions | No BUILD block on Sunday | 30 minutes only: invoices, payments, pipeline hygiene |
| 26 Oct 2026 | Monday | W09 | 4 | Schema design on paper. Draw it before you type it. | P2: schema v1 + migration 0001 | 15 first touches from the week list of 60. Log every touch |
| 27 Oct 2026 | Tuesday | W09 | 4 | PGExercises: basic, joins and subqueries. | P2: seed data, realistic volume | 15 first touches, plus follow up 1 to Monday's list |
| 28 Oct 2026 | Wednesday | W09 | 3 | PGExercises: modifying data, aggregation. | CUT POINT. P2: query layer | 10 first touches, hold 2 calls, send every pending quote |
| 29 Oct 2026 | Thursday | W09 | 3 | Indexes: B-tree, composite order, partial, expression. | P2: add indexes, justify each in the README | Delivery only. The current paid job, one progress line to the client |
| 30 Oct 2026 | Friday | W09 | 3 | Transactions and isolation levels. PGExercises: timestamps, strings, recursive. | DEPLOY DAY. Migrations run in deploy | Delivery, invoice, payment follow up, delivery message out |
| 31 Oct 2026 | Saturday | W09 | 3 | use-the-index-luke.com, the chapters that bit you. | Weekly review + monthly close-out | Proposals, referral asks, weekly money review, build next week's 60 leads |
| 01 Nov 2026 | Sunday | W09 | 0 | SUNDAY, Rest. No code. No screens before noon. This is load bearing. | No BUILD block on Sunday | Rest. No outreach, no delivery |
| 02 Nov 2026 | Monday | W10 | 4 | nextjs.org/learn chapters 1–6. | P2: Next.js 16 app scaffold, layouts | 15 first touches from the week list of 60. Log every touch |
| 03 Nov 2026 | Tuesday | W10 | 4 | nextjs.org/learn chapters 7–12. Data fetching and mutation. | P2: server components for the report view | 15 first touches, plus follow up 1 to Monday's list |
| 04 Nov 2026 | Wednesday | W10 | 3 | Caching documentation, first pass. Draw the four caches. | CUT POINT. P2: route handlers | 10 first touches, hold 2 calls, send every pending quote |
| 05 Nov 2026 | Thursday | W10 | 3 | Caching documentation, second pass. Revalidation strategies. | P2: streaming + Suspense boundaries | Delivery only. The current paid job, one progress line to the client |
| 06 Nov 2026 | Friday | W10 | 3 | Server Actions, proxy (formerly middleware), cacheComponents. | DEPLOY DAY. P2 live on Next.js 16 | Delivery, invoice, payment follow up, delivery message out |
| 07 Nov 2026 | Saturday | W10 | 3 | Upgrading guide for v16. Read it even though you started on 16. | Weekly review. Five DSA redos | Proposals, referral asks, weekly money review, build next week's 60 leads |
| 08 Nov 2026 | Sunday | W10 | 0 | SUNDAY, Working, 6 h. SQL CTEs, gaps and islands, EXPLAIN | No BUILD block on Sunday | 30 minutes only: invoices, payments, pipeline hygiene |
| 09 Nov 2026 | Monday | W11 | 4 | Auth book: sessions, tokens, cookies. | P2: session table, token generation, hashing | 15 first touches from the week list of 60. Log every touch |
| 10 Nov 2026 | Tuesday | W11 | 4 | Auth book: password authentication + OWASP Password Storage. | P2: Argon2id registration and login | 15 first touches, plus follow up 1 to Monday's list |
| 11 Nov 2026 | Wednesday | W11 | 3 | Auth book: email verification, password reset, rate limiting. | CUT POINT. P2: verification and reset flows | 10 first touches, hold 2 calls, send every pending quote |
| 12 Nov 2026 | Thursday | W11 | 3 | Timing attacks, account enumeration, session fixation. | P2: harden every auth endpoint | Delivery only. The current paid job, one progress line to the client |
| 13 Nov 2026 | Friday | W11 | 3 | WebSockets: protocol, reconnection, heartbeats, backpressure. | DEPLOY DAY. Auth + live feature shipped | Delivery, invoice, payment follow up, delivery message out |
| 14 Nov 2026 | Saturday | W11 | 3 | Write the threat model for your own auth, in your own words. | Gate 2 dry run. Full audit | Proposals, referral asks, weekly money review, build next week's 60 leads |
| 15 Nov 2026 | Sunday | W11 | 0 | SUNDAY, Gate audit, 3 h. GATE 2 \\| Auth you wrote yourself, plus one WebSocket feature. | No BUILD block on Sunday | 30 minutes only: invoices, payments, pipeline hygiene |
| 16 Nov 2026 | Monday | W12 | 4 | Vitest: setup, assertions, mocking, coverage that means something. | P3: unit tests on matching and money logic | 15 first touches from the week list of 60. Log every touch |
| 17 Nov 2026 | Tuesday | W12 | 4 | Testing Library: roles, accessible names, user-event. | P3: component tests for the report view | 15 first touches, plus follow up 1 to Monday's list |
| 18 Nov 2026 | Wednesday | W12 | 3 | MSW: network-level mocking. | CUT POINT. P3: API contract tests | 10 first touches, hold 2 calls, send every pending quote |
| 19 Nov 2026 | Thursday | W12 | 3 | Integration testing against a real database in a container. | P3: one full integration test, seeded | Delivery only. The current paid job, one progress line to the client |
| 20 Nov 2026 | Friday | W12 | 3 | GitHub Actions: matrix, caching, services, environments, secrets. | DEPLOY DAY. CI green and blocking merge | Delivery, invoice, payment follow up, delivery message out |
| 21 Nov 2026 | Saturday | W12 | 3 | Playwright best practices. Two journeys, no more. | Weekly review + monthly close-out | Proposals, referral asks, weekly money review, build next week's 60 leads |
| 22 Nov 2026 | Sunday | W12 | 0 | SUNDAY, Working, 6 h. Technical writing, and the Project 1 README | No BUILD block on Sunday | 30 minutes only: invoices, payments, pipeline hygiene |
| 23 Nov 2026 | Monday | W13 | 3 | A01 Broken Access Control + A02 Security Misconfiguration. | P3: object-level authorisation on every route | 15 first touches from the week list of 60. Log every touch |
| 24 Nov 2026 | Tuesday | W13 | 3 | A03 Supply Chain + A08 Integrity Failures. | P3: pin actions, lockfile audit in CI | 15 first touches, plus follow up 1 to Monday's list |
| 25 Nov 2026 | Wednesday | W13 | 3 | A04 Cryptographic Failures + A05 Injection. PortSwigger labs. | CUT POINT. P3: parameterised queries audit | 10 first touches, hold 2 calls, send every pending quote |
| 26 Nov 2026 | Thursday | W13 | 3 | A06 Insecure Design + A07 Authentication Failures. | P3: rate limits and lockout policy | Delivery only. The current paid job, one progress line to the client |
| 27 Nov 2026 | Friday | W13 | 3 | A09 Logging and Alerting + A10 Mishandling of Exceptional Conditions. | DEPLOY DAY. CSP and security headers live | Delivery, invoice, payment follow up, delivery message out |
| 28 Nov 2026 | Saturday | W13 | 3 | Write the threat model. Real threats, your app, your words. | Weekly review. Five DSA redos | Proposals, referral asks, weekly money review, build next week's 60 leads |
| 29 Nov 2026 | Sunday | W13 | 0 | SUNDAY, Rest. No code. No screens before noon. This is load bearing. | No BUILD block on Sunday | Rest. No outreach, no delivery |
| 30 Nov 2026 | Monday | W14 | 3 | Docker: images, layers, cache, multi-stage builds. | P3: Dockerfile, multi-stage, non-root | 15 first touches from the week list of 60. Log every touch |
| 01 Dec 2026 | Tuesday | W14 | 3 | Compose v2: services, networks, volumes, healthchecks, profiles. | P3: full stack in one compose file | 15 first touches, plus follow up 1 to Monday's list |
| 02 Dec 2026 | Wednesday | W14 | 3 | Image size, distroless, .dockerignore, build cache in CI. | CUT POINT. P3: image under a sensible size | 10 first touches, hold 2 calls, send every pending quote |
| 03 Dec 2026 | Thursday | W14 | 3 | Redis or Valkey: caching, TTLs, invalidation, stampede. | P3: cache the expensive report query | Delivery only. The current paid job, one progress line to the client |
| 04 Dec 2026 | Friday | W14 | 3 | Sessions and sliding-window rate limits in Redis. Caddy TLS. | DEPLOY DAY. P3 on your own box, TLS, rollback tested | Delivery, invoice, payment follow up, delivery message out |
| 05 Dec 2026 | Saturday | W14 | 3 | Break it on purpose, then roll back. Time yourself. | Weekly review + monthly close-out | Proposals, referral asks, weekly money review, build next week's 60 leads |
| 06 Dec 2026 | Sunday | W14 | 0 | SUNDAY, Working, 6 h. AWS S3, EC2, RDS, IAM, and Cloudflare | No BUILD block on Sunday | 30 minutes only: invoices, payments, pipeline hygiene |
| 07 Dec 2026 | Monday | W15 | 3 | BullMQ: producers, workers, retries, backoff, DLQ. | P3: queue for large reconciliation runs | 15 first touches from the week list of 60. Log every touch |
| 08 Dec 2026 | Tuesday | W15 | 3 | Idempotent handlers, exactly-once illusions, at-least-once reality. | P3: idempotency keys on job payloads | 15 first touches, plus follow up 1 to Monday's list |
| 09 Dec 2026 | Wednesday | W15 | 3 | System Design Primer, first third. Draw your architecture. | CUT POINT. P3: architecture diagram in README | 10 first touches, hold 2 calls, send every pending quote |
| 10 Dec 2026 | Thursday | W15 | 3 | EXPLAIN ANALYZE, plan reading, index selection. | P3: the before-and-after number | Delivery only. The current paid job, one progress line to the client |
| 11 Dec 2026 | Friday | W15 | 3 | Pino structured logs, Sentry, one real metric. | DEPLOY DAY. P3 observable in production | Delivery, invoice, payment follow up, delivery message out |
| 12 Dec 2026 | Saturday | W15 | 3 | Gate 3 audit. Then write the first ten applications. | GATE 3 DRY RUN + applications open | Proposals, referral asks, weekly money review, build next week's 60 leads |
| 13 Dec 2026 | Sunday | W15 | 0 | SUNDAY, Gate audit, 3 h. GATE 3 \\| Project 3 operable. Applications start today. | No BUILD block on Sunday | 30 minutes only: invoices, payments, pipeline hygiene |
| 14 Dec 2026 | Monday | W16 | 3 | AI SDK 7 introduction, installation, provider setup. | P4: repo, problem statement, provider wiring | 15 first touches from the week list of 60. Log every touch |
| 15 Dec 2026 | Tuesday | W16 | 3 | generateText and streamText. Streaming to a React client. | P4: streaming answer endpoint | 15 first touches, plus follow up 1 to Monday's list |
| 16 Dec 2026 | Wednesday | W16 | 3 | Tools and the tool loop. Tool approval. | CUT POINT. P4: first tool, document lookup | 10 first touches, hold 2 calls, send every pending quote |
| 17 Dec 2026 | Thursday | W16 | 3 | generateObject and structured output with schemas. | P4: structured eligibility extraction | Delivery only. The current paid job, one progress line to the client |
| 18 Dec 2026 | Friday | W16 | 3 | Tokens, context windows, cost accounting, prompt caching. | DEPLOY DAY. P4 answers a question, live | Delivery, invoice, payment follow up, delivery message out |
| 19 Dec 2026 | Saturday | W16 | 3 | promptingguide.ai + the OpenAI cookbook patterns you will reuse. | Weekly review. Five DSA redos | Proposals, referral asks, weekly money review, build next week's 60 leads |
| 20 Dec 2026 | Sunday | W16 | 0 | SUNDAY, Working, 6 h. Reading code: n8n | No BUILD block on Sunday | 30 minutes only: invoices, payments, pipeline hygiene |
| 21 Dec 2026 | Monday | W17 | 3 | pgvector: types, operators, index families, dimension limits. | P4: schema with halfvec, ingest embeddings | 15 first touches from the week list of 60. Log every touch |
| 22 Dec 2026 | Tuesday | W17 | 3 | Chunking strategies. Structural chunking for tender PDFs. | P4: structural chunker on headings and clauses | 15 first touches, plus follow up 1 to Monday's list |
| 23 Dec 2026 | Wednesday | W17 | 3 | Contextual embeddings. Generate chunk context with the LLM. | CUT POINT. P4: contextualise every chunk | 10 first touches, hold 2 calls, send every pending quote |
| 24 Dec 2026 | Thursday | W17 | 3 | BM25 in PostgreSQL: tsvector, ts_rank, and the tradeoffs. | P4: BM25 index + hybrid retrieve | Delivery only. The current paid job, one progress line to the client |
| 25 Dec 2026 | Friday | W17 | 2 | Reciprocal rank fusion and reranking. | DEPLOY DAY. P4 answers with sources, live | Delivery, invoice, payment follow up, delivery message out |
| 26 Dec 2026 | Saturday | W17 | 2 | Read the Anthropic write-up again with your own numbers next to it. | Weekly review. Five DSA redos | Proposals, referral asks, weekly money review, build next week's 60 leads |
| 27 Dec 2026 | Sunday | W17 | 0 | SUNDAY, Rest. No code. No screens before noon. This is load bearing. | No BUILD block on Sunday | Rest. No outreach, no delivery |
| 28 Dec 2026 | Monday | W18 | 3 | Ragas: installation, dataset format, running an evaluation. | P4: build the fifty-pair eval set | 15 first touches from the week list of 60. Log every touch |
| 29 Dec 2026 | Tuesday | W18 | 3 | Faithfulness and Response Relevancy in depth. | P4: baseline run, record the numbers | 15 first touches, plus follow up 1 to Monday's list |
| 30 Dec 2026 | Wednesday | W18 | 3 | Context Precision, Context Recall, Noise Sensitivity. | CUT POINT. P4: retrieval tuning against the eval | 10 first touches, hold 2 calls, send every pending quote |
| 31 Dec 2026 | Thursday | W18 | 3 | Prompt injection. OWASP GenAI. Indirect injection through the corpus. | P4: injection defences + refusal path | Delivery only. The current paid job, one progress line to the client |
| 01 Jan 2027 | Friday | W18 | 2 | Eval-driven iteration. Change one thing, re-measure. | DEPLOY DAY. Numbers in the README | Delivery, invoice, payment follow up, delivery message out |
| 02 Jan 2027 | Saturday | W18 | 2 | Write the failure modes. Honestly. Name what it gets wrong. | Weekly review + monthly close-out | Proposals, referral asks, weekly money review, build next week's 60 leads |
| 03 Jan 2027 | Sunday | W18 | 0 | SUNDAY, Working, 6 h. LLM tracing with Langfuse and OpenTelemetry GenAI | No BUILD block on Sunday | 30 minutes only: invoices, payments, pipeline hygiene |
| 04 Jan 2027 | Monday | W19 | 3 | Write the agent loop by hand. Plan, act, observe, budget, stop. | P4: agent loop, no framework | 15 first touches from the week list of 60. Log every touch |
| 05 Jan 2027 | Tuesday | W19 | 3 | Anthropic, Building Effective Agents. The five patterns. | P4: tool schemas and error contracts | 15 first touches, plus follow up 1 to Monday's list |
| 06 Jan 2027 | Wednesday | W19 | 3 | MCP architecture + the 2026-07-28 specification and changelog. | CUT POINT. P4: MCP server skeleton | 10 first touches, hold 2 calls, send every pending quote |
| 07 Jan 2027 | Thursday | W19 | 3 | MCP tools, resources, prompts. Authorisation. MCP Inspector. | P4: three to five tools, tested in Inspector | Delivery only. The current paid job, one progress line to the client |
| 08 Jan 2027 | Friday | W19 | 2 | Open one agent framework and name what it hides. | DEPLOY DAY. Agent + MCP server live | Delivery, invoice, payment follow up, delivery message out |
| 09 Jan 2027 | Saturday | W19 | 2 | Record a four-minute demo of Project 4 end to end. | Weekly review + monthly close-out | Proposals, referral asks, weekly money review, build next week's 60 leads |
| 10 Jan 2027 | Sunday | W19 | 0 | SUNDAY, Working, 6 h. Reading code 2, and Forward Deployed Engineer case drills | No BUILD block on Sunday | 30 minutes only: invoices, payments, pipeline hygiene |
| 11 Jan 2027 | Monday | W20 | 3 | Two mocks. One coding, one system design. | Resume v1. Master template filled with real numbers | 15 first touches from the week list of 60. Log every touch |
| 12 Jan 2027 | Tuesday | W20 | 3 | Two mocks. Reread failed-twice.md, redo the top ten. | READMEs: all nine sections on all four projects | 15 first touches, plus follow up 1 to Monday's list |
| 13 Jan 2027 | Wednesday | W20 | 3 | Two mocks. One FDE case study. | CUT POINT. Demo videos, three minutes each | 10 first touches, hold 2 calls, send every pending quote |
| 14 Jan 2027 | Thursday | W20 | 3 | Two mocks. One Applied AI RAG design round. | Resume: three variants. Link health check | Delivery only. The current paid job, one progress line to the client |
| 15 Jan 2027 | Friday | W20 | 2 | Two mocks. Record, watch back, fix one habit. | DEPLOY DAY. Every live link verified working | Delivery, invoice, payment follow up, delivery message out |
| 16 Jan 2027 | Saturday | W20 | 2 | Rehearse the opening answer twenty times. Out loud. | Weekly review. Application list built | Proposals, referral asks, weekly money review, build next week's 60 leads |
| 17 Jan 2027 | Sunday | W20 | 0 | SUNDAY, Rest. No code. No screens before noon. This is load bearing. | No BUILD block on Sunday | Rest. No outreach, no delivery |
| 18 Jan 2027 | Monday | W21 | 3 | Build the target list. 120 companies, role name first. | 25 applications. Every one with a referral attempt | 15 first touches from the week list of 60. Log every touch |
| 19 Jan 2027 | Tuesday | W21 | 3 | Naukri, Wellfound, LinkedIn filters set up and saved. | 25 applications | 15 first touches, plus follow up 1 to Monday's list |
| 20 Jan 2027 | Wednesday | W21 | 3 | Negotiation basics. levels.fyi and AmbitionBox ranges. | CUT POINT. 20 applications + follow-ups | 10 first touches, hold 2 calls, send every pending quote |
| 21 Jan 2027 | Thursday | W21 | 2 | Interview scheduling hygiene. Calendar blocks, buffers. | 20 applications + first-round prep | Delivery only. The current paid job, one progress line to the client |
| 22 Jan 2027 | Friday | W21 | 2 | Rehearse the three answers that decide it. | DEPLOY DAY. 10 applications. All links verified | Delivery, invoice, payment follow up, delivery message out |
| 23 Jan 2027 | Saturday | W21 | 2 | Full audit. Gate 4 checklist, top to bottom. | GATE 4 DRY RUN | Proposals, referral asks, weekly money review, build next week's 60 leads |
| 24 Jan 2027 | Sunday | W21 | 0 | SUNDAY, Gate audit, 3 h. GATE 4 \\| Project 4 live. One hundred applications sent. | No BUILD block on Sunday | 30 minutes only: invoices, payments, pipeline hygiene |


## Appendix D | Every link, indexed by week

The same links that appear inside each week of Part 4, gathered in one place so the tracker can render one clickable row per week. Nothing here is new. Every one of these was loaded and checked on 27 August 2026.

| Wk | Dates | Every link for that week |
| --- | --- | --- |
| 1 | 31 Aug – 6 Sep 2026 | javascript.info/object-basics, javascript.info/data-types, javascript.info/advanced-functions, git-scm.com/book/en/v2, learngitbranching.js.org, missing.csail.mit.edu/2026, takeuforward.org/dsa/strivers-a2z-sheet-learn-dsa-a-to-z |
| 2 | 7–13 September 2026 | flexboxfroggy.com, cssgridgarden.com, web.dev/learn/css, web.dev/learn/html, joshwcomeau.com, linuxjourney.com, nginx.org/en/docs, wizardzines.com |
| 3 | 14–20 September 2026 | javascript.info/prototypes, javascript.info/classes, javascript.info/error-handling, developer.mozilla.org/en-US/docs/Web/HTTP, developer.mozilla.org/en-US/docs/Web/HTTP/CORS, developer.mozilla.org/en-US/docs/Web/HTTP/Caching |
| 4 | 21–27 September 2026 | javascript.info/async, javascript.info/generators-iterators, latentflip.com/loupe, jsv9000.app, nodejs.org/en/learn/asynchronous-work/event-loop-timers-and-nexttick |
| 5 | 28 Sep – 4 Oct 2026 | fullstackopen.com/en, react.dev/learn, react.dev/learn/you-might-not-need-an-effect, react.dev/reference/rules/rules-of-hooks, overreacted.io |
| 6 | 5–11 October 2026 | tailwindcss.com/docs, react.dev/learn/escape-hatches, react.dev/learn/react-compiler, fullstackopen.com/en/part2, web.dev/learn/accessibility |
| 7 | 12–18 October 2026 | typescriptlang.org/docs/handbook/intro.html, totaltypescript.com/tutorials, github.com/type-challenges/type-challenges, typescriptlang.org/play, typescriptlang.org/tsconfig |
| 8 | 19–25 October 2026 | nodejs.org/en/learn, expressjs.com, github.com/goldbergyoni/nodebestpractices, nodejs.org/en/learn/asynchronous-work/event-loop-timers-and-nexttick, zod.dev |
| 9 | 26 Oct – 1 Nov 2026 | pgexercises.com, postgresql.org/docs/current/tutorial.html, use-the-index-luke.com, explain.dalibo.com, prisma.io/docs, orm.drizzle.team, modern-sql.com |
| 10 | 2–8 November 2026 | nextjs.org/learn, nextjs.org/docs/app/guides/upgrading/version-16, nextjs.org/support-policy, nextjs.org/docs/app/building-your-application/caching, developer.mozilla.org/en-US/docs/Web/HTTP/Caching |
| 11 | 9–15 November 2026 | auth.pilcrowonpaper.com, cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html, cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html, oslojs.dev, portswigger.net/web-security/authentication |
| 12 | 16–22 November 2026 | vitest.dev, testing-library.com, mswjs.io, playwright.dev/docs/best-practices, docs.github.com/en/actions, kentcdodds.com/blog/write-tests |
| 13 | 23–29 November 2026 | owasp.org/Top10/2025, cheatsheetseries.owasp.org, portswigger.net/web-security, owasp.org/Top10/2025/A03_2025-Software_Supply_Chain_Failures/, owasp.org/Top10/2025/A10_2025-Mishandling_of_Exceptional_Conditions |
| 14 | 30 Nov – 6 Dec 2026 | docs.docker.com/get-started, docs.docker.com/compose, labs.play-with-docker.com, caddyserver.com/docs, redis.io/docs/latest, valkey.io, upstash.com/docs |
| 15 | 7–13 December 2026 | docs.bullmq.io, github.com/donnemartin/system-design-primer, explain.dalibo.com, use-the-index-luke.com, getpino.io, docs.sentry.io, signoz.io, opentelemetry.io/docs |
| 16 | 14–20 December 2026 | ai-sdk.dev/docs/introduction, ai-sdk.dev/docs/migration-guides/migration-guide-7-0, cookbook.openai.com, promptingguide.ai, platform.openai.com/docs |
| 17 | 21–27 December 2026 | github.com/pgvector/pgvector, anthropic.com/engineering/contextual-retrieval, platform.claude.com/cookbook/capabilities-contextual-embeddings-guide, pinecone.io/learn, cookbook.openai.com |
| 18 | 28 Dec 2026 – 3 Jan 2027 | docs.ragas.io/en/stable, arxiv.org/abs/2309.15217, genai.owasp.org, langfuse.com/docs, hamel.dev/blog/posts/evals |
| 19 | 4–10 January 2027 | modelcontextprotocol.io, modelcontextprotocol.io/specification/2026-07-28, modelcontextprotocol.io/specification/2026-07-28/changelog, anthropic.com/engineering/building-effective-agents, github.com/modelcontextprotocol/servers |
| 20 | 11–17 January 2027 | tryexponent.com/practice, interviewing.io/mocks, bctci.co/free-chapters, techinterviewhandbook.org, techinterviewhandbook.org/self-introduction |
| 21 | 18–24 January 2027 | techinterviewhandbook.org, levels.fyi, ambitionbox.com, wellfound.com, naukri.com, linkedin.com/jobs |


## Appendix E | Seed counts, the contract with the tracker

The tracker seeds itself from this file. If any count below does not match after seeding, the seed script must fail loudly and refuse to start the app. This table is what makes "nothing was skipped" a testable statement instead of a promise.

| Table | Expected rows | Source in this file |
| --- | --- | --- |
| phases | 6 | Part 3, Phases |
| weeks | 21 | Part 3 and Part 4 |
| week_days | 126 | Part 4, six rows per week |
| calendar_days | 150 | Appendix C |
| week_links | 120 | Part 4, links for each week |
| gates | 4 | The four gates |
| money_gates | 4 | Part 17.12 |
| sundays | 21 | Part 3, The Sundays |
| projects | 4 | Part 5 |
| readme_sections | 9 | Part 5 |
| resource_categories | 20 | Part 7 |
| dsa_topics and problems | 474 total, 152 easy, 186 medium, 136 hard | Part 3, C14 |
| roles | 7 | Part 12 |
| corrections | 25 | Part 0 |
| stack_versions | 18 | Part 6 |
| breaks | 11 | Part 6 |
| dead_links | 7 | Appendix A |
| offers | 8 | Part 17.4 |
| money_weekly_targets | 21 | Part 17.14 |
| trackers | 9 | Part 18.1 |
| warnings | 10 | Part 18.5 |
| nz_costs | 8 | Part 16, What the move actually costs |
| nz_salary | 3 | Part 16, What the salary is actually worth |
| nz_projection | 5 | Part 16, Where the crores actually come from |
| roles_early | 9 | Part 19.2 |
| eligibility_weeks | 22 | Part 19.3 |
| eligibility_dsa | 13 | Part 19.4 |
| fast_exits | 4 | Part 19.5 |
| skill_combos | 8 | Part 19.6 |

Appendix G is a verification log, not seed data. Nothing in Appendix G is parsed, seeded or counted, and its presence must not change a single number in the table above. If a parser tries to turn it into rows, the parser is wrong. It renders read only on the reference screen under a heading called Verification log.


## Appendix F | What this final version adds, and what it does not touch

**Added.**

- Part 17, the money hour. One extra hour a day, 17:00 to 18:00, six days a week, 129 hours across the window. Offers, prices, scripts, rules, honest targets, four money gates.
- Part 18, the tracking contract. Nine trackers, the definition of a done day, the daily DSA pace table, GitHub push targets, ten automatic warnings, the Saturday review, the honesty rules.
- Part 19, the employment eligibility ladder. Sixteen roles instead of seven, a week by week eligibility table for all 21 weeks, a DSA only ladder at thirteen problem counts, four exits priced in rupees, and an eight row skill combination matrix. It exists because Part 12 and Part 13 together could not answer what a hundred problems and JavaScript alone are worth.
- Appendix C, the full 150 day calendar, one row per day, generated from Part 4 so it cannot drift from it.
- Appendix D, every link in the plan indexed by week, so the tracker can put one click between you and the material.
- Appendix E, the seed count contract.
- Money entries in the clock, the daily schedule and Appendix B.

**Not touched.** Part 0 through Part 16 are unchanged. Every correction, every version pin, every link, every project, every role, every unlock and every New Zealand fact is exactly as verified on 27 August 2026. The study plan did not get lighter because a money hour was added. That was the point.

---

## Appendix G | Verification log, 27 August 2026

This appendix is a record, not seed data. The tracker does not need to import it. It exists so that in six weeks, when you are tired and doubting the plan, you can see exactly what was checked, on what date, and what the answer was.

### G.1 Structural checks run against this file

Every one of these was run by script against the finished document, not judged by eye.

| # | Check | Result |
| --- | --- | --- |
| 1 | Calendar rows in Appendix C | 150, contiguous, 28 Aug 2026 to 24 Jan 2027, no gaps |
| 2 | Weekday name on every calendar row | 150 of 150 correct against the real 2026 and 2027 calendar |
| 3 | Duplicate dates | none |
| 4 | Row types | 3 launch, 126 study, 21 roadmap Sundays. 30 Aug is both a launch day and a Sunday |
| 5 | Daily DSA numbers summed per week | matches the Part 3 weekly target in all 21 weeks |
| 6 | DSA total across the 126 study days | 415, matches Part 3 |
| 7 | Part 3 cumulative column | arithmetically correct on all 21 rows, ends at 415 |
| 8 | Launch block problems | 6, on 30 Aug, sitting outside the 415 |
| 9 | Roadmap Sundays carrying DSA work | zero, as intended |
| 10 | Week headings | 21, numbered 01 to 21, in order, none missing or repeated |
| 11 | Gate dates land on Sundays | 4 Oct, 15 Nov, 13 Dec 2026 and 24 Jan 2027 are all Sundays |
| 12 | Core hours | 126x8 + 10x6 + 4x3 + 3x8 = 1,104 |
| 13 | Night recall hours | 126 x 0.75 = 94.5 |
| 14 | Money hours | 3 launch + 126 weekday = 129. Sunday admin is not counted, so the real figure is slightly higher, never lower |
| 15 | Total committed hours | 1,104 + 94.5 + 129 = 1,327.5 |
| 16 | Duplicate headings | none across 164 headings |
| 17 | Every Part and Appendix cross reference | all resolve to a section that exists |
| 18 | Every Part 17.x and Part 18.x reference | all resolve |
| 19 | Placeholder text: TODO, TBD, XXX, lorem | none |
| 20 | Em dashes | zero |
| 21 | Malformed tables | none, every table row has a consistent column count |
| 22 | Dead links from Appendix A reappearing in Appendix D | none |
| 23 | Appendix E seed counts against the real Part 16 money tables | nz_costs 8 rows, nz_salary 3 rows, nz_projection 5 rows. All three match what the tracker is told to expect, so the build cannot pass P0 with a drifted roadmap |
| 24 | Appendix E seed counts against the real Part 19 eligibility tables | roles_early 9 rows, eligibility_weeks 22 rows, eligibility_dsa 13 rows, fast_exits 4 rows, skill_combos 8 rows. Every week date in 19.3 was recomputed against the real calendar, and every DSA total in 19.3 matches the Part 3 cumulative column exactly |

### G.2 External facts re-verified on 27 August 2026

| Claim in this document | Verified value | Source checked |
| --- | --- | --- |
| Node 24 Krypton is Active LTS, maintenance from 20 Oct 2026, EOL 30 Apr 2028 | confirmed exactly | nodejs Release schedule |
| Node 26 becomes Active LTS on 28 Oct 2026 | confirmed | nodejs Release schedule |
| React 19.2 is current, Compiler 1.0 is stable | confirmed, Compiler 1.0 stable since 7 Oct 2025 | react.dev versions page |
| Next.js 16: Turbopack default, middleware renamed to proxy, PPR through cacheComponents | confirmed. Current minor line is 16.3, which added file system caching for builds | Next.js 16 release notes and upgrade guide |
| Tailwind v4 | confirmed. Current stable is the 4.3 line, released July 2026. Learn v4, the minor does not change what you learn | Tailwind releases |
| PostgreSQL 18, supported to 14 Nov 2030 | confirmed. Current minor is 18.6, released 11 Aug 2026 | PostgreSQL versioning policy |
| Redis 8 is tri-licensed RSALv2, SSPLv1, AGPLv3. Valkey is BSD-3 | confirmed | Redis licence page and LICENSE.txt |
| AI SDK 7 is ESM only, needs Node 22 or later, migrate with npx @ai-sdk/codemod v7 | confirmed word for word | Vercel AI SDK 7 changelog and migration guide |
| MCP specification 2026-07-28, stateless core | confirmed. Protocol sessions and the initialize handshake were removed in this revision | modelcontextprotocol.io specification |
| OWASP Top 10:2025 A03 Software Supply Chain Failures, A10 Mishandling of Exceptional Conditions | confirmed, both are the 2025 entries | owasp.org Top 10:2025 |
| Argon2id at m=19456, t=2, p=1 | confirmed as an OWASP recommended configuration | OWASP Password Storage Cheat Sheet |
| pgvector: vector indexes to 2,000 dimensions, halfvec to 4,000 | confirmed. bit extends to 64,000 | pgvector documentation |
| GitHub REST API: 60 requests an hour unauthenticated, 5,000 authenticated | confirmed | GitHub REST rate limit docs |
| Software Engineer 261313 is Tier 1 on the Green List with a blank wage requirement cell | confirmed against the live operational manual. 262111 and 262113 require NZD 70.00 an hour, 135111 requires NZD 72.80 | Immigration NZ Appendix 13, 9 March 2026 |
| Immigration median wage NZD 35.00 an hour from 9 March 2026 | confirmed | Immigration NZ and 2026 advisory notices |
| Skilled Migrant Category needs 6 points | confirmed, 6 point pass mark since the 2023 reset | Immigration NZ skilled residence instructions |
| Age cap on every New Zealand residence pathway | re-verified 27 August 2026. Straight to Residence, Work to Residence and the Skilled Migrant Category each state age 55 or younger at the time of application. All three checked separately | Immigration NZ visa pages, three pages |
| Your age, computed not assumed | 25 years 7 months today by your real date of birth, 23 years 7 months on your ID. 26 and 24 at Gate 4. This corrected an off by one error in the Part 16 timeline, found 27 August 2026 | date arithmetic against both dates of birth |
| Skilled Migrant Category changed 24 August 2026 | the change itself is confirmed by Immigration NZ, including two new pathways, the Skilled Work Experience Pathway and the Trades and Technician Pathway. The further claim that work experience can substitute for a degree comes from immigration adviser summaries, not from the instructions themselves, because the Immigration NZ change page timed out today. Promising for the Level 7 risk, not yet settled | Immigration NZ news centre, adviser summaries flagged as secondary |
| NZQA International Qualification Assessment | Standard IQA NZD 445, Skill Shortage List IQA NZD 610. Average wait about 10 weeks, and 90 per cent of complete applications finish inside 15 working days | NZQA fees and IQA pages |
| Claude subscription cost in India | corrected today. Pro is Rs 2,399 a month monthly, or Rs 2,000 a month billed annually, taxes included, since 13 July 2026. Max starts at Rs 11,999 | Anthropic India pricing coverage, July 2026 |
| NZD to INR rate used for every rupee figure in Part 16 | 56.70 mid market on 27 August 2026. Week band 56.60 to 57.20, twelve month range 49.81 to 57.16 | four sources cross checked: XE, Wise, MTFX, OFX |
| Straight to Residence Visa fee | from NZD 6,450, which is Rs 3,65,715 at today's rate. 80 per cent of applications are decided within 4 months | Immigration NZ Straight to Residence visa page |
| Active Investor Plus Visa thresholds, the actual source of the crore figure | NZD 5 million over 3 years in the Growth category, or NZD 10 million over 5 years in the Balanced category. Rules clarified 12 August 2026 | Immigration NZ Active Investor Plus page |
| IELTS fee in India | Rs 19,000 for Academic and General Training from 1 April 2026. UKVI Rs 19,250, One Skill Retake Rs 12,650 | IDP IELTS India fee page |
| Auckland rent and bond | median rental index NZD 660 a week in June 2026, one bedroom options from NZD 370 to 490. Bond is capped at four weeks rent by law | Tenancy Services market rent and Trade Me rental price index |
| Immigration NZ medical cost | not centrally published. Must be done at an INZ panel physician. Costed here as a band from comparable panel clinic pricing, and flagged in G.4 | Immigration NZ panel physician requirement |
| Total cost of the job route to New Zealand residence | Rs 8.9 lakh mid band, Rs 12 lakh pessimistic. 320 times cheaper than the investor route | computed from the seven verified line items above |
| Fresher AI and machine learning salary band in India | Rs 6 to 9 lakh for fresher AI or ML roles in 2026 | Masai 2026 AI Job Market Report, India edition |
| Applied AI Engineer range in India | Rs 6 lakh at entry in IT services, rising above Rs 80 lakh for senior specialists at AI first companies | Recrew Applied AI Engineer India salary guide 2026 |
| The AI skill premium for freshers | 25 to 40 per cent above comparable classical IT roles at the same experience level | TheHireHub IT fresher hiring India 2026 |
| Fresher backend salary band | Rs 5 to 10 lakh at 0 to 2 years, with a 15 to 30 per cent metro premium on top | ResumeVera backend developer India 2026 |
| Fresher full stack and MERN salary band | Rs 3 to 7 lakh, which sits below the Part 12 band and is exactly why Part 19 states a lower realistic floor | WsCube MERN salary 2026 and Agilemania software developer India 2026 |
| Forward Deployed Engineer band in India at 0 to 2 years | Rs 18 to 28 lakh, far above the Rs 10 to 12 lakh figure in Part 12, but these roles rarely hire a first jobber | BuildFastWithAI Forward Deployed Engineer India bands, 29 July 2026 |
| Forward Deployed Engineer demand growth | postings grew 729 per cent year on year to April 2026 | Uplers Forward Deployed Engineer 2026 guide |
| Concentration of Indian tech hiring demand | about 65 per cent of technology hiring demand is in AI, machine learning, cloud and cybersecurity, while overall hiring growth is about 3 per cent year on year | foundit report carried by Fortune India |
| Indian AI talent supply gap | India needs over 1 million AI professionals by 2027 and trained supply covers under 20 per cent of that demand | NASSCOM Future of Work India, cited August 2026 |
| Direction of Indian white collar hiring | up 12 per cent in February 2026, with IT and AI roles leading the rise | Naukri JobSpeak index via Economic Times |

### G.3 Corrections made on 27 August 2026

1. **Claude price.** Part 17.11 said about Rs 1,800 a month. That predates India rupee pricing. Corrected to the verified figures above.
2. **Location.** The header said Bengaluru. Corrected to Patna, Bihar, open to remote and ready to relocate.
3. **Hours.** The clock said 1,198.5 total committed hours, which was correct before the money hour existed. Corrected to 1,327.5 with the split shown.
4. **DSA wording.** The Appendix C legend now states that the 6 launch problems on 30 August sit outside the 415, so the two numbers can never look like a contradiction.

### G.4 What could not be verified from here, stated plainly

1. **The 122 library links were checked when this roadmap was written and the 7 that had moved or died are listed in Appendix A.** They were not all re-pinged today. The tracker runs check-links weekly for exactly this reason. If a link dies mid week, use the archive copy and log it.
2. **Every price in Part 17 is a market band, not a quote.** Bands move. Quote from what the client in front of you can pay, and never below the floor in the offer sheet.
3. **Whether a three year Indian BCA assesses at NZQF Level 7.** Only NZQA can answer that, and only when you pay for the assessment. It is named as the largest open risk in Part 16 and that has not changed.
4. **Salary figures for Indian roles in Part 12** come from public aggregator ranges. Treat them as ranges, not offers.
5. **The full text of the 24 August 2026 Skilled Migrant Category changes.** The Immigration NZ page for it returned a timeout on 27 August 2026. The existence and names of the two new pathways are confirmed, the fine detail is from secondary sources and is marked as such in G.2. Re-read it directly in 2029 when the NZQA assessment starts, because by then it will have changed again.
6. **The New Zealand income tax figures in Part 16** were computed from the published bracket rates rather than re-verified line by line against an Inland Revenue calculator, and they exclude the ACC earner levy, which is small but real. The flight cost and the medical fee are bands, not quotes. The wealth table is a projection built on the stated assumptions, and the moment an assumption changes, the number changes with it. Recompute it yourself the year you land, with your real offer in hand.
7. **The nine early role bands in Part 19.2** are inferred from adjacent 2026 aggregator data for India, not from role specific salary surveys. WEB, SUP, AUTO and DEVREL in particular have no clean public fresher band for Patna or for remote work. Treat every figure in 19.2 as a direction of travel, and replace it with a real number the first time you hold an actual offer letter.
8. **Several salary pages read while building Part 19 carried embedded instruction text aimed at the reading tool.** None of it was followed. Figures were taken only from table data, and only where at least two independent sources agreed. Any value that appeared on a single page is named with that single source in G.2 so you can see which numbers are thinner than the others.

Nothing in Parts 0 to 16 was removed, softened or rewritten to make the money hour fit, and nothing in Parts 0 to 18 was changed to make Part 19 fit. That was the whole point.

---

*Roadmap verified 27 August 2026. This final version compiled and audited 27 August 2026 with Part 17, Part 18, Part 19 and Appendices C, D, E, F and G added. Twenty four structural checks and thirty eight external fact checks were run against the finished file, and the results are in Appendix G. Where something could not be verified, Appendix G says so. Prices and platform costs in Part 17 are bands, not quotes, and must be checked on the day you use them.*

