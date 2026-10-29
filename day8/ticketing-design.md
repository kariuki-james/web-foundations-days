# TicketHub — system design

## 1. Requirements

### Functional

- Browse events and view an event's seat map.
- Hold a seat for a few minutes while paying.
- Pay for held seats and receive tickets.
- View your own tickets.
- Every seat is sold to at most one person.

### Non-functional

- **Speed:** seat maps and event pages should load in under 300 ms for most users, including during a big sale.
- **Correctness:** a seat can never be sold twice — this is a hard guarantee, not a best-effort one.
- **Fairness:** during a big sale every buyer gets a fair chance; no single user can lock up inventory, and bots cannot hold seats indefinitely.
- **Availability:** the site stays up during a 200,000-person sale spike.

## 2. Estimates

### Normal day

- 50,000 visitors × 10 pages = **500,000 page views/day**.
- 500,000 ÷ 86,400 s ≈ **5.8 page views/s average**, ≈ **29/s at peak** (5×).
- 5,000 tickets sold/day ÷ 86,400 s ≈ **0.06 purchases/s average**, ≈ **0.29/s at peak**.
- Read-to-write ratio ≈ 500,000 : 5,000 = **100:1 — strongly read-heavy**.

### Big sale (200,000 people, 20,000 seats, 10 minutes = 600 s)

- Arrivals: 200,000 ÷ 600 s ≈ **333 people/s**.
- Each person makes roughly 5 requests (event page, seat map, hold, refresh, pay) → 1,000,000 ÷ 600 ≈ **1,667 requests/s average**, ≈ **8,000/s in the opening burst**.
- Seat writes: 20,000 ÷ 600 s = **33 seats/s average**, but sales are front-loaded — most seats go in the first minute or two, so **150–350 seat writes/s during the rush**.

### Comparison

| Metric           | Normal             | Big sale                                        | Multiplier       |
| ---------------- | ------------------ | ----------------------------------------------- | ---------------- |
| Read requests/s  | 5.8 (29 peak)      | ~1,667 (8,000 burst)                            | ~290×            |
| Write requests/s | 0.06 (0.29 peak)   | 33 (150–350 rush)                               | ~550× to ~5,800× |
| Read:write ratio | 100:1 (read-heavy) | ~50:1 average, but write-bound at the seat step | —                |

The normal system is read-heavy and scales with caching and replicas. The big sale briefly turns it **write-heavy at one specific operation — claiming a seat** — and that operation must be exact. Everything in the design below is aimed at that one moment: keep the other 95% of traffic away from the database, and make the seat claim atomic.

## 3. API

| #   | Method | Path                 | Description                                | Success          |
| --- | ------ | -------------------- | ------------------------------------------ | ---------------- |
| 1   | GET    | `/events`            | List upcoming events (paginated, cached)   | `200 OK`         |
| 2   | GET    | `/events/{id}/seats` | Return the seat map and each seat's status | `200 OK`         |
| 3   | POST   | `/holds`             | Hold one or more seats for this user       | `201 Created`    |
| 4   | DELETE | `/holds/{id}`        | Release a hold early                       | `204 No Content` |
| 5   | POST   | `/orders`            | Pay for a hold and create the order        | `201 Created`    |
| 6   | GET    | `/me/tickets`        | List the signed-in user's tickets          | `200 OK`         |

`POST /holds` body:

```json
{ "seat_ids": [4821, 4822] }
```

Response `201 Created`:

```json
{
  "hold_id": 9001,
  "expires_at": "2024-05-01T10:17:00Z",
  "seat_ids": [4821, 4822]
}
```

`POST /orders` body:

```json
{ "hold_id": 9001, "payment_token": "tok_visa_4242" }
```

Response `201 Created`:

```json
{ "order_id": 771, "status": "paid", "ticket_ids": [50123, 50124] }
```

Errors on `POST /holds` and `POST /orders`: `409 Conflict` when a requested seat is no longer available, `410 Gone` when the hold has expired.

## 4. Data model

### Tables

- **users** — `id`, `email` (UNIQUE), `display_name`, `created_at`
- **events** — `id`, `title`, `venue`, `starts_at`, `created_at`
- **seats** — `id`, `event_id` FK, `section`, `row_label`, `seat_number`, `price_cents`; UNIQUE (`event_id`, `section`, `row_label`, `seat_number`)
- **holds** — `id`, `seat_id` FK **UNIQUE**, `user_id` FK, `expires_at`, `created_at`
- **orders** — `id`, `user_id` FK, `event_id` FK, `total_cents`, `status`, `created_at`
- **tickets** — `id`, `order_id` FK, `seat_id` FK **UNIQUE**, `qr_code`, `created_at`

```sql
CREATE TABLE users (
  id           INTEGER PRIMARY KEY,
  email        TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  created_at   TEXT NOT NULL
);

CREATE TABLE events (
  id         INTEGER PRIMARY KEY,
  title      TEXT NOT NULL,
  venue      TEXT NOT NULL,
  starts_at  TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE seats (
  id          INTEGER PRIMARY KEY,
  event_id    INTEGER NOT NULL,
  section     TEXT NOT NULL,
  row_label   TEXT NOT NULL,
  seat_number INTEGER NOT NULL,
  price_cents INTEGER NOT NULL,
  FOREIGN KEY (event_id) REFERENCES events(id),
  UNIQUE (event_id, section, row_label, seat_number)
);

CREATE TABLE holds (
  id         INTEGER PRIMARY KEY,
  seat_id    INTEGER NOT NULL UNIQUE,
  user_id    INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (seat_id) REFERENCES seats(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE orders (
  id          INTEGER PRIMARY KEY,
  user_id     INTEGER NOT NULL,
  event_id    INTEGER NOT NULL,
  total_cents INTEGER NOT NULL,
  status      TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  FOREIGN KEY (user_id)  REFERENCES users(id),
  FOREIGN KEY (event_id) REFERENCES events(id)
);

CREATE TABLE tickets (
  id         INTEGER PRIMARY KEY,
  order_id   INTEGER NOT NULL,
  seat_id    INTEGER NOT NULL UNIQUE,
  qr_code    TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (seat_id)  REFERENCES seats(id)
);
```

