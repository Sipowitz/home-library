import client from "./client";

export type ISBNdbAuditSummary = { configured: boolean; total_books: number; books_with_isbn: number; unique_isbns: number; checked: number; found: number; not_found: number; errors: number; remaining: number; quota: { total?: number; spent?: number; left?: number; plan_name?: string } | null; coverage: Record<string, { count: number; percentage: number }> };
export type ISBNdbAuditItem = { book_id: number; isbn: string; status: string; checked_at: string; title?: string; error?: string | null };
export type ISBNdbAuditDetail = { book: Record<string, unknown>; status: string; checked_at?: string; error?: string | null; isbndb?: Record<string, unknown> | null };
export const getISBNdbAuditStatus = async () => (await client.get("/isbndb-audit/status")).data as ISBNdbAuditSummary;
export const runISBNdbAuditBatch = async () => (await client.post("/isbndb-audit/run")).data as ISBNdbAuditSummary;
export const getISBNdbAuditResults = async () => (await client.get("/isbndb-audit/results")).data as ISBNdbAuditItem[];
export const getISBNdbAuditResult = async (bookId: number) => (await client.get(`/isbndb-audit/results/${bookId}`)).data as ISBNdbAuditDetail;
