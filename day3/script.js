let notes = [
  { id: 1, text: "Buy milk and bread", category: "personal" },
  { id: 2, text: "Finish the Day 3 assignment", category: "study" },
  { id: 3, text: "Email the project report to Grace", category: "work" },
  { id: 4, text: "Revise JavaScript arrays", category: "study" },
  { id: 5, text: "Call mum", category: "personal" },
];

function searchNotes(word) {
  const searchTerm = word.toLowerCase();
  return notes.filter((note) => note.text.toLowerCase().includes(searchTerm));
}

function longestNote() {
  if (notes.length === 0) {
    return null;
  }
  return notes.reduce((longest, current) =>
    current.text.length > longest.text.length ? current : longest,
  );
}

function countByCategory() {
  return notes.reduce((counts, note) => {
    counts[note.category] = (counts[note.category] || 0) + 1;
    return counts;
  }, {});
}

function getSummary() {
  const total = notes.length;
  const word = total === 1 ? "note" : "notes";
  const counts = countByCategory();

  const categoryDetails = Object.entries(counts)
    .map(([cat, count]) => `${count} ${cat}`)
    .join(", ");

  return `${total} ${word}: ${categoryDetails}.`;
}

function isDuplicate(text) {
  const cleanedText = text.trim().toLowerCase();
  return notes.some((note) => note.text.trim().toLowerCase() === cleanedText);
}

function addNote(text, category) {
  const trimmedText = text.trim();
  const validCategories = ["personal", "work", "study"];

  if (trimmedText.length < 1 || trimmedText.length > 200) {
    console.log(
      "Failed to add note: Text length must be between 1 and 200 characters.",
    );
    return false;
  }

  if (!validCategories.includes(category)) {
    console.log(
      `Failed to add note: Invalid category "${category}". Must be personal, work, or study.`,
    );
    return false;
  }

  if (isDuplicate(text)) {
    console.log(`Failed to add note: Duplicate note text already exists.`);
    return false;
  }

  const newNote = {
    id: notes.length + 1,
    text: trimmedText,
    category: category,
  };

  notes.push(newNote);
  return true;
}

// Normal Case: Search for "milk" (case-insensitive)
console.log(searchNotes("MILK"));
// Expected Output: [{ id: 1, text: "Buy milk and bread", category: "personal" }]

// Edge Case: Search matching no notes
console.log(searchNotes("zebra"));
// Expected Output: []

// Normal Case: Find note with longest text
console.log(longestNote());
// Expected Output: { id: 3, text: "Email the project report to Grace", category: "work" }

// Edge Case: Longest note when array is empty
const tempNotes = notes;
notes = [];
console.log(longestNote());
// Expected Output: null
notes = tempNotes; // Restore notes array

// Normal Case: Count categories in current notes array
console.log(countByCategory());
// Expected Output: { personal: 2, study: 2, work: 1 }

// Edge Case: Count when array is empty
notes = [];
console.log(countByCategory());
// Expected Output: {}
notes = tempNotes; // Restore notes array

// Normal Case: Summary sentence with multiple notes
console.log(getSummary());
// Expected Output: "5 notes: 2 personal, 2 study, 1 work."

// Edge Case: Summary sentence with exactly one note
notes = [{ id: 1, text: "Buy milk", category: "personal" }];
console.log(getSummary());
// Expected Output: "1 note: 1 personal."
notes = tempNotes; // Restore notes array

// Normal Case: Match duplicate with different casing & spacing
console.log(isDuplicate("  BUY milk and bread  "));
// Expected Output: true

// Edge Case: Non-duplicate text
console.log(isDuplicate("Go for a morning run"));
// Expected Output: false

// Normal Case: Valid new note addition
console.log(addNote("Read 10 pages of book", "study"));
// Expected Output: true

// Edge Case 1: Duplicate text
console.log(addNote("Buy milk and bread", "personal"));
// Expected Console Log: "Failed to add note: Duplicate note text already exists."
// Expected Return: false

// Edge Case 2: Invalid category
console.log(addNote("Go groceries shopping", "shopping"));
// Expected Console Log: "Failed to add note: Invalid category "shopping". Must be personal, work, or study."
// Expected Return: false

// Edge Case 3: Empty string / Invalid length
console.log(addNote("   ", "personal"));
// Expected Console Log: "Failed to add note: Text length must be between 1 and 200 characters."
// Expected Return: false
