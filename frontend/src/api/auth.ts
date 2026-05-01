import client, { setToken } from "./client";

type LoginResponse = {
  access_token: string;
  token_type: string;
};

export async function login(
  username: string,
  password: string,
): Promise<string> {
  const form = new URLSearchParams();

  form.append("username", username);

  form.append("password", password);

  const res = await client.post<LoginResponse>("/auth/login", form.toString(), {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  const data = res.data;

  setToken(data.access_token);

  return data.access_token;
}
