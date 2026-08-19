import { useEffect, useState } from "react";
import client from "../../../api/client";

type PendingUser = { id: number; username: string; email: string };

export function PendingUsersPanel() {
  const [users, setUsers] = useState<PendingUser[]>([]);
  async function refresh() { setUsers((await client.get<PendingUser[]>("/admin/users/pending")).data); }
  useEffect(() => {
    client.get<PendingUser[]>("/admin/users/pending").then((response) => setUsers(response.data));
  }, []);
  async function approve(id: number) { await client.post(`/admin/users/${id}/approve`); await refresh(); }
  async function reject(id: number) { await client.delete(`/admin/users/${id}`); await refresh(); }
  return <div className="space-y-3">
    {users.length === 0 && <p className="text-sm text-gray-400">No accounts are awaiting approval.</p>}
    {users.map((user) => <div key={user.id} className="flex items-center justify-between bg-gray-900/60 border border-gray-800 rounded-xl p-4">
      <div><div className="font-medium">{user.username}</div><div className="text-sm text-gray-400">{user.email}</div></div>
      <div className="flex gap-2"><button className="px-3 py-2 rounded bg-emerald-700" onClick={() => approve(user.id)}>Approve</button><button className="px-3 py-2 rounded bg-red-800" onClick={() => reject(user.id)}>Reject</button></div>
    </div>)}
  </div>;
}
