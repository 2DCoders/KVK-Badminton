import { useEffect, useState } from 'react';
import { Banknote, CreditCard, Download, Lock, ReceiptText, TrendingUp, X } from 'lucide-react';
import { getFinancialSummary } from '@/services/financial-api';

export default function Dayend() {
  const today = new Date();
  const defaultDate = today.toISOString().split('T')[0];

  const dayendData = {
    totalRevenue: 89890,
    totalCash: 34900,
    totalCard: 54990,
    totalTransactions: 24,
    cashDiscrepancy: 0,
  };

  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closingNotes, setClosingNotes] = useState('');
  const [prevDayAmount, setPrevDayAmount] = useState(5000);
  const [holdNextDayAmount, setHoldNextDayAmount] = useState('');
  const [actualCashCount, setActualCashCount] = useState('');
  const [cashRemark, setCashRemark] = useState('');
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

  const actualCash = actualCashCount ? parseFloat(actualCashCount.replace(/[^\d.-]/g, '')) : 0;
  const discrepancy = (dayendData.totalCash + prevDayAmount) - actualCash;
  const isDiscrepancyZero = discrepancy === 0;
  const canCloseDay = actualCashCount.trim() !== '' && (isDiscrepancyZero || cashRemark.trim() !== '');

  const handleCloseDay = () => {
    if (!canCloseDay) return;
    setShowCloseModal(false);
    setClosingNotes('');
    setActualCashCount('');
    setCashRemark('');
    setPrevDayAmount(0);
  };

  const formatLkr = (amount: number) => `LKR ${amount.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold text-gray-900">Day End Reconciliation</h1>
            <p className="text-sm text-gray-500 mt-1">Review and close the business day</p>
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

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
          <div className="lg:col-span-2 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all duration-300 hover:shadow-md hover:border-gray-300">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Cash Reconciliation</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-white border border-gray-100">
                <span className="text-sm text-gray-600 font-medium">Coming from Prev Day</span>
                <span className="text-sm font-semibold text-gray-900">{formatLkr(prevDayAmount)}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                <span className="text-sm text-gray-600">Expected Cash Total</span>
                <span className="text-sm font-semibold text-gray-900">{formatLkr(dayendData.totalCash + prevDayAmount)}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border border-gray-200">
                <label className="text-sm text-gray-600">Actual Cash Count *</label>
                <input
                  value={actualCashCount}
                  onChange={(e) => setActualCashCount(e.target.value)}
                  placeholder="LKR 0.00"
                  className="w-32 px-3 py-2 text-right text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                />
              </div>
              <div className={`flex items-center justify-between p-3 rounded-lg border font-medium ${isDiscrepancyZero ? 'border-emerald-100 text-emerald-700' : 'border-red-200 text-red-600'}`}>
                <span className="text-sm">Discrepancy</span>
                <span className="text-sm">{formatLkr(Math.abs(discrepancy))}</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl lg:col-span-2 border border-gray-200 bg-white p-5 shadow-sm transition-all duration-300 hover:shadow-md hover:border-gray-300">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Closing Actions</h3>
            <div className="space-y-4">
              {!isDiscrepancyZero && (
                <div className="flex flex-col gap-2 p-3 rounded-lg border border-gray-100 bg-white">
                  <label className="text-sm text-gray-700 font-medium">Remark (Required) *</label>
                  <textarea
                    value={cashRemark}
                    onChange={(e) => setCashRemark(e.target.value)}
                    placeholder="Please provide reason for cash discrepancy..."
                    className="w-full px-3 py-2 text-sm border border-gray-100 rounded-lg outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500 bg-white"
                    rows={2}
                  />
                </div>
              )}
              <div className="flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-white">
                <label className="text-sm text-gray-700 font-medium">Hold for Next Day</label>
                <input
                  type="text"
                  value={holdNextDayAmount}
                  onChange={(e) => setHoldNextDayAmount(e.target.value)}
                  placeholder="LKR 0.00"
                  className="w-24 px-3 py-2 text-right text-sm border border-gray-100 rounded-lg outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500 bg-white"
                />
              </div>
              <button
                onClick={() => setShowCloseModal(true)}
                disabled={!actualCashCount.trim()}
                className={`w-full flex items-center justify-center gap-2 px-4 py-3 text-white rounded-lg font-medium transition-all duration-300 ${!actualCashCount.trim()
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-700 hover:-translate-y-0.5 hover:shadow-lg'
                  }`}
              >
                <Lock size={16} />
                Close Day
              </button>
              <button className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-gray-200 text-gray-700 rounded-lg font-medium transition-all duration-300 hover:bg-gray-50 hover:-translate-y-0.5 hover:shadow-sm">
                <Download size={16} />
                Print Report
              </button>
            </div>
          </div>
        </div>
      </div>

      {showCloseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Close Business Day</h2>
              <button onClick={() => setShowCloseModal(false)} className="rounded-full p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900">
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                <input type="date" value={defaultDate} disabled className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Closing Notes (Optional)</label>
                <textarea
                  value={closingNotes}
                  onChange={(e) => setClosingNotes(e.target.value)}
                  placeholder="Add any notes about today's operations..."
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                  rows={4}
                />
              </div>
              <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3">
                <p className="text-xs text-emerald-700">
                  <span className="font-semibold">Summary:</span> Total Revenue {formatLkr(dayendData.totalRevenue)} • {dayendData.totalTransactions} transactions
                </p>
              </div>
            </div>

            <div className="border-t border-gray-200 px-6 py-4 flex items-center gap-3 justify-end">
              <button onClick={() => setShowCloseModal(false)} className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 font-medium transition-all duration-300 hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={handleCloseDay}
                disabled={!canCloseDay}
                className={`px-4 py-2 rounded-lg text-white font-medium transition-all duration-300 ${!canCloseDay
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-700 hover:-translate-y-0.5 hover:shadow-lg'
                  }`}
              >
                Close Day
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}