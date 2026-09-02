# Tasks not seeded from the client export

Companion to `supabase/seed-tasks.sql`, generated from the same source:
`Critical Path - Data exported 24th August 2026.xlsx`, TASKS sheet.

| | Rows |
|---|---|
| In the sheet | 833 |
| **Seeded** | **793** |
| Excluded | 40 |
| Seeded with an adjusted timeline | 35 |

`Row` is the spreadsheet row number, so each entry can be found and fixed at source.

---

## Excluded — not in the database

### References an individual with no profile row (26)

`Par Lundqvist` appears in OWNER or PEOPLE INVOLVED on these rows. Every other party in
the export is a department and maps cleanly; this one is a person, and there is no
matching row in `profiles`, so the participant can't be created.

**To fix:** create a profile for them (they sign in once, or an admin adds them), then
re-generate this seed — no schema change needed, `task_participants.profile_id` already
supports individuals.

| Row | Season | Task |
|---|---|---|
| 20 | Q3'26 | CREATIVE WRAP UP PRESENTATION |
| 25 | Q3'26 | DENIM WORKSHOP - FABRIC, WASH & SUPPLIER ALLOCATION TO MATRIX |
| 42 | Q3'26 | LAUNDRY WEEK / GMS PHOTOS DUE |
| 43 | Q3'26 | GMS APPROVAL |
| 136 | Q4'26 | Design Pitch* (only if required for 2nd season) |
| 138 | Q4'26 | Denim shell matrix sent to suppliers for sample yardage ordering* |
| 142 | Q4'26 | GLOBAL Range Finalisation (Denim and Apparel)* |
| 147 | Q4'26 | GMS photos due / FOB's due (Monday) |
| 148 | Q4'26 | GMS Approval to supplier* |
| 153 | Q4'26 | Go to Market Meeting - Part 2: Product Handover, Finalisation RRP$, FOB's and margins* |
| 241 | Q1'27 / H1'27 | CREATIVE WRAP UP PRESENTATION |
| 246 | Q1'27 / H1'27 | DENIM WORKSHOP (FABRIC, WASH & SUPPLIER ALLOCATION TO MATRIX) |
| 259 | Q1'27 / H1'27 | LAUNDRY WEEK / GMS APPROVAL |
| 343 | Q2'27 | CREATIVE WRAP UP PRESENTATION |
| 348 | Q2'27 | RANGE WORKSHOP - FABRIC, WASH & SUPPLIER ALLOCATION TO MATRIX |
| 361 | Q2'27 | LAUNDRY WEEK / GMS APPROVAL |
| 394 | RW Q2'27 | DENIM WORKSHOP - FABRIC, WASH & SUPPLIER ALLOCATION TO MATRIX |
| 406 | RW Q2'27 | KEY LOOKS / STORY BOARDS / MOOD BOARD H/O TO MARKETING |
| 507 | Q3'27 / H2'27 | TREND & CREATIVE PRESENTATION |
| 511 | Q3'27 / H2'27 | DENIM WORKSHOP - FABRIC & TRIM WORKSHOP |
| 513 | Q3'27 / H2'27 | RANGE WORKSHOP - FABRIC, WASH & SUPPLIER ALLOCATION TO MATRIX |
| 526 | Q3'27 / H2'27 | LAUNDRY WEEK / GMS APPROVAL |
| 676 | Q4'27 | CREATIVE WRAP UP PRESENTATION |
| 680 | Q4'27 | DENIM WORKSHOP - FABRIC & TRIM |
| 682 | Q4'27 | RANGE WORKSHOP - FABRIC, WASH & SUPPLIER ALLOCATION TO MATRIX |
| 695 | Q4'27 | LAUNDRY WEEK / GMS APPROVAL |

### No due date (14)

`tasks.due_date` is NOT NULL. These rows are empty in all three date columns that could
supply one — DUE DATE, Due Date (zapier), and Working Timeline - End — so there is
nothing to fall back to.

**To fix:** fill in a due date in the sheet and re-generate.

| Row | Season | Task |
|---|---|---|
| 160 | Q4'26 | SWEDEN Conference |
| 161 | Q4'26 | ANZ Conference (Wednesday - Friday) |
| 167 | Q4'26 | Global Sales Close 2 -  Order Deadline |
| 168 | Q4'26 | Global Sales Close 2 - Handover to Production* |
| 169 | Q4'26 | Global Sales Close 2 -  PO's Raised with Supplier |
| 170 | Q4'26 | Global Sales Close 3 -  Order Deadline |
| 171 | Q4'26 | Global Sales Close 3 - Handover to Production* |
| 172 | Q4'26 | Global Sales Close 3 - PO's Raised with Supplier |
| 368 | Q2'27 | KEY LOOKS / STORY BOARDS / MOOD BOARD H/O TO MARKETING |
| 369 | Q2'27 | PRODUCT GUIDE & VIDEO SHOOT |
| 533 | Q3'27 / H2'27 | KEY LOOKS / STORY BOARDS / MOOD BOARD H/O TO MARKETING |
| 534 | Q3'27 / H2'27 | PRODUCT GUIDE & VIDEO SHOOT |
| 702 | Q4'27 | KEY LOOKS / STORY BOARDS / MOOD BOARD H/O TO MARKETING |
| 703 | Q4'27 | PRODUCT GUIDE & VIDEO SHOOT |

---

## Seeded, but with the start date dropped (35)

These rows **are** in the database. Their `Working Timeline - Start` was later than their
`Working Timeline - End`, which violates the `tasks_end_date_after_start_date` constraint.

The sheet already flags them: its own `Duration (Days)` column is **negative** on every
one of these rows. In each case the end date agrees with the due date, so it's the start
that's wrong — it was set to null rather than losing an otherwise-valid task. The
Timeline renders a task with no start as a milestone on its due date, so these still
appear; they just don't draw a bar.

**To fix:** correct the start dates in the sheet and re-generate.

| Row | Season | Task | What was dropped |
|---|---|---|---|
| 16 | Q3'26 | PREVIOUS YEAR POST SEASON ANALYSIS | start_date 2026-08-01 was after end_date 2025-04-04 (sheet Duration = -484); start_date dropped |
| 19 | Q3'26 | USA/EU MOOD BOARD/COL PALETTE/COMPETITIVE SET ANALYSIS (MAJOR SELL IN DRIVERS EG FESTIVAL LOOKS/DENIM SHORTS) | start_date 2025-05-23 was after end_date 2025-03-14 (sheet Duration = -70); start_date dropped |
| 50 | Q3'26 | SMS PACKING LIST TO VENDORS | start_date 2025-11-10 was after end_date 2025-10-17 (sheet Duration = -24); start_date dropped |
| 66 | Q3'26 | SELL CLOSE 2 ORDER DEADLINE) - AW INTL, RW INTL, NEUW | start_date 2026-03-02 was after end_date 2026-02-22 (sheet Duration = -8); start_date dropped |
| 77 | RIP CURL Q3'26 | PROTO DUE | start_date 2026-07-20 was after end_date 2025-09-19 (sheet Duration = -304); start_date dropped |
| 95 | AUG '26 INJECTION | RANGE PLANNING DOCUMENT CREATION - INCL RRP$ (ASSORTMENT PLAN) | start_date 2026-08-24 was after end_date 2025-12-10 (sheet Duration = -257); start_date dropped |
| 115 | SEP '26 INJECTION | RANGE PLANNING DOCUMENT CREATION - INCL RRP$ (ASSORTMENT PLAN) | start_date 2026-06-08 was after end_date 2026-02-02 (sheet Duration = -126); start_date dropped |
| 135 | Q4'26 | Range Planning Document Creation (ASSORTMENT PLAN)* | start_date 2026-07-14 was after end_date 2025-06-20 (sheet Duration = -389); start_date dropped |
| 152 | Q4'26 | Final GMS due in Melbourne (Monday) | start_date 2026-02-20 was after end_date 2026-02-16 (sheet Duration = -4); start_date dropped |
| 178 | OCT '26 INJECTION | RANGE PLANNING DOCUMENT CREATION - INCL RRP$ (ASSORTMENT PLAN) | start_date 2026-10-13 was after end_date 2026-03-02 (sheet Duration = -225); start_date dropped |
| 198 | NOV '26 INJECTION | RANGE PLANNING DOCUMENT CREATION - INCL RRP$ (ASSORTMENT PLAN) | start_date 2026-08-11 was after end_date 2026-04-01 (sheet Duration = -132); start_date dropped |
| 218 | DEC '26 INJECTION | RANGE PLANNING DOCUMENT CREATION - INCL RRP$ (ASSORTMENT PLAN) | start_date 2026-09-18 was after end_date 2026-04-15 (sheet Duration = -156); start_date dropped |
| 238 | Q1'27 / H1'27 | PREVIOUS YEAR POST SEASON ANALYSIS - Planning team to add an outcomes & actions piece in here | start_date 2026-10-12 was after end_date 2025-10-03 (sheet Duration = -374); start_date dropped |
| 267 | Q1'27 / H1'27 | SMS PACKING LIST TO VENDORS | start_date 2026-06-12 was after end_date 2026-05-11 (sheet Duration = -32); start_date dropped |
| 275 | Q1'27 / H1'27 | SMS COMMENTS TO MAKERS (AM. RM & ALL BRANDS ANZ ONLY STYLES) | start_date 2026-07-26 was after end_date 2026-07-10 (sheet Duration = -16); start_date dropped |
| 277 | Q1'27 / H1'27 | SELL ADMIN CLOSE 1 | start_date 2026-07-31 was after end_date 2026-07-28 (sheet Duration = -3); start_date dropped |
| 283 | Q1'27 / H1'27 | SELL CLOSE 2 (ORDER DEADLINE) | start_date 2026-11-19 was after end_date 2026-08-25 (sheet Duration = -86); start_date dropped |
| 290 | Q1'27 / H1'27 | HANDOVER CANCELLATION LIST & DELIVERY SCHEDULES* | start_date 2026-11-19 was after end_date 2026-09-24 (sheet Duration = -56); start_date dropped |
| 298 | RJ'S H1'27 | DENIM & APPAREL TECH PACK H/O TO VENDORS | start_date 2026-12-30 was after end_date 2026-05-04 (sheet Duration = -240); start_date dropped |
| 313 | RJ'S H1'27 | INSTORE | start_date 2027-01-13 was after end_date 2026-02-01 (sheet Duration = -346); start_date dropped |
| 340 | Q2'27 | PREVIOUS YEAR POST SEASON ANALYSIS - Planning team to add an outcomes & actions piece in here | start_date 2027-02-10 was after end_date 2025-12-19 (sheet Duration = -418); start_date dropped |
| 371 | Q2'27 | SMS PACKING LIST TO VENDORS | start_date 2026-09-11 was after end_date 2026-08-17 (sheet Duration = -25); start_date dropped |
| 375 | Q2'27 | PRODUCTION TO HANDOVER DELIVERY MONTHS TO CUSTOMER SERVICE | start_date 2026-09-16 was after end_date 2026-08-28 (sheet Duration = 10.0); start_date dropped |
| 386 | Q2'27 | HANDOVER CANCELLATION LIST & DELIVERY SCHEDULES* | start_date 2027-01-31 was after end_date 2026-11-26 (sheet Duration = -66); start_date dropped |
| 389 | Q2'27 | SAMPLE HANDOVER | start_date 2027-02-01 was after end_date 2026-12-30 (sheet Duration = -33); start_date dropped |
| 411 | RW Q2'27 | PRODUCTION TO HANDOVER DELIVERY MONTHS TO CUSTOMER SERVICE | start_date 2026-09-18 was after end_date 2026-08-28 (sheet Duration = 10.0); start_date dropped |
| 426 | APR '27 INJECTION | INJECTION SELL IN STRATEGY/ SIGN OFF | start_date 2027-03-23 was after end_date 2026-07-01 (sheet Duration = -265); start_date dropped |
| 452 | MAY '27 INJECTION | INJECTION SELL IN STRATEGY/ SIGN OFF | start_date 2027-03-10 was after end_date 2026-07-13 (sheet Duration = -240); start_date dropped |
| 478 | JUNE '27 INJECTION | INJECTION SELL IN STRATEGY/ SIGN OFF | start_date 2027-04-15 was after end_date 2026-07-27 (sheet Duration = -262); start_date dropped |
| 504 | Q3'27 / H2'27 | PREVIOUS YEAR POST SEASON ANALYSIS - Planning team to add an outcomes & actions piece in here | start_date 2027-05-17 was after end_date 2026-03-27 (sheet Duration = -416); start_date dropped |
| 536 | Q3'27 / H2'27 | SMS PACKING LIST TO VENDORS | start_date 2026-11-20 was after end_date 2026-10-19 (sheet Duration = -32); start_date dropped |
| 551 | Q3'27 / H2'27 | SELL CLOSE 2 ORDER DEADLINE) | start_date 2027-05-23 was after end_date 2027-02-26 (sheet Duration = -86); start_date dropped |
| 558 | Q3'27 / H2'27 | HANDOVER CANCELLATION LIST & DELIVERY SCHEDULES* | start_date 2027-05-23 was after end_date 2027-03-30 (sheet Duration = -54); start_date dropped |
| 561 | Q3'27 / H2'27 | SAMPLE HANDOVER | start_date 2027-05-24 was after end_date 2027-04-06 (sheet Duration = -48); start_date dropped |
| 566 | RJ's H2'27 | SELL IN STRATEGY/ SIGN OFF | start_date 2027-06-28 was after end_date 2026-07-10 (sheet Duration = -353); start_date dropped |
