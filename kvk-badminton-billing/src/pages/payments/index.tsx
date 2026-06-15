import { useEffect, useState } from 'react';
import { Banknote, CreditCard, Download, ReceiptText, Search, TrendingUp } from 'lucide-react';
import { getFinancialSummary } from '@/services/financial-api';
import { getPayments } from '@/services/payments-api';

type PaymentRecord = {
  id: string | number;
  member: string;
  amount: number;
  date: string;
  method: string;
};

const formatPaymentDate = (value: string) => {
  if (!value) return 'N/A';

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toISOString().slice(0, 10);
};

const formatPaymentMethod = (value: unknown) => {
  const methodValue = Number(value);

  if (methodValue === 1) return 'Cash';
  if (methodValue === 2) return 'Card';
  if (methodValue === 3) return 'Online';

  const raw = String(value ?? '').trim().toLowerCase();
  if (raw === '1' || raw === 'cash') return 'Cash';
  if (raw === '2' || raw === 'card') return 'Card';
  if (raw === '3' || raw === 'online' || raw === 'paypal') return 'Online';

  return 'Cash';
};

export default function Payments() {
  const today = new Date();
  const defaultDate = today.toISOString().split('T')[0];

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedDate, setSelectedDate] = useState(defaultDate);
  const [searchTerm, setSearchTerm] = useState('');
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [isLoadingPayments, setIsLoadingPayments] = useState(false);
  const [paymentsError, setPaymentsError] = useState('');
  const [financialSummary, setFinancialSummary] = useState({
    totalRevenue: 0,
    cashRevenue: 0,
    creditCardRevenue: 0,
    payPalRevenue: 0,
  });

  useEffect(() => {
    const startDate = `${defaultDate}`;
    const endDate = `${defaultDate}`;

    const loadSummary = async () => {
      try {
        const response = await getFinancialSummary(startDate, endDate);
        const summary = response?.additionalData?.response ?? response?.response ?? response ?? {};

        setFinancialSummary({
          totalRevenue: Number(summary.totalRevenue ?? 0),
          cashRevenue: Number(summary.cashRevenue ?? 0),
          creditCardRevenue: Number(summary.creditCardRevenue ?? 0),
          payPalRevenue: Number(summary.payPalRevenue ?? 0),
        });
      } catch {
        setFinancialSummary({
          totalRevenue: 0,
          cashRevenue: 0,
          creditCardRevenue: 0,
          payPalRevenue: 0,
        });
      }
    };

    loadSummary();
  }, [defaultDate]);

  useEffect(() => {
    const loadPayments = async () => {
      setIsLoadingPayments(true);
      setPaymentsError('');

      const startDate = `${selectedDate} 00:00:00+00`;
      const [year, month, day] = selectedDate.split('-').map(Number);
      const tomorrow = new Date(Date.UTC(year, month - 1, day));
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      const endDate = `${tomorrow.toISOString().slice(0, 10)} 00:00:00+00`;

      try {
        const response = await getPayments(startDate, endDate);
        const rows = response?.additionalData?.response ?? response?.response ?? response ?? [];

        const mappedPayments: PaymentRecord[] = Array.isArray(rows)
          ? rows.map((payment: any, index: number) => ({
              id: payment.id ?? index + 1,
              member: `${payment.firstName ?? payment.memberFirstName ?? ''} ${payment.lastName ?? payment.memberLastName ?? ''}`.trim() || payment.memberName || payment.name || 'Unknown Member',
              amount: Number(payment.amount ?? payment.totalAmount ?? payment.paymentAmount ?? 0),
              date: formatPaymentDate(String(payment.date ?? payment.createdAt ?? payment.paymentDate ?? selectedDate)),
              method: formatPaymentMethod(payment.method ?? payment.paymentMethod ?? payment.paymentType),
            }))
          : [];

        setPayments(mappedPayments);
      } catch {
        setPayments([]);
        setPaymentsError('Failed to load payments for the selected date.');
      } finally {
        setIsLoadingPayments(false);
      }
    };

    loadPayments();
  }, [selectedDate]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm]);

  const normalizedSearchTerm = searchTerm.trim().toLowerCase();
  const filteredPayments = payments.filter((payment) => {
    if (!normalizedSearchTerm) return true;

    return [payment.member, payment.amount.toLocaleString(), payment.method, payment.date]
      .join(' ')
      .toLowerCase()
      .includes(normalizedSearchTerm);
  });

  const total = filteredPayments.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize;
  const pageItems = filteredPayments.slice(start, start + pageSize);
  const formatLkr = (amount: number) => `LKR ${amount.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl md:text-2xl font-semibold text-gray-900">Payments</h1>
              <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-100">
                Today
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1">Search, review and manage payment records</p>
          </div>

          <div className="w-full max-w-md">
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-md px-3 py-2 text-sm shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:border-gray-300">
              <Search size={16} className="text-gray-400" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="w-full outline-none text-sm"
                placeholder="Search by member, amount, method, or date..."
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-3 py-2.5 bg-primary text-white rounded cursor-pointer bg-blue-700 transition-all duration-300 text-sm hover:-translate-y-0.5 hover:shadow-lg hover:bg-blue-800">
              <Download size={14} />
              Export
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-gray-300">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-gray-500">Total revenue</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-gray-900">{formatLkr(financialSummary.totalRevenue)}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <TrendingUp size={20} />
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-500">For the selected day</p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-gray-300">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-gray-500">Online total</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-gray-900">{formatLkr(financialSummary.payPalRevenue)}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <ReceiptText size={20} />
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-500">Online amount</p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-gray-300">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-gray-500">Cash total</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-gray-900">{formatLkr(financialSummary.cashRevenue)}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                <Banknote size={20} />
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-500">Cash payments only</p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-gray-300">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-gray-500">Card total</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-gray-900">{formatLkr(financialSummary.creditCardRevenue)}</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
                <CreditCard size={20} />
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-500">Card payments only</p>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md hover:border-gray-300">
          <div className="px-4 py-2 border-b border-gray-100 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="text-sm text-gray-600">
              Showing payments for <span className="font-medium text-gray-900">{selectedDate}</span>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <label className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md hover:border-gray-300">
                <span className="text-gray-500">Date</span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(event) => {
                    setSelectedDate(event.target.value);
                    setPage(1);
                  }}
                  className="outline-none text-sm text-gray-900"
                />
              </label>
            </div>
          </div>

          <div className="px-4 py-3">
            <div className="overflow-x-auto">
              <table className="w-full table-auto text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-600 border-b border-gray-100">
                    <th className="py-2 px-3">MEMBER</th>
                    <th className="py-2 px-3">AMOUNT</th>
                    <th className="py-2 px-3">DATE</th>
                    <th className="py-2 px-3">METHOD</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoadingPayments ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-sm text-gray-500">Loading payments...</td>
                    </tr>
                  ) : paymentsError ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-sm text-red-600">{paymentsError}</td>
                    </tr>
                  ) : pageItems.map((payment) => (
                    <tr key={payment.id} className="border-b border-gray-100 transition-colors duration-300 hover:bg-gray-50/80">
                      <td className="py-2 px-3 align-top">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-sm font-semibold">
                            {payment.member
                              .split(' ')
                              .map((name) => name[0])
                              .slice(0, 2)
                              .join('')}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">{payment.member}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-2 px-3 align-top font-medium text-gray-900">{formatLkr(payment.amount)}</td>
                      <td className="py-2 px-3 align-top text-gray-700">{payment.date}</td>
                      <td className="py-2 px-3 align-top">
                        <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs">{payment.method}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="px-4 py-3 border-t border-gray-100 bg-white flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Showing {total === 0 ? 0 : start + 1} to {Math.min(start + pageSize, total)} of {total} entries
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-600">Rows:</label>
                <select
                  value={pageSize}
                  onChange={(event) => {
                    setPageSize(Number(event.target.value));
                    setPage(1);
                  }}
                  className="border rounded-md px-2 py-1 text-sm"
                >
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                </select>
              </div>
              <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1} className="px-3 py-1 rounded-md border bg-white text-sm disabled:opacity-50 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-sm hover:bg-gray-50">
                Prev
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }).map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setPage(index + 1)}
                    className={`px-2 py-1 text-sm rounded-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-sm ${page === index + 1 ? 'bg-gray-900 text-white' : 'bg-white border hover:bg-gray-50'}`}
                  >
                    {index + 1}
                  </button>
                ))}
              </div>
              <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages} className="px-3 py-1 rounded-md border bg-white text-sm disabled:opacity-50 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-sm hover:bg-gray-50">
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
