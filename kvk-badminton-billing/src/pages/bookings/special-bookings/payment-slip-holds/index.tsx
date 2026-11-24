import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Download, FileText, RefreshCw, Search, Upload } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { approveCashierSlip, bookingError, downloadCashierSlip, getCashierSlips, uploadCashierSlip,
  type CashierSlipReservation } from "@/services/special-bookings-api";

const deadlineFormat = new Intl.DateTimeFormat("en-LK", {
  dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Colombo",
});
const actionStyle = "cursor-pointer rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 disabled:cursor-not-allowed disabled:opacity-50";
const statusLabels = { awaiting_slip: "Awaiting slip", ready: "Ready for approval", expired: "Expired", approved: "Booking confirmed" };
const statusStyles = {
  awaiting_slip: "bg-amber-100 text-amber-900",
  ready: "bg-blue-100 text-blue-900",
  expired: "bg-gray-100 text-gray-700",
  approved: "bg-green-100 text-green-900",
};
type HoldStatus = CashierSlipReservation["status"];
const statusOptions = Object.entries(statusLabels) as [HoldStatus, string][];
const defaultFilters = { query: "", status: "all", slip: "all", sms: "all", minAmount: "", maxAmount: "", sort: "default" };
const fieldStyle = "mt-1.5 min-h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-amber-600 focus:outline-2 focus:outline-amber-600";

function holdStatus(row: CashierSlipReservation, now: number): HoldStatus {
  return row.status !== "approved" && Date.parse(row.paymentDueUtc) <= now ? "expired" : row.status;
}