### Relationships

- **events → seats** one-to-many: one event has many seats, each seat belongs to one event.
- **users → holds**, **seats → holds** one-to-one in practice: `holds.seat_id` is UNIQUE, so at most one live hold exists per seat.
- **users → orders** one-to-many; **orders → tickets** one-to-many; **seats → tickets** one-to-one, enforced by `tickets.seat_id UNIQUE`.
- A seat's status is **derived, not stored**: sold if a ticket exists, held if a live hold exists, otherwise available. There is no `status` column to fall out of sync.

### How double-booking is prevented

Three mechanisms, each catching a different failure:

1. **`holds.seat_id` is UNIQUE.** Holding a seat is a single statement:

   ```sql
   INSERT INTO holds (seat_id, user_id, expires_at) VALUES (4821, 7, '...');
   ```

   If another user already holds that seat, the database rejects the insert with a unique-constraint violation, and the app returns `409 Conflict`. The check and the claim are the same atomic operation — there is no window between "is it free?" and "mark it taken" for a second request to slip through.

2. **`tickets.seat_id` is UNIQUE.** Payment writes a ticket row for the seat inside one transaction:

   ```sql
   BEGIN;
     INSERT INTO tickets (order_id, seat_id, qr_code, created_at) VALUES (...);
     DELETE FROM holds WHERE id = 9001;
     INSERT INTO orders (...) VALUES (...);
   COMMIT;
   ```

   Even if a bug let two holds exist, the second ticket insert fails and the transaction rolls back — the order is never recorded and the user is not charged. The unique constraint is the last line of defence and it cannot be bypassed by application code.

3. **Short hold TTL and a sweeper.** Holds expire (`expires_at`); a background worker deletes expired rows, freeing seats. Combined with a **per-user cap on active holds**, this is the fairness guarantee: nobody can hold the entire front row forever, and a crashed payment flow releases the seat automatically.

The claim is never "read status, then write status" in two steps — that pattern is what double-books. Every state change is a single constrained insert inside a transaction.

### Index

```sql
CREATE INDEX idx_seats_event_id ON seats(event_id);
```

The seat map query filters by `event_id` and runs constantly during a sale; without this index every seat-map request scans the whole `seats` table.

## 5. Architecture

```
                client (browser)
                       |
                       v
                     DNS
                       |
                       v
                     CDN  ── static assets + cached event images
                       |
                       v
              ┌─────────────────┐
              │  Waiting room   │  (only active during big sales)
              └────────┬────────┘
                       v
                Load Balancer
                 /          \
                v            v
          App Server     App Server  ──▶ Payment Gateway
             |   \          |   \
             |    \         |    \
             v     v        v     v
          Cache  Job Queue  Primary DB ──▶ Read Replica
                      |
                      v
                   Worker
```

- **DNS** — resolves the domain so clients reach the edge.
- **CDN** — serves HTML, CSS, JS and event images from edge nodes, keeping static traffic off the app servers entirely.
- **Waiting room** — admits buyers into the sale at a controlled rate, so 200,000 simultaneous arrivals become a steady stream the database can survive.
- **Load balancer** — spreads requests across app servers and removes unhealthy ones.
- **App servers** — run the application logic: authentication, validation, and the seat-claim transaction.
- **Cache** — holds event lists and seat maps so repeated browse requests never touch the database.
- **Primary database** — the source of truth; handles all writes and enforces the unique constraints that prevent double-booking.
- **Read replica** — serves browse and "my tickets" reads so they never compete with seat writes.
- **Job queue** — buffers slow side effects (confirmation email, QR generation, hold expiry sweeps).
- **Worker** — processes those jobs and sweeps expired holds.
- **Payment gateway** — external provider that charges the card; only a success token from it allows the ticket insert.

### How it survives the big sale

1. 200,000 arrivals hit the **waiting room** first, not the database. The app tier scales out to match the admitted rate.
2. Seat maps and event pages come from **CDN and cache**, so the ~95% of requests that are just looking never reach Postgres.
3. Only the seat claim reaches the **primary**. At 33–350 seat writes/s that is well within one Postgres instance — the constraint does the work, not application logic.
4. Every request that doesn't claim a seat goes to the **read replica** or returns from cache.
5. When a payment is abandoned, the **worker** releases the expired hold, so seats return to the pool within minutes instead of being locked forever.

## 6. Trade-offs

- **Holds with expiry vs. a simple free/sold flag.** Holds make payment safe and prevent a user from losing a seat while typing card details, but they add a third state, a background sweeper, and an edge case (payment arrives after the hold expires). Chosen because without holds, checkout is unusable under contention.
- **Waiting room vs. instant access.** A queue protects the database and gives every buyer a fair turn, but legitimate users wait and the experience feels slower than clicking straight through. Chosen because an overloaded database fails everyone, which is worse than a fair wait.
- **Strict uniqueness vs. a faster distributed seat map.** Enforcing claims with database constraints means some users get a `409 Conflict` and must pick another seat; an in-memory or eventually-consistent seat map would respond faster but can double-book. Correctness wins — a double-booked seat is a refund, an angry customer and a support ticket.
