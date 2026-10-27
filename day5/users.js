const API_URL = "https://jsonplaceholder.typicode.com/users";

const loadButton = document.getElementById("load-users");
const filterInput = document.getElementById("filter-input");
const statusEl = document.getElementById("status");
const listEl = document.getElementById("users-list");

let allUsers = [];

function renderUsers(list) {
  listEl.innerHTML = "";

  if (list.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No users match your filter.";
    listEl.appendChild(li);
    return;
  }

  for (const user of list) {
    const li = document.createElement("li");

    const name = document.createElement("h2");
    name.textContent = user.name;

    const email = document.createElement("p");
    email.textContent = user.email;

    const city = document.createElement("p");
    city.textContent = user.address.city;

    const company = document.createElement("p");
    company.textContent = user.company.name;

    li.append(name, email, city, company);
    listEl.appendChild(li);
  }
}

async function loadUsers() {
  loadButton.disabled = true;
  statusEl.textContent = "Loading users…";

  try {
    const response = await fetch(API_URL);

    if (!response.ok) {
      throw new Error(`Server responded with ${response.status}`);
    }

    const data = await response.json();
    allUsers = data;
    renderUsers(allUsers);
    statusEl.textContent = `Loaded ${allUsers.length} users.`;
  } catch (error) {
    console.error("Failed to load users:", error);
    statusEl.textContent = `Error: could not load users (${error.message}).`;
    listEl.innerHTML = "";
  } finally {
    loadButton.disabled = false;
  }
}

loadButton.addEventListener("click", loadUsers);

filterInput.addEventListener("input", () => {
  const term = filterInput.value.trim().toLowerCase();
  const matches = allUsers.filter((user) =>
    user.name.toLowerCase().includes(term),
  );
  renderUsers(matches);
});
