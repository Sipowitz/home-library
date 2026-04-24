import { API, setToken } from "./client";

export async function login(username: string, password: string) {
  const form = new URLSearchParams();
  form.append("username", username);
  form.append("password", password);

  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
  });

  const data = await res.json();

  if (!res.ok) throw new Error(data.detail);

  setToken(data.access_token);

  return data.access_token; // ✅ THIS LINE FIXES EVERYTHING
}
