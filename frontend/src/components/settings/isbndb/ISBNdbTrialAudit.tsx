import { useEffect, useState } from "react";
import { getISBNdbAuditResult, getISBNdbAuditResults, getISBNdbAuditStatus, retryISBNdbAuditErrors, runISBNdbAuditBatch, type ISBNdbAuditDetail, type ISBNdbAuditItem, type ISBNdbAuditSummary } from "../../../api/isbndbAudit";
import { ActionButton } from "../../ui/ActionButton";
import { resolveCoverUrl } from "../../books/BookView";

const value = (input: unknown) => Array.isArray(input) ? input.join(", ") : typeof input === "object" ? "—" : input ? String(input) : "—";
const dimensions = (input: unknown) => {
  if (!input || typeof input !== "object" || Array.isArray(input)) return [];
  return ["height", "width", "length", "weight"].flatMap((key) => {
    const item = (input as Record<string, unknown>)[key];
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const { value: amount, unit } = item as Record<string, unknown>;
    return typeof amount === "number" || typeof amount === "string" ? [[key[0].toUpperCase() + key.slice(1), `${amount}${typeof unit === "string" && unit ? ` ${unit}` : ""}`] as const] : [];
  });
};

function CoverPreview({ label, url, library = false }: { label: string; url: unknown; library?: boolean }) {
  const source = typeof url === "string" && url ? (library ? resolveCoverUrl(url) : url) : null;
  return <div className="flex min-w-0 items-center gap-2"><div className="h-24 w-16 shrink-0 overflow-hidden rounded border border-border bg-surface-muted">{source ? <img src={source} alt={`${label} cover`} className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center px-1 text-center text-[10px] text-text-muted">No cover</span>}</div><span className="text-xs font-medium text-text-secondary">{label}</span></div>;
}

export function ISBNdbTrialAudit() {
  const [summary, setSummary] = useState<ISBNdbAuditSummary | null>(null);
  const [items, setItems] = useState<ISBNdbAuditItem[]>([]);
  const [detail, setDetail] = useState<ISBNdbAuditDetail | null>(null);
  const [running, setRunning] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [retryMessage, setRetryMessage] = useState<string | null>(null);
  const load = async () => { const [next, rows] = await Promise.all([getISBNdbAuditStatus(), getISBNdbAuditResults()]); setSummary(next); setItems(rows); };
  useEffect(() => { void load(); }, []);
  const run = async () => { if (running) return; setRunning(true); try { setSummary(await runISBNdbAuditBatch()); await load(); } finally { setRunning(false); } };
  const retryErrors = async () => {
    if (retrying) return;
    setRetrying(true); setRetryMessage(null);
    try { setSummary(await retryISBNdbAuditErrors()); await load(); }
    catch (error: any) { setRetryMessage(error?.response?.status === 409 ? "An ISBNdb audit is already running. Try again shortly." : "Could not retry ISBNdb errors. Existing results were retained."); }
    finally { setRetrying(false); }
  };
  const open = async (bookId: number) => setDetail(await getISBNdbAuditResult(bookId));
  if (!summary) return <p className="text-sm text-text-muted">Loading ISBNdb trial audit…</p>;
  const remote = detail?.isbndb || {};
  const structuredDimensions = dimensions(remote.dimensions_structured);
  return <div className="max-w-5xl space-y-5"><div><h2 className="text-lg font-semibold">ISBNdb Trial Audit</h2><p className="mt-1 text-sm text-text-muted">Read-only evaluation evidence. It never changes Library books, metadata, or covers.</p></div>{!summary.configured ? <p className="rounded-lg border border-warning/30 bg-warning-muted p-3 text-sm text-warning">ISBNdb is not configured. Set <code>ISBNDB_API_KEY</code> on the development backend.</p> : <><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl border border-border bg-surface p-3 text-sm">Books with ISBN: <strong>{summary.books_with_isbn}</strong><br />Checked: <strong>{summary.checked} / {summary.unique_isbns}</strong></div><div className="rounded-xl border border-border bg-surface p-3 text-sm">Found: <strong>{summary.found}</strong><br />Not found: <strong>{summary.not_found}</strong><br />Errors: <strong>{summary.errors}</strong></div><div className="rounded-xl border border-border bg-surface p-3 text-sm">Trial quota: <strong>{summary.quota?.left ?? "Unavailable"}{summary.quota?.total ? ` / ${summary.quota.total}` : ""}</strong></div></div><ActionButton variant="primary" disabled={running || !summary.remaining} onClick={() => void run()}>{running ? "Auditing…" : summary.checked ? "Continue Audit" : "Run Audit"}</ActionButton>{summary.errors > 0 && <ActionButton variant="secondary" disabled={retrying} onClick={() => void retryErrors()}>{retrying ? "Retrying..." : `Retry Errors (${summary.errors})`}</ActionButton>}{retryMessage && <p className="text-sm text-warning">{retryMessage}</p>}</>}<section><h3 className="text-sm font-semibold">Coverage from found ISBNdb records</h3><div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">{Object.entries(summary.coverage).map(([field, data]) => <div key={field} className="rounded border border-border p-2">{field}: {data.count} ({data.percentage}%)</div>)}</div></section><section><h3 className="text-sm font-semibold">Audited ISBNs</h3><div className="mt-2 divide-y rounded-xl border border-border">{items.map((item) => <button key={`${item.book_id}-${item.isbn}`} onClick={() => void open(item.book_id)} className="flex w-full justify-between gap-3 p-3 text-left text-sm hover:bg-surface-muted"><span>{item.title || item.isbn}</span><span className="text-text-muted">{item.status}</span></button>)}{!items.length && <p className="p-3 text-sm text-text-muted">No ISBNs audited yet.</p>}</div></section>{detail && <section className="rounded-xl border border-border bg-surface p-4"><div className="flex justify-between gap-3"><h3 className="font-semibold">Comparison</h3><ActionButton size="sm" variant="tertiary" onClick={() => setDetail(null)}>Close</ActionButton></div><div className="mt-3 grid gap-4 text-sm md:grid-cols-2"><div><h4 className="font-medium">Library</h4><CoverPreview label="Library" url={detail.book.cover_url} library />{[["Title", "title"], ["Author", "author"], ["Publisher", "publisher"], ["Year", "year"], ["Pages", "page_count"], ["Language", "language"], ["ISBN", "isbn"], ["Description", "description"]].map(([label, key]) => <p key={key}><span className="text-text-muted">{label}: </span>{value(detail.book[key])}</p>)}</div><div><h4 className="font-medium">ISBNdb</h4><CoverPreview label="ISBNdb" url={remote.image} />{[["Title", "title"], ["Authors", "authors"], ["Publisher", "publisher"], ["Published", "date_published"], ["Pages", "pages"], ["Language", "language"], ["ISBN", "isbn13"], ["Synopsis", "synopsis"]].map(([label, key]) => <p key={key}><span className="text-text-muted">{label}: </span>{value(remote[key])}</p>)}</div></div><div className="mt-3 text-sm"><h4 className="font-medium">ISBNdb-only fields</h4>{[["Binding", "binding"], ["Subjects", "subjects"], ...(structuredDimensions.length ? structuredDimensions : remote.dimensions ? [["Dimensions", value(remote.dimensions)] as const] : []), ["MSRP", "msrp"], ["Other ISBNs", "other_isbns"]].map(([label, field]) => <p key={label}><span className="text-text-muted">{label}: </span>{structuredDimensions.length && ["Height", "Width", "Length", "Weight"].includes(label) ? field : value(remote[field])}</p>)}</div></section>}</div>;
}