export default function PaymentSlipHoldsPage() {
  const { state, pathname } = useLocation();
  const fromRegularBookings = pathname.startsWith("/bookings/");
  const [rows, setRows] = useState<CashierSlipReservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState(defaultFilters);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      try {
        const data = await getCashierSlips(controller.signal);
        if (!controller.signal.aborted) setRows(data);
      } catch (reason) {
        if (!controller.signal.aborted) setError(bookingError(reason));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [reload]);

  function update(row: CashierSlipReservation) {
    setRows(current => current.map(item => item.reference === row.reference ? row : item));
  }

  function setFilter(key: keyof typeof defaultFilters, value: string) {
    setFilters(current => ({ ...current, [key]: value }));
  }

  const reservations = rows.map(row => ({ row, status: holdStatus(row, now) }));
  const counts = { awaiting_slip: 0, ready: 0, expired: 0, approved: 0 };
  for (const { status } of reservations) counts[status]++;

  const query = filters.query.trim().toLowerCase();
  const phoneQuery = /^[+\d\s().-]+$/.test(query) ? query.replace(/\D/g, "") : "";
  const invalidRange = filters.minAmount !== "" && filters.maxAmount !== "" &&
    Number(filters.minAmount) > Number(filters.maxAmount);
  const visible = reservations.filter(({ row, status }) =>
    (!query || [row.customerName, row.phoneNumber, row.reference].some(value => value.toLowerCase().includes(query)) ||
      (phoneQuery && row.phoneNumber.replace(/\D/g, "").includes(phoneQuery))) &&
    (filters.status === "all" || status === filters.status) &&
    (filters.slip === "all" || Boolean(row.slipRevision) === (filters.slip === "attached")) &&
    (filters.sms === "all" || (status === "approved" && row.smsSent === (filters.sms === "sent"))) &&
    (filters.minAmount === "" || row.finalAmount >= Number(filters.minAmount)) &&
    (filters.maxAmount === "" || row.finalAmount <= Number(filters.maxAmount))
  );
  if (filters.sort === "deadline") visible.sort((a, b) => Date.parse(a.row.paymentDueUtc) - Date.parse(b.row.paymentDueUtc));
  if (filters.sort === "amount") visible.sort((a, b) => b.row.finalAmount - a.row.finalAmount);
  if (filters.sort === "customer") visible.sort((a, b) => a.row.customerName.localeCompare(b.row.customerName));
  const filtersChanged = Object.entries(defaultFilters).some(([key, value]) => filters[key as keyof typeof filters] !== value);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="rounded-xl bg-slate-900 p-3 text-amber-300"><FileText size={22} aria-hidden="true" /></span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Payment Slip Holds</h1>
              <p className="mt-1 text-sm text-slate-600">Upload payment slips and approve held court bookings.</p>
            </div>
          </div>
          <Link to={fromRegularBookings ? "/bookings" : "/special-bookings"} className={`${actionStyle} inline-flex items-center gap-2 bg-white text-gray-700 hover:bg-gray-50`}>
            <ArrowLeft size={16} aria-hidden="true" /> {fromRegularBookings ? "Back to Bookings" : "Back to Special Bookings"}
          </Link>
        </div>
        {state?.holdCreated === true && (
          <p role="status" className="mb-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
            Slots held. Upload the payment slip before the deadline shown below.
          </p>
        )}
        <div role="group" aria-label="Reservation status" className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
          {[["all", "All reservations", rows.length] as const, ...statusOptions.map(([status, label]) => [status, label, counts[status]] as const)].map(([status, label, count]) => (
            <button key={status} type="button" aria-pressed={filters.status === status} onClick={() => setFilter("status", status)}
              className={`rounded-xl border p-3 text-left text-sm font-medium shadow-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 sm:p-4 ${filters.status === status ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"}`}>
              <span className="mb-1 block text-2xl font-bold tabular-nums">{loading && rows.length === 0 ? "–" : count}</span>
              {label}
            </button>
          ))}
        </div>
        <section aria-labelledby="slip-filters" className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 id="slip-filters" className="font-semibold text-slate-900">Filter reservations</h2>
            <button type="button" className={actionStyle} disabled={!filtersChanged} onClick={() => setFilters(defaultFilters)}>Reset filters</button>
          </div>
          <div className="grid gap-4 text-sm font-medium text-slate-700 sm:grid-cols-2 lg:grid-cols-5">
            <label className="lg:col-span-2">
              Search reservations
              <span className="relative block">
                <Search size={16} aria-hidden="true" className="pointer-events-none absolute bottom-3 left-3 text-slate-500" />
                <input type="search" className={`${fieldStyle} pl-9`} placeholder="Name, phone or reference" value={filters.query}
                  onChange={event => setFilter("query", event.target.value)} />
              </span>
            </label>
            <label>
              Payment slip
              <select className={fieldStyle} value={filters.slip} onChange={event => setFilter("slip", event.target.value)}>
                <option value="all">Any slip status</option>
                <option value="attached">Slip attached</option>
                <option value="missing">No slip attached</option>
              </select>
            </label>
            <label>
              Confirmation SMS
              <select className={fieldStyle} value={filters.sms} onChange={event => setFilter("sms", event.target.value)}>
                <option value="all">Any SMS status</option>
                <option value="sent">Sent</option>
                <option value="unconfirmed">Delivery unconfirmed</option>
              </select>
            </label>
            <label>
              Sort by
              <select className={fieldStyle} value={filters.sort} onChange={event => setFilter("sort", event.target.value)}>
                <option value="default">Default order</option>
                <option value="deadline">Earliest hold deadline</option>
                <option value="amount">Highest payment amount</option>
                <option value="customer">Customer name</option>
              </select>
            </label>
            <label>
              Minimum amount (Rs.)
              <input type="number" min="0" step="any" className={fieldStyle} placeholder="Any" value={filters.minAmount}
                onChange={event => setFilter("minAmount", event.target.value)} />
            </label>
            <label>
              Maximum amount (Rs.)
              <input type="number" min="0" step="any" className={fieldStyle} placeholder="Any" value={filters.maxAmount}
                aria-invalid={invalidRange} aria-describedby={invalidRange ? "slip-amount-error" : undefined}
                onChange={event => setFilter("maxAmount", event.target.value)} />
            </label>
          </div>
          {invalidRange && <p id="slip-amount-error" role="alert" className="mt-3 text-sm text-red-700">Maximum amount must be at least the minimum amount.</p>}
        </section>
        <section aria-labelledby="cashier-slip-title">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="cashier-slip-title" className="text-lg font-semibold text-slate-900">Reservations</h2>
              {!loading && !error && <p role="status" className="text-sm text-slate-600">Showing {visible.length} of {rows.length}</p>}
            </div>
            <button type="button" onClick={() => setReload(value => value + 1)} disabled={loading}
              className={`${actionStyle} inline-flex items-center gap-2 bg-white hover:bg-slate-50`}>
              <RefreshCw size={15} aria-hidden="true" /> Refresh
            </button>
          </div>
          {error && <p role="alert" className="mb-3 text-sm text-red-700">{error}</p>}
          {loading && <p role="status" className="mb-3 text-sm text-gray-600">Loading payment slip holds…</p>}
          {!loading && !error && visible.length === 0 && (
            <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">
              {rows.length === 0 ? "No recent payment slip holds." : "No reservations match your filters."}
            </p>
          )}
          <div className="grid items-start gap-4 lg:grid-cols-2">
            {visible.map(({ row, status }) => <SlipCard key={row.reference} row={row} status={status} now={now} onUpdate={update} />)}
          </div>
        </section>
      </div>
    </main>
  );
}

