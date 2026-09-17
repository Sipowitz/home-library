import { expect, it, vi } from "vitest";

const post = vi.hoisted(() => vi.fn().mockResolvedValue({ data: { id: 42 } }));
vi.mock("./client", () => ({ default: { post } }));

import { uploadSeriesCover } from "./series";

it("uploads a selected collection cover as multipart form data", async () => {
  const file = new File(["cover"], "cover.png", { type: "image/png" });
  await uploadSeriesCover(42, file);

  expect(post).toHaveBeenCalledWith("/series/42/cover", expect.any(FormData), {
    headers: { "Content-Type": "multipart/form-data" },
  });
  const data = post.mock.calls[0][1] as FormData;
  expect(data.get("file")).toBe(file);
});
