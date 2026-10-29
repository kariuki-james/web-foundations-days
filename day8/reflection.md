# Reflection

The most difficult concept in the course was `async`/`await` and error handling. On Day 5 I wrote a `fetch` call and could not understand why the loading message vanished before the data arrived, or why a 404 from the server never showed as an error on the page. I got through it by logging every step to the console and rebuilding the function piece by piece: first a reusable `request()` wrapper that checks `response.ok`, then `try`/`catch`/`finally` around it so the button was always re-enabled. Deliberately breaking the URL to test the error path was what finally made it click — seeing the `catch` block run in a real browser was worth more than reading about it.

Based on the feedback on my capstone, I would improve the API client's delete handling. The code comment explaining that JSONPlaceholder does not persist deletes was accurate but buried in the source, so the app's behaviour looked like a bug to anyone reviewing the page. I would surface that limitation in the README and on the page itself, and make the empty state clearer.

Next I want to learn a real backend: Node with Express and PostgreSQL. Writing the Day 6 and Day 8 data models made me want to build the endpoints I have only designed so far, and to work with real transactions and unique constraints, since that is where double-booking is actually prevented.
