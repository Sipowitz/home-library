import client, { setToken } from "./client";

export async function login(username: string, password: string) {
  const form = new URLSearchParams();
  form.append("username", username);
  form.append("password", password);

  const res = await client.post("/auth/login", form.toString(), {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  const data = res.data;

  setToken(data.access_token);

  return data.access_token;
}