function SlipCard({ row, status, now, onUpdate }: { row: CashierSlipReservation; status: HoldStatus; now: number; onUpdate: (row: CashierSlipReservation) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const approvalDialog = useRef<HTMLDialogElement>(null);
  const approvalRevision = useRef<string | null>(null);
  const due = new Date(row.paymentDueUtc);
  const remaining = Math.max(0, Math.floor((due.getTime() - now) / 60_000));
  const hours = Math.floor(remaining / 60);
  const minutes = remaining % 60;
  const timeLeft = hours > 0
    ? `${hours} ${hours === 1 ? "hour" : "hours"}${minutes ? ` ${minutes} min` : ""} left`
    : remaining > 0 ? `${remaining} min left` : "Less than 1 min left";
  const active = status === "awaiting_slip" || status === "ready";

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try { await action(); }
    catch (reason) { setError(bookingError(reason)); }
    finally { setBusy(false); }
  }

  async function upload() {
    if (!file) return;
    if (file.size < 1 || file.size > 5 * 1024 * 1024) {
      setError("Choose a PDF, PNG or JPEG payment slip up to 5 MB.");
      return;
    }
    await run(async () => {
      onUpdate(await uploadCashierSlip(row.reference, file));
      setFile(null);
      if (input.current) input.current.value = "";
    });
  }

  async function download() {
    await run(async () => {
      const content = await downloadCashierSlip(row.reference);
      const url = URL.createObjectURL(content);
      const link = document.createElement("a");
      const extension = content.type === "image/png" ? "png" : content.type === "image/jpeg" ? "jpg" : "pdf";
      link.href = url;
      link.download = `payment-slip-${row.reference}.${extension}`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }

  function openApproval() {
    if (!row.slipRevision || status !== "ready" || busy) return;
    approvalRevision.current = row.slipRevision;
    approvalDialog.current?.showModal();
  }

  function confirmApproval() {
    const revision = approvalRevision.current;
    approvalDialog.current?.close();
    if (!revision || status !== "ready" || busy) return;
    void run(async () => onUpdate(await approveCashierSlip(row.reference, revision)));
  }

  return (
    <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-gray-900">{row.customerName}</h3>
          <a className="text-sm text-gray-700 underline" href={`tel:${row.phoneNumber}`}>{row.phoneNumber}</a>
        </div>
        <p role="status" className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyles[status]}`}>{statusLabels[status]}</p>
      </div>
      <dl className="my-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 text-sm [&_dd]:font-semibold [&_dd]:text-slate-900">
        <div className="col-span-2 min-w-0"><dt className="text-gray-500">Reference</dt><dd className="break-all">{row.reference}</dd></div>
        <div><dt className="text-gray-500">Held slots</dt><dd>{row.slotCount}</dd></div>
        <div><dt className="text-gray-500">Payment amount</dt><dd>Rs. {row.finalAmount.toLocaleString("en-LK")}</dd></div>
        {status !== "approved" && <div className="col-span-2">
          <dt className="text-gray-500">Hold expires</dt>
          <dd className="flex flex-wrap items-center gap-2">
            <time dateTime={row.paymentDueUtc}>{deadlineFormat.format(due)}</time>
            {active && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">{timeLeft}</span>}
          </dd>
        </div>}
      </dl>
      {active && (
        <div className="mb-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
          <input ref={input} type="file" accept="application/pdf,image/png,image/jpeg" hidden
            disabled={busy} onChange={event => setFile(event.target.files?.[0] ?? null)} />
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" disabled={busy} onClick={() => input.current?.click()}
              aria-label={`Choose file for ${row.customerName}`}
              className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 disabled:cursor-not-allowed disabled:opacity-50">
              <Upload size={17} className="text-amber-300" aria-hidden="true" />
              Choose file
            </button>
            <span aria-live="polite" className="min-w-0 flex-1 break-all text-sm text-gray-700">
              {file?.name ?? "PDF, PNG or JPEG up to 5 MB"}
            </span>
            <button type="button" disabled={!file || busy} className={`${actionStyle} bg-white`} onClick={() => void upload()}>
              {row.slipRevision ? "Replace slip" : "Upload slip"}
            </button>
          </div>
        </div>
      )}
      {row.slipRevision && (
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={busy} className={`${actionStyle} inline-flex items-center gap-2 hover:bg-slate-50`} onClick={() => void download()}>
            <Download size={15} aria-hidden="true" /> Download slip
          </button>
          {status === "ready" && (
            <button type="button" disabled={busy || !!file} className={`${actionStyle} border-amber-700 bg-amber-700 text-white`}
              onClick={openApproval}>
              Approve booking
            </button>
          )}
        </div>
      )}
      {status === "approved" && <p className="mt-2 text-sm text-gray-600">{row.smsSent ? "Confirmation SMS sent." : "Booking confirmed. SMS delivery could not be confirmed."}</p>}
      {busy && <p role="status" className="mt-2 text-sm text-gray-600">Working…</p>}
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
      <dialog ref={approvalDialog} aria-labelledby={`approve-slip-${row.reference}`}
        className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-md overflow-auto rounded-2xl border border-gray-200 bg-white p-0 text-gray-900 shadow-2xl backdrop:bg-slate-900/60">
        <div className="p-5 sm:p-6">
          <h4 id={`approve-slip-${row.reference}`} className="text-lg font-semibold">Approve this booking?</h4>
          <p className="mt-2 text-sm text-gray-600">Approval confirms the held slots and sends the customer an SMS.</p>
          <dl className="mt-4 space-y-2 rounded-xl bg-gray-50 p-4 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-gray-600">Customer</dt><dd className="text-right font-medium">{row.customerName}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-gray-600">Held slots</dt><dd className="font-medium tabular-nums">{row.slotCount}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-gray-600">Payment amount</dt><dd className="font-medium tabular-nums">Rs. {row.finalAmount.toLocaleString("en-LK")}</dd></div>
          </dl>
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <button type="button" autoFocus className={actionStyle} onClick={() => approvalDialog.current?.close()}>Cancel</button>
            <button type="button" disabled={status !== "ready" || busy} onClick={confirmApproval}
              className={`${actionStyle} border-amber-700 bg-amber-700 text-white hover:bg-amber-800`}>
              Confirm approval
            </button>
          </div>
        </div>
      </dialog>
    </article>
  );
}
