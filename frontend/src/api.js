const API_URL = "http://192.168.1.200:8000";

// ----------------------
// AUTH
// ----------------------

export async function register(username, password) {
  const res = await fetch(`${API_URL}/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) throw new Error("Register failed");
  return res.json();
}

export async function login(username, password) {
  const formData = new URLSearchParams();
  formData.append("username", username);
  formData.append("password", password);

  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) throw new Error("Login failed");
  return res.json();
}


// ----------------------
// BOOKS
// ----------------------

export async function getBooks() {
  const res = await fetch(`${API_URL}/books/`);
  return res.json();
}

export async function createBook(book) {
  const res = await fetch(`${API_URL}/books/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(book),
  });

  return res.json();
}
