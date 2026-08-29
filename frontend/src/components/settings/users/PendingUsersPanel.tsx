import { useEffect, useState } from "react";

import axios from "axios";
import toast from "react-hot-toast";

import client from "../../../api/client";
import { ActionButton } from "../../ui/ActionButton";

type PendingUser = { id: number; username: string; email: string };
type UserAction = "approve" | "reject";

function getErrorMessage(error: unknown, action: UserAction) {
  const fallback = `Failed to ${action} user`;
  if (!axios.isAxiosError(error)) return fallback;
  const detail = error.response?.data?.detail;
  return typeof detail === "string" ? detail : fallback;
}

export function PendingUsersPanel() {
  const [users, setUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [runningActions, setRunningActions] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    async function loadUsers() {
      try {
        const response = await client.get<PendingUser[]>("/admin/users/pending");
        if (!cancelled) {
          setUsers(response.data);
          setLoadError(null);
        }
      } catch (error) {
        console.error("Failed to load pending users", error);
        if (!cancelled) setLoadError("Failed to load pending users.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadUsers();
    return () => { cancelled = true; };
  }, []);

  async function runAction(id: number, action: UserAction) {
    const actionKey = `${action}:${id}`;
    setRunningActions((current) => new Set(current).add(actionKey));

    try {
      if (action === "approve") {
        await client.post(`/admin/users/${id}/approve`);
      } else {
        await client.delete(`/admin/users/${id}`);
      }
      setUsers((current) => current.filter((user) => user.id !== id));
      toast.success(action === "approve" ? "User approved" : "User rejected");
    } catch (error) {
      console.error(`Failed to ${action} user`, error);
      toast.error(getErrorMessage(error, action));
    } finally {
      setRunningActions((current) => {
        const next = new Set(current);
        next.delete(actionKey);
        return next;
      });
    }
  }

  return (
    <div className="space-y-3">
      {loading && <p className="text-sm text-text-muted">Loading pending accounts...</p>}
      {!loading && loadError && <p className="text-sm text-danger">{loadError}</p>}
      {!loading && !loadError && users.length === 0 && (
        <p className="text-sm text-text-muted">No accounts are awaiting approval.</p>
      )}
      {users.map((user) => {
        const approving = runningActions.has(`approve:${user.id}`);
        const rejecting = runningActions.has(`reject:${user.id}`);
        return (
          <div key={user.id} className="flex items-center justify-between bg-surface border border-border rounded-xl p-4">
            <div><div className="font-medium">{user.username}</div><div className="text-sm text-text-muted">{user.email}</div></div>
            <div className="flex gap-2">
              <ActionButton variant="primary" size="sm" disabled={approving} onClick={() => runAction(user.id, "approve")}>
                {approving ? "Approving..." : "Approve"}
              </ActionButton>
              <ActionButton variant="danger" size="sm" disabled={rejecting} onClick={() => runAction(user.id, "reject")}>
                {rejecting ? "Rejecting..." : "Reject"}
              </ActionButton>
            </div>
          </div>
        );
      })}
    </div>
  );
}
