# Library API — Books Resource

Base URL: `https://api.example-library.com/v1`

All request and response bodies are JSON. Send `Content-Type: application/json` on POST and PUT.

## The book object

```json
{
  "id": 12,
  "title": "The Left Hand of Darkness",
  "author": "Ursula K. Le Guin",
  "isbn": "9780441478125",
  "year": 1969
}
```

## Endpoints

### 1. List all books

- **Method:** `GET`
- **Path:** `/books`
- **Description:** Returns every book in the library.
- **Request body:** none
- **Success:** `200 OK` — an array of book objects

### 2. Get one book

- **Method:** `GET`
- **Path:** `/books/{id}`
- **Description:** Returns the single book with the given id.
- **Request body:** none
- **Success:** `200 OK` — one book object

### 3. List books by author (query parameter)

- **Method:** `GET`
- **Path:** `/books?author=Ursula%20K.%20Le%20Guin`
- **Description:** Returns only the books written by the author named in the `author` query parameter.
- **Request body:** none
- **Success:** `200 OK` — an array of book objects (an empty array if that author has no books)

### 4. Create a book

- **Method:** `POST`
- **Path:** `/books`
- **Description:** Adds a new book to the library.
- **Request body:**

```json
{
  "title": "The Dispossessed",
  "author": "Ursula K. Le Guin",
  "isbn": "9780061054884",
  "year": 1974
}
```

- **Success:** `201 Created` — the new book object, including the server-generated `id`

### 5. Update a book

- **Method:** `PUT`
- **Path:** `/books/{id}`
- **Description:** Replaces the details of an existing book.
- **Request body:**

```json
{
  "title": "The Dispossessed",
  "author": "Ursula K. Le Guin",
  "isbn": "9780061054884",
  "year": 1974
}
```

- **Success:** `200 OK` — the updated book object

### 6. Delete a book

- **Method:** `DELETE`
- **Path:** `/books/{id}`
- **Description:** Removes a book from the library.
- **Request body:** none
- **Success:** `204 No Content` — empty response body

## Error codes

### 400 Bad Request

The client sent something the server can't accept — usually a missing or invalid field.

- **Example:** `POST /books` with a body of `{ "author": "Ursula K. Le Guin" }` (no `title`) returns `400 Bad Request` with a message like `"title is required"`.
- **Example:** `POST /books` with `{ "title": "X", "year": "nineteen" }` returns `400 Bad Request` because `year` must be a number.

### 404 Not Found

The path or the record doesn't exist.

- **Example:** `GET /books/9999` when no book has id `9999` returns `404 Not Found`.
- **Example:** `DELETE /books/9999` returns `404 Not Found` because there is nothing to delete.
- **Example:** `GET /book/12` (typo in the path) returns `404 Not Found`.
