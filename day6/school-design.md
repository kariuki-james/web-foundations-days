# School Database — Design

## Tables

- **students** — one row per student. `id` is the primary key; `name` is required; `email` is required and `UNIQUE` so no two students share an address.
- **courses** — one row per course. `id` is the primary key; `title` is required.
- **enrolments** — one row per (student, course) pair. Holds `grade`. `student_id` and `course_id` are `NOT NULL` foreign keys into the other two tables. `UNIQUE (student_id, course_id)` stops the same student enrolling on the same course twice.

## Relationships

- **students → enrolments** is one-to-many: one student can have many enrolments, but each enrolment belongs to exactly one student.
- **courses → enrolments** is one-to-many: one course can have many enrolments, but each enrolment belongs to exactly one course.
- **students ↔ courses** is many-to-many: a student takes many courses and a course has many students. SQL tables can't express many-to-many directly, so the `enrolments` join table sits in the middle, holding one row per pairing (plus the grade, which belongs to the pairing rather than to either side).

## Index

```sql
CREATE INDEX idx_enrolments_course_id ON enrolments(course_id);
```

`enrolments` already has an index on `student_id` via the `UNIQUE (student_id, course_id)` constraint, but lookups by `course_id` (e.g. "all students on one course", "students per course") would otherwise scan the whole table. This index makes those queries use a lookup instead.

## SQL or NoSQL?

SQL. The data is small, well-structured, and highly relational — students, courses and the enrolments between them — and the operations are exactly what a relational database is built for: joins across three tables, `GROUP BY` counts, and enforcing referential integrity (a foreign key keeps every enrolment pointing at a real student and a real course, and a `UNIQUE` constraint stops duplicate enrolments). A document store would force you to either duplicate student/course data inside each enrolment document or do the joins in application code, and it wouldn't give you the same guarantees at write time. There is no high-volume, schema-less or horizontal-scale requirement here that would justify NoSQL.
