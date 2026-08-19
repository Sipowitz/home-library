

## Backup and restore

Library backups use the portable `.lbak` ZIP format and are scoped to the authenticated user. They contain books, organization trees, preferences, metadata history, and referenced local covers. They do not contain password hashes, provider API keys, access tokens, application secrets, database credentials, or other users' data. Restore validation is read-only; an explicitly confirmed restore replaces the current user's logical library in one database transaction.

Before a major restore, take a native PostgreSQL backup using your normal deployment/operations procedure. The application restore transaction protects the selected user's rows from partial database replacement, but `.lbak` is not a substitute for a full PostgreSQL disaster-recovery backup. Restored cover objects are immutable and content-addressed; newly published but unreferenced objects can remain after a failed restore and may be garbage-collected separately in the future.
