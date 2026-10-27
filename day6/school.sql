CREATE TABLE students (
  id    INTEGER PRIMARY KEY,
  name  TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE
);

CREATE TABLE courses (
  id    INTEGER PRIMARY KEY,
  title TEXT NOT NULL
);

CREATE TABLE enrolments (
  id         INTEGER PRIMARY KEY,
  student_id INTEGER NOT NULL,
  course_id  INTEGER NOT NULL,
  grade      TEXT,
  FOREIGN KEY (student_id) REFERENCES students(id),
  FOREIGN KEY (course_id)  REFERENCES courses(id),
  UNIQUE (student_id, course_id)
);

INSERT INTO students (id, name, email) VALUES
  (1, 'Grace Maina',   'grace@example.com'),
  (2, 'Alan Turing',    'alan@example.com'),
  (3, 'Mark Kilonzo',   'mark@example.com');

INSERT INTO courses (id, title) VALUES
  (1, 'Intro to Programming'),
  (2, 'Databases'),
  (3, 'Web Foundations');

INSERT INTO enrolments (id, student_id, course_id, grade) VALUES
  (1, 1, 1, 'A'),
  (2, 1, 2, 'B'),
  (3, 2, 1, 'A'),
  (4, 2, 3, 'B'),
  (5, 3, 2, NULL);

SELECT c.title
FROM courses c
JOIN enrolments e ON e.course_id = c.id
JOIN students s   ON s.id = e.student_id
WHERE s.name = 'Grace Maina';

SELECT s.name
FROM students s
JOIN enrolments e ON e.student_id = s.id
JOIN courses c    ON c.id = e.course_id
WHERE c.title = 'Intro to Programming';

SELECT c.title, COUNT(e.student_id) AS student_count
FROM courses c
LEFT JOIN enrolments e ON e.course_id = c.id
GROUP BY c.id, c.title;

SELECT s.name
FROM students s
LEFT JOIN enrolments e ON e.student_id = s.id
WHERE e.id IS NULL;

UPDATE enrolments
SET grade = 'A'
WHERE id = 2;