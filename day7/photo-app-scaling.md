# SnapShare — Scaling Plan

## Assumptions

- 10 million registered users.
- 10% of them are active on any given day → 1,000,000 daily active users (DAU).
- Each active user uploads 1 photo per day.
- Each active user views 50 feed pages per day.
- Average photo is 2 MB; each photo also produces a 50 KB thumbnail.
- Traffic is spread evenly over 24 hours for averages; peak load is 5× the average.
- Photos are kept indefinitely (no deletion), so storage grows year on year.

Daily active users: **10,000,000 × 10% = 1,000,000 DAU.**

## Estimates

**Uploads per second**

- 1,000,000 uploads/day ÷ 86,400 s ≈ **11.6 uploads/s average**, ≈ **58 uploads/s at peak**.

**Feed views per second**

- 1,000,000 users × 50 views/day = 50,000,000 feed views/day.
- 50,000,000 ÷ 86,400 s ≈ **579 feed views/s average**, ≈ **2,894 feed views/s at peak**.

**Storage per year**

- Per photo: 2 MB + 50 KB ≈ 2.05 MB.
- 1,000,000 photos/day × 2.05 MB ≈ 2.05 TB/day.
- 2.05 TB × 365 ≈ **748 TB per year** (before replication).

## Read-heavy or write-heavy?

**Read-heavy.** Feed views (~579/s average) outnumber uploads (~11.6/s average) by roughly **50:1**, and that gap widens at peak (2,894 vs 58). The design therefore optimises for fast, cheap reads: a CDN in front of photo files, a cache in front of feed data, and a read replica so feed queries don't compete with writes. Writes are relatively rare and are made asynchronous (queue + worker) so a slow write never blocks the user.

## Why photos go in object storage, not the database

A 2 MB file inside a relational database bloats rows, slows backups and replication, and forces the database to serve binary blobs over the same connection as queries — wasting the database's strengths. Photo files belong in **object storage** (e.g. S3), which is built for cheap, durable, large-file storage and can be served directly through a CDN. The database stores only the metadata: photo ID, owner ID, object-storage key, caption, timestamp.

## Architecture

```
                ┌──────────┐
   users ──────▶│   CDN    │◀──── photo files, thumbnails
                └────┬─────┘
                     │ (cache miss / API calls)
                     ▼
              ┌─────────────┐
              │Load Balancer│
              └──────┬──────┘
                     ▼
          ┌─────────────────────┐
          │     App Servers     │
          └──┬───────┬───────┬──┘
             │       │       │
             ▼       ▼       ▼
        ┌───────┐ ┌──────┐ ┌──────────────┐
        │ Cache │ │Queue │ │  Database    │
        └───┬───┘ └──┬───┘ │  (primary)   │
            │        │      └──────┬───────┘
            │        ▼            ▼
            │  ┌──────────┐  ┌────────────┐
            │  │ Worker   │  │Read Replica│
            │  │(thumbs)  │  └────────────┘
            │  └────┬─────┘
            │       ▼
            └─▶ ┌──────────────┐
                │Object Storage│
                └──────────────┘
```

## Components (one sentence each)

- **CDN** — serves photo files and thumbnails from locations near users, cutting latency and taking the vast majority of read traffic off the origin.
- **Load Balancer** — spreads incoming requests across app servers so no single server is overwhelmed and failed servers are bypassed.
- **App Servers** — run the application logic: authenticate users, accept uploads, and build feed responses.
- **Cache** — holds hot feed data and metadata in memory so most feed requests never touch the database.
- **Database (primary)** — stores durable metadata (users, follows, photo records) and handles all writes.
- **Read Replica** — a copy of the database that serves read queries so feed reads don't compete with writes on the primary.
- **Object Storage** — stores the photo files and thumbnails themselves, cheaply and durably, at any scale.
- **Queue** — buffers thumbnail jobs so the upload request can finish immediately without waiting for image processing.
- **Worker** — consumes jobs from the queue and generates the 50 KB thumbnail for each uploaded photo.

## Upload flow, step by step

1. The user's client requests an upload from an app server; the app server creates a photo record (metadata only) and returns a pre-signed URL for object storage.
2. The client uploads the 2 MB photo directly to **object storage** using that URL — the photo never passes through the app servers.
3. The client tells the app server the upload is complete; the app server marks the photo record as ready in the **database (primary)**.
4. The app server pushes a thumbnail job onto the **queue** and returns success to the user immediately.
5. A **worker** picks up the job, downloads the photo from object storage, generates the 50 KB thumbnail, and writes it back to object storage.
6. The worker updates the photo record with the thumbnail key in the database.
7. When followers load their feed, the **app servers** read metadata via the **cache** (or the **read replica** on a miss) and the client fetches photo files and thumbnails through the **CDN**.

## Trade-offs

- **Eventual consistency of feeds vs. speed.** Serving feeds from the cache and read replica means a photo can take a moment to appear for followers. Accepted because a 50:1 read-to-write ratio makes fast reads far more valuable than instant visibility.
- **Direct-to-object-storage uploads vs. server control.** Letting clients upload straight to object storage removes load from app servers and scales cheaply, but it means the app can't inspect or reject a file in transit; validation must happen after upload via the worker.
- **Asynchronous thumbnails vs. simplicity.** The queue+worker design keeps uploads fast, but adds moving parts (a queue, workers, retry logic) and means a photo is briefly visible without a thumbnail.
- **Read replica vs. freshness on read.** Offloading reads to a replica protects the primary, but replica lag means a user can occasionally read stale data right after their own write.
