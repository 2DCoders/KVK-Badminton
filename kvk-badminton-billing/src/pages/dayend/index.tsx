import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  AlertTriangle,
  Banknote,
  CalendarCheck2,
  Check,
  CheckCircle2,
  CreditCard,
  Download,
  Loader2,
  Lock,
  ReceiptText,
  RefreshCcw,
  ShieldAlert,
  TrendingUp,
  Vault,
  X,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { getFinancialSummary } from "@/services/financial-api";
import { getDayEndData, performDayEnd } from "@/services/dayend-api";

/* =========================================================
   Types
   ========================================================= */

type FinancialSummary = {
  totalRevenue: number;
  cashRevenue: number;
  creditCardRevenue: number;
  payPalRevenue: number;
  totalTransactions: number;
};

type DayEndRecord = {
  currentDate: string;
  cashFromPrevDay?: number;
  [key: string]: any;
};

type AlertState = {
  visible: boolean;
  variant: "success" | "error" | "warning" | "info";
  title: string;
  description: string;
};

/* =========================================================
   Day End Component
   ========================================================= */

export default function Dayend() {
  const today = new Date();
  const defaultDate = today.toISOString().split("T")[0];

  const [dayEndData, setDayEndData] = useState<DayEndRecord | null>(null);
  const [prevDayAmount, setPrevDayAmount] = useState(0);

  const [financialSummary, setFinancialSummary] =
    useState<FinancialSummary>({
      totalRevenue: 0,
      cashRevenue: 0,
      creditCardRevenue: 0,
      payPalRevenue: 0,
      totalTransactions: 0,
    });

  const [actualCashCount, setActualCashCount] = useState("");
  const [holdNextDayAmount, setHoldNextDayAmount] = useState("");
  const [cashRemark, setCashRemark] = useState("");
  const [closingNotes, setClosingNotes] = useState("");

  const [isPageLocked, setIsPageLocked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const [pageAlert, setPageAlert] = useState<AlertState>({
    visible: false,
    variant: "success",
    title: "",
    description: "",
  });

  /* =========================================================
     Auto-dismiss floating alerts after 3 seconds
     ========================================================= */

  useEffect(() => {
    if (!pageAlert.visible) return;

    const timer = setTimeout(() => {
      setPageAlert((prev) => ({
        ...prev,
        visible: false,
      }));
    }, 3000);

    return () => clearTimeout(timer);
  }, [pageAlert.visible]);

  /* =========================================================
     Formatting Helpers
     ========================================================= */

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("en-LK", {
      style: "currency",
      currency: "LKR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);

  const formatShortPrice = (price: number) =>
    new Intl.NumberFormat("en-LK", {
      style: "currency",
      currency: "LKR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);

  const formatDateDisplay = (dateString?: string) => {
    if (!dateString) return "Today";

    try {
      return new Date(dateString).toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  /* =========================================================
     Calculations & Reconciliation Math
     ========================================================= */

  const actualCash = useMemo(() => {
    if (!actualCashCount.trim()) return 0;

    const parsed = parseFloat(
      actualCashCount.replace(/[^\d.-]/g, ""),
    );

    return Number.isNaN(parsed) ? 0 : parsed;
  }, [actualCashCount]);

  const holdAmount = useMemo(() => {
    if (!holdNextDayAmount.trim()) return 0;

    const parsed = parseFloat(
      holdNextDayAmount.replace(/[^\d.-]/g, ""),
    );

    return Number.isNaN(parsed) ? 0 : parsed;
  }, [holdNextDayAmount]);

  const expectedCashTotal = useMemo(
    () => financialSummary.cashRevenue + prevDayAmount,
    [financialSummary.cashRevenue, prevDayAmount],
  );

  // discrepancy = Expected - Actual
  // positive = shortage
  // negative = surplus
  // zero = balanced
  const discrepancy = useMemo(
    () => expectedCashTotal - actualCash,
    [expectedCashTotal, actualCash],
  );

  const isDiscrepancyZero = useMemo(
    () => Math.abs(discrepancy) < 0.01,
    [discrepancy],
  );

  const isHoldAmountValid = useMemo(() => {
    if (!holdNextDayAmount.trim()) return true;

    return holdAmount <= actualCash;
  }, [holdAmount, actualCash, holdNextDayAmount]);

  const netBankDeposit = useMemo(
    () => Math.max(0, actualCash - holdAmount),
    [actualCash, holdAmount],
  );

  const isCountEntered = actualCashCount.trim() !== "";

  const canCloseDay = useMemo(() => {
    return (
      isCountEntered &&
      !isPageLocked &&
      isHoldAmountValid &&
      (isDiscrepancyZero || cashRemark.trim() !== "")
    );
  }, [
    isCountEntered,
    isPageLocked,
    isHoldAmountValid,
    isDiscrepancyZero,
    cashRemark,
  ]);

  /* =========================================================
     Data Loading
     ========================================================= */

  const loadSummary = async (date: string) => {
    try {
      const startDate = date;

      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const endDate = nextDate.toISOString().split("T")[0];

      const response = await getFinancialSummary(
        startDate,
        endDate,
      );

      const summary =
        response?.additionalData?.response ??
        response?.response ??
        response ??
        {};

      setFinancialSummary({
        totalRevenue: Number(summary.totalRevenue ?? 0),
        cashRevenue: Number(summary.cashRevenue ?? 0),
        creditCardRevenue: Number(
          summary.creditCardRevenue ?? 0,
        ),
        payPalRevenue: Number(summary.payPalRevenue ?? 0),
        totalTransactions: Number(
          summary.totalTransactions ?? 0,
        ),
      });
    } catch (error) {
      console.error(
        "Unable to load financial summary:",
        error,
      );

      setFinancialSummary({
        totalRevenue: 0,
        cashRevenue: 0,
        creditCardRevenue: 0,
        payPalRevenue: 0,
        totalTransactions: 0,
      });
    }
  };

  const handleFetchDayEndData = async () => {
    try {
      setIsLoading(true);

      const response = await getDayEndData();

      if (response && response.length > 0) {
        const data = response[0];

        setDayEndData(data);
        setPrevDayAmount(
          Number(data.cashFromPrevDay ?? 0),
        );

        const workingDate =
          data.currentDate?.split("T")[0] || defaultDate;

        await loadSummary(workingDate);

        const currentDate = new Date(data.currentDate);
        const todayDate = new Date();

        currentDate.setHours(0, 0, 0, 0);
        todayDate.setHours(0, 0, 0, 0);

        setIsPageLocked(currentDate > todayDate);
      } else {
        await loadSummary(defaultDate);
      }
    } catch (error) {
      console.error(
        "Failed to fetch day end data:",
        error,
      );

      setPageAlert({
        visible: true,
        variant: "error",
        title: "Unable to load day end data",
        description:
          "An error occurred while loading financial figures.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void handleFetchDayEndData();
  }, []);

  /* =========================================================
     Day End Submission
     ========================================================= */

  const handlePerformDayEnd = async () => {
    if (!dayEndData) return;

    try {
      setIsSubmitting(true);

      const payload = {
        currentDate: dayEndData.currentDate,
        cashFromPrevDay: prevDayAmount,
        expectedCashTotal: expectedCashTotal,
        actualCashCount: actualCash,
        discrepancy: discrepancy,
        remark:
          cashRemark.trim() ||
          closingNotes.trim() ||
          "Balanced day end",
        holdForNextDay: holdAmount,
      };

      await performDayEnd(payload);

      setShowConfirmModal(false);
      setShowSuccessModal(true);

      void handleFetchDayEndData();
    } catch (error: any) {
      console.error("Day end failed:", error);

      setPageAlert({
        visible: true,
        variant: "error",
        title: "Day End Failed",
        description:
          error.response?.data?.message ||
          "An error occurred while performing day end. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleContinueToLogin = () => {
    localStorage.removeItem("cashier");
    localStorage.removeItem("dayEndData");

    window.location.href = "/";
  };

  /* =========================================================
     PDF Summary Report Generator
     ========================================================= */

  const handleGeneratePdf = () => {
    try {
      setIsExportingPdf(true);

      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const primaryColor: [number, number, number] = [
        30,
        58,
        138,
      ];

      const workingDateFormatted = formatDateDisplay(
        dayEndData?.currentDate,
      );

      const printTimestamp =
        new Date().toLocaleString("en-GB");

      /* =====================================================
         Brand Header
         ===================================================== */

      doc.setFillColor(...primaryColor);
      doc.rect(0, 0, 210, 24, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");

      // Changed from Car Wash to KVK Badminton
      doc.text("KVK BADMINTON", 14, 11);

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");

      doc.text(
        "Daily Business Day End & Cash Reconciliation Report",
        14,
        18,
      );

      doc.text(
        `Generated: ${printTimestamp}`,
        196,
        18,
        {
          align: "right",
        },
      );

      /* =====================================================
         Meta Information Box
         ===================================================== */

      doc.setTextColor(51, 65, 85);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");

      doc.text("REPORT OVERVIEW", 14, 34);

      autoTable(doc, {
        startY: 37,
        theme: "grid",

        head: [
          [
            "Working Business Date",
            "Total Transactions",
            "Total Daily Revenue",
            "Reconciliation Status",
          ],
        ],

        body: [
          [
            workingDateFormatted,
            `${financialSummary.totalTransactions} orders`,
            formatPrice(financialSummary.totalRevenue),
            isDiscrepancyZero
              ? "BALANCED"
              : discrepancy > 0
                ? `SHORTAGE: ${formatPrice(discrepancy)}`
                : `SURPLUS: ${formatPrice(
                    Math.abs(discrepancy),
                  )}`,
          ],
        ],

        headStyles: {
          fillColor: [241, 245, 249],
          textColor: [15, 23, 42],
          fontStyle: "bold",
          fontSize: 8.5,
        },

        bodyStyles: {
          textColor: [30, 41, 59],
          fontSize: 8.5,
        },
      });

      /* =====================================================
         Section 1: Revenue by Payment Method
         ===================================================== */

      const finalY1 =
        (doc as any).lastAutoTable?.finalY || 55;

      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(51, 65, 85);

      doc.text(
        "1. REVENUE BY PAYMENT METHOD",
        14,
        finalY1 + 10,
      );

      autoTable(doc, {
        startY: finalY1 + 13,
        theme: "striped",

        head: [
          [
            "Payment Method",
            "Amount (LKR)",
            "Contribution %",
          ],
        ],

        body: [
          [
            "Cash Payments",
            formatPrice(
              financialSummary.cashRevenue,
            ),
            financialSummary.totalRevenue > 0
              ? `${Math.round(
                  (financialSummary.cashRevenue /
                    financialSummary.totalRevenue) *
                    100,
                )}%`
              : "0%",
          ],

          [
            "Credit / Debit Card",
            formatPrice(
              financialSummary.creditCardRevenue,
            ),
            financialSummary.totalRevenue > 0
              ? `${Math.round(
                  (financialSummary.creditCardRevenue /
                    financialSummary.totalRevenue) *
                    100,
                )}%`
              : "0%",
          ],

          [
            "Online / PayPal Payments",
            formatPrice(
              financialSummary.payPalRevenue,
            ),
            financialSummary.totalRevenue > 0
              ? `${Math.round(
                  (financialSummary.payPalRevenue /
                    financialSummary.totalRevenue) *
                    100,
                )}%`
              : "0%",
          ],

          [
            "TOTAL REVENUE",
            formatPrice(
              financialSummary.totalRevenue,
            ),
            "100%",
          ],
        ],

        headStyles: {
          fillColor: [30, 58, 138],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 8.5,
        },

        footStyles: {
          fontStyle: "bold",
        },
      });

      /* =====================================================
         Section 2: Cash Reconciliation Breakdown
         ===================================================== */

      const finalY2 =
        (doc as any).lastAutoTable?.finalY || 110;

      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(51, 65, 85);

      doc.text(
        "2. CASH DRAWER RECONCILIATION BREAKDOWN",
        14,
        finalY2 + 10,
      );

      autoTable(doc, {
        startY: finalY2 + 13,
        theme: "grid",

        head: [
          [
            "Reconciliation Item",
            "Amount (LKR)",
            "Audit Description",
          ],
        ],

        body: [
          [
            "Opening Cash (From Previous Day)",
            formatPrice(prevDayAmount),
            "Carried forward opening drawer float",
          ],

          [
            "Today's Cash Sales Revenue",
            formatPrice(
              financialSummary.cashRevenue,
            ),
            "Total physical cash received today",
          ],

          [
            "Total Expected Cash in Drawer",
            formatPrice(expectedCashTotal),
            "Opening Float + Today's Cash Sales",
          ],

          [
            "Actual Physical Cash Counted",
            formatPrice(actualCash),
            "Verified drawer count entered by cashier",
          ],

          [
            "Reconciliation Discrepancy",
            formatPrice(Math.abs(discrepancy)),
            isDiscrepancyZero
              ? "Matched perfectly (0.00)"
              : discrepancy > 0
                ? "CASH SHORTAGE (Missing cash in drawer)"
                : "CASH SURPLUS (Excess cash in drawer)",
          ],
        ],

        headStyles: {
          fillColor: [241, 245, 249],
          textColor: [15, 23, 42],
          fontStyle: "bold",
          fontSize: 8.5,
        },
      });

      /* =====================================================
         Section 3: Float & Final Settlement
         ===================================================== */

      const finalY3 =
        (doc as any).lastAutoTable?.finalY || 170;

      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(51, 65, 85);

      doc.text(
        "3. CASH SETTLEMENT & SAFE DEPOSIT",
        14,
        finalY3 + 10,
      );

      autoTable(doc, {
        startY: finalY3 + 13,
        theme: "grid",

        head: [
          [
            "Settlement Detail",
            "Amount (LKR)",
            "Action",
          ],
        ],

        body: [
          [
            "Physical Cash in Register",
            formatPrice(actualCash),
            "Total counted cash",
          ],

          [
            "Hold Float for Next Day",
            formatPrice(holdAmount),
            "Remains in register drawer for tomorrow's opening float",
          ],

          [
            "Net Cash to Bank / Safe Deposit",
            formatPrice(netBankDeposit),
            "To be securely deposited into bank/safe",
          ],
        ],

        headStyles: {
          fillColor: [30, 58, 138],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          fontSize: 8.5,
        },
      });

      /* =====================================================
         Section 4: Remarks and Signatures
         ===================================================== */

      const finalY4 =
        (doc as any).lastAutoTable?.finalY || 220;

      let notesY = finalY4 + 10;

      if (
        cashRemark.trim() ||
        closingNotes.trim()
      ) {
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(51, 65, 85);

        doc.text(
          "DISCREPANCY REMARKS & OPERATIONAL NOTES:",
          14,
          notesY,
        );

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);

        const remarkText = cashRemark
          ? `Reason: ${cashRemark}`
          : "";

        const notesText = closingNotes
          ? `Notes: ${closingNotes}`
          : "";

        const fullNotes = [
          remarkText,
          notesText,
        ]
          .filter(Boolean)
          .join(" | ");

        doc.text(
          doc.splitTextToSize(fullNotes, 180),
          14,
          notesY + 5,
        );

        notesY += 15;
      }

      /* =====================================================
         Sign-off
         ===================================================== */

      const signY = Math.min(270, notesY + 15);

      doc.setDrawColor(203, 213, 225);

      doc.line(14, signY, 70, signY);
      doc.line(140, signY, 196, signY);

      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);

      doc.text(
        "Prepared By (Cashier Signature)",
        14,
        signY + 5,
      );

      doc.text(
        "Verified By (Manager / Owner)",
        140,
        signY + 5,
      );

      /* =====================================================
         PDF File Name
         ===================================================== */

      const fileNameDate = (
        dayEndData?.currentDate ||
        defaultDate
      ).split("T")[0];

      doc.save(
        `KVK_Badminton_DayEnd_Report_${fileNameDate}.pdf`,
      );

      setPageAlert({
        visible: true,
        variant: "success",
        title: "Report Downloaded",
        description:
          "KVK Badminton day end reconciliation PDF report has been generated successfully.",
      });
    } catch (error) {
      console.error(
        "PDF generation failed:",
        error,
      );

      setPageAlert({
        visible: true,
        variant: "error",
        title: "PDF Export Failed",
        description:
          "Unable to generate the PDF report. Please try again.",
      });
    } finally {
      setIsExportingPdf(false);
    }
  };

  /* =========================================================
     Main Render
     ========================================================= */

  return (
    <main className="min-h-screen bg-slate-50/60">
      {/* Floating Alert Portal */}
      {pageAlert.visible &&
        createPortal(
          <div className="fixed right-4 top-4 z-[99999] w-[calc(100%-2rem)] max-w-md">
            <CustomAlert
              alert={pageAlert}
              onClose={() =>
                setPageAlert((previous) => ({
                  ...previous,
                  visible: false,
                }))
              }
            />
          </div>,
          document.body,
        )}

      {/* Global Loading Spinner Portal */}
      {(isLoading ||
        isSubmitting ||
        isExportingPdf) &&
        createPortal(
          <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-950/60 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-3">
              <div className="h-14 w-14 animate-spin rounded-full border-4 border-white/30 border-t-white" />

              <p className="text-sm font-medium text-white">
                {isSubmitting
                  ? "Finalizing Day End..."
                  : isExportingPdf
                    ? "Generating PDF Report..."
                    : "Loading Day End Data..."}
              </p>
            </div>
          </div>,
          document.body,
        )}

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-600 text-white shadow-sm shadow-amber-900/20">
              <CalendarCheck2 size={22} />
            </div>

            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  Day End Reconciliation
                </h1>

                {dayEndData?.currentDate && (
                  <span className="hidden items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-900 sm:inline-flex">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-600 animate-pulse" />

                    {formatDateDisplay(
                      dayEndData.currentDate,
                    )}
                  </span>
                )}
              </div>

              <p className="text-sm text-slate-500">
                Reconcile cash drawer balances, verify
                daily revenue, and finalize the business
                day.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => window.location.reload()}
              disabled={isLoading}
              className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-amber-900 hover:bg-amber-50 hover:text-amber-700 disabled:opacity-60"
            >
              <RefreshCcw
                size={16}
                className={
                  isLoading ? "animate-spin" : ""
                }
              />

              Refresh
            </button>

            <button
              type="button"
              onClick={handleGeneratePdf}
              disabled={
                isLoading || isExportingPdf
              }
              className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-amber-900 hover:bg-amber-50 hover:text-amber-700 disabled:opacity-60"
            >
              <Download size={16} />

              Print Report
            </button>

            {!isPageLocked && (
              <button
                type="button"
                onClick={() =>
                  setShowConfirmModal(true)
                }
                disabled={
                  !canCloseDay || isSubmitting
                }
                className="inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl bg-amber-900 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                <Lock size={16} />

                Close Business Day
              </button>
            )}
          </div>
        </div>

        {/* Page Locked Warning Banner */}
        {isPageLocked && (
          <div className="mb-6 flex items-start gap-4 rounded-2xl border border-amber-200 bg-amber-50/80 p-4 sm:p-5 shadow-sm">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <Lock size={20} />
            </div>

            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-amber-900">
                Day End Not Available (Future Working
                Date)
              </h3>

              <p className="mt-1 text-sm text-amber-800">
                The current business working date (
                <strong className="font-semibold">
                  {formatDateDisplay(
                    dayEndData?.currentDate,
                  )}
                </strong>
                ) is set to a future date. Day end
                closing is locked until that working
                date arrives.
              </p>
            </div>
          </div>
        )}

        {/* Summary Metric Cards */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            title="Total Revenue"
            value={formatShortPrice(
              financialSummary.totalRevenue,
            )}
            subtitle="Combined daily income"
            icon={<TrendingUp size={20} />}
            iconClassName="bg-amber-50 text-amber-900"
          />

          <SummaryCard
            title="Cash Revenue"
            value={formatShortPrice(
              financialSummary.cashRevenue,
            )}
            subtitle="Cash payments today"
            icon={<Banknote size={20} />}
            iconClassName="bg-amber-50 text-amber-600"
          />

          <SummaryCard
            title="Card Revenue"
            value={formatShortPrice(
              financialSummary.creditCardRevenue,
            )}
            subtitle="Debit & credit cards"
            icon={<CreditCard size={20} />}
            iconClassName="bg-violet-50 text-violet-600"
          />

          <SummaryCard
            title="Total Orders"
            value={financialSummary.totalTransactions.toLocaleString()}
            subtitle="Completed transactions"
            icon={<ReceiptText size={20} />}
            iconClassName="bg-emerald-50 text-emerald-600"
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left Column */}
          <section className="lg:col-span-7 flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/70 p-4 sm:px-6">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-900">
                  <Banknote size={19} />
                </div>

                <div>
                  <h2 className="font-bold text-slate-900">
                    Cash Drawer Reconciliation
                  </h2>

                  <p className="text-xs text-slate-500">
                    Verify physical cash against system
                    recorded transactions
                  </p>
                </div>
              </div>

              {/* Status Badge */}
              <div>
                {!isCountEntered ? (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                    Pending Count
                  </span>
                ) : isDiscrepancyZero ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    <Check size={13} />
                    Balanced
                  </span>
                ) : discrepancy > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
                    <AlertCircle size={13} />
                    Shortage
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
                    <AlertTriangle size={13} />
                    Surplus
                  </span>
                )}
              </div>
            </div>

            <div className="flex-1 p-5 sm:p-6 space-y-6">
              {/* Drawer Figures Breakdown */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <BreakdownCard
                  label="Opening Cash"
                  value={formatPrice(prevDayAmount)}
                  subtext="From previous day"
                />

                <BreakdownCard
                  label="Cash Sales"
                  value={formatPrice(
                    financialSummary.cashRevenue,
                  )}
                  subtext="Today's cash income"
                />

                <BreakdownCard
                  label="Expected in Drawer"
                  value={formatPrice(
                    expectedCashTotal,
                  )}
                  subtext="Opening + Cash Sales"
                  highlight
                />
              </div>

              {/* Physical Cash Input */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 sm:p-5">
                <label className="mb-1.5 flex items-center justify-between text-sm font-semibold text-slate-800">
                  <span>
                    Actual Physical Cash Counted{" "}
                    <span className="text-red-500">
                      *
                    </span>
                  </span>

                  <span className="text-xs font-normal text-slate-500">
                    Count notes and coins in drawer
                  </span>
                </label>

                <div className="relative mt-2">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-sm font-bold text-slate-400">
                    LKR
                  </div>

                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={actualCashCount}
                    onChange={(e) =>
                      setActualCashCount(
                        e.target.value,
                      )
                    }
                    placeholder="0.00"
                    disabled={isPageLocked}
                    className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-14 pr-4 text-right text-lg font-bold text-slate-900 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                  />
                </div>
              </div>

              {/* Dynamic Discrepancy Alert */}
              {isCountEntered && (
                <div
                  className={`rounded-2xl border p-4 transition-all ${
                    isDiscrepancyZero
                      ? "border-emerald-200 bg-emerald-50/70 text-emerald-900"
                      : discrepancy > 0
                        ? "border-rose-200 bg-rose-50/70 text-rose-900"
                        : "border-amber-200 bg-amber-50/70 text-amber-900"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                        isDiscrepancyZero
                          ? "bg-emerald-100 text-emerald-700"
                          : discrepancy > 0
                            ? "bg-rose-100 text-rose-700"
                            : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {isDiscrepancyZero ? (
                        <CheckCircle2 size={18} />
                      ) : discrepancy > 0 ? (
                        <ShieldAlert size={18} />
                      ) : (
                        <AlertTriangle size={18} />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <p className="font-bold text-sm">
                          {isDiscrepancyZero
                            ? "Perfect Match - Drawer is Balanced"
                            : discrepancy > 0
                              ? "Cash Shortage Detected"
                              : "Cash Surplus Detected"}
                        </p>

                        <p className="text-sm font-extrabold">
                          {isDiscrepancyZero
                            ? "0.00"
                            : formatPrice(
                                Math.abs(
                                  discrepancy,
                                ),
                              )}
                        </p>
                      </div>

                      <p className="mt-1 text-xs opacity-90 leading-5">
                        {isDiscrepancyZero
                          ? "The counted cash exactly matches the expected balance. You are ready to close the day."
                          : discrepancy > 0
                            ? `The physical count is less than the expected balance by ${formatPrice(
                                discrepancy,
                              )}. A discrepancy reason is required before closing.`
                            : `The physical count exceeds the expected balance by ${formatPrice(
                                Math.abs(
                                  discrepancy,
                                ),
                              )}. Please provide a discrepancy remark.`}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Discrepancy Remark */}
              {!isDiscrepancyZero &&
                isCountEntered && (
                  <div className="space-y-1.5">
                    <label className="flex items-center justify-between text-sm font-semibold text-slate-800">
                      <span>
                        Discrepancy Reason / Remark{" "}
                        <span className="text-red-500">
                          *
                        </span>
                      </span>

                      <span className="text-xs font-semibold text-rose-600">
                        Required
                      </span>
                    </label>

                    <textarea
                      rows={3}
                      value={cashRemark}
                      onChange={(e) =>
                        setCashRemark(
                          e.target.value,
                        )
                      }
                      placeholder="Provide an explanation for the cash shortage or surplus..."
                      disabled={isPageLocked}
                      className="w-full resize-none rounded-xl border border-rose-300 bg-white px-3.5 py-3 text-sm outline-none transition focus:border-rose-500 focus:ring-4 focus:ring-rose-100"
                    />

                    {!cashRemark.trim() && (
                      <p className="text-xs font-medium text-rose-600">
                        Please enter the reason for
                        the cash discrepancy to
                        enable day closing.
                      </p>
                    )}
                  </div>
                )}
            </div>
          </section>

          {/* Right Column */}
          <section className="lg:col-span-5 flex flex-col gap-6">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="flex items-center gap-2.5 border-b border-slate-200 bg-slate-50/70 p-4 sm:px-6">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100 text-amber-900">
                  <Vault size={19} />
                </div>

                <div>
                  <h2 className="font-bold text-slate-900">
                    Float & Final Settlement
                  </h2>

                  <p className="text-xs text-slate-500">
                    Configure opening float for tomorrow
                    and review deposit
                  </p>
                </div>
              </div>

              <div className="p-5 sm:p-6 space-y-5">
                {/* Hold for Next Day */}
                <div>
                  <label className="mb-1.5 flex items-center justify-between text-sm font-semibold text-slate-800">
                    <span>
                      Hold for Next Day (Opening Float)
                    </span>

                    <span className="text-xs text-slate-500">
                      Optional
                    </span>
                  </label>

                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-sm font-bold text-slate-400">
                      LKR
                    </div>

                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={holdNextDayAmount}
                      onChange={(e) =>
                        setHoldNextDayAmount(
                          e.target.value,
                        )
                      }
                      placeholder="0.00"
                      disabled={isPageLocked}
                      className={`h-11 w-full rounded-xl border pl-14 pr-4 text-right text-sm font-semibold outline-none transition focus:ring-4 ${
                        !isHoldAmountValid
                          ? "border-red-400 bg-white focus:border-red-500 focus:ring-red-100"
                          : "border-slate-200 bg-white focus:border-amber-500 focus:ring-amber-100"
                      }`}
                    />
                  </div>

                  {!isHoldAmountValid && (
                    <p className="mt-1.5 text-xs font-medium text-red-600">
                      Hold amount cannot exceed
                      actual counted cash (
                      {formatPrice(actualCash)}).
                    </p>
                  )}

                  <p className="mt-1 text-xs text-slate-500">
                    Amount left in the drawer for
                    tomorrow's starting float.
                  </p>
                </div>

                {/* Net Safe Deposit */}
                <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-amber-900">
                        Net Cash to Safe / Bank
                      </p>

                      <p className="text-xs text-slate-500 mt-0.5">
                        Actual Count minus Tomorrow's
                        Float
                      </p>
                    </div>

                    <p className="text-lg font-bold text-amber-900">
                      {formatPrice(netBankDeposit)}
                    </p>
                  </div>
                </div>

                {/* Closing Notes */}
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-800">
                    Closing Notes{" "}
                    <span className="text-xs font-normal text-slate-500">
                      (Optional)
                    </span>
                  </label>

                  <textarea
                    rows={3}
                    value={closingNotes}
                    onChange={(e) =>
                      setClosingNotes(
                        e.target.value,
                      )
                    }
                    placeholder="Add any additional shift or management notes..."
                    disabled={isPageLocked}
                    className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-100 disabled:bg-slate-100"
                  />
                </div>

                {/* Action Buttons */}
                <div className="space-y-2.5 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() =>
                      setShowConfirmModal(true)
                    }
                    disabled={
                      !canCloseDay || isSubmitting
                    }
                    className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-amber-900 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    <Lock size={17} />

                    Close Business Day
                  </button>

                  <button
                    type="button"
                    onClick={handleGeneratePdf}
                    disabled={
                      isLoading || isExportingPdf
                    }
                    className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-amber-900 hover:bg-amber-50 hover:text-amber-700 disabled:opacity-60"
                  >
                    <Download size={17} />

                    Download Summary Report
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <CloseDayConfirmModal
          workingDate={
            dayEndData?.currentDate || defaultDate
          }
          totalRevenue={
            financialSummary.totalRevenue
          }
          totalTransactions={
            financialSummary.totalTransactions
          }
          prevDayAmount={prevDayAmount}
          cashRevenue={
            financialSummary.cashRevenue
          }
          expectedCashTotal={expectedCashTotal}
          actualCash={actualCash}
          discrepancy={discrepancy}
          isDiscrepancyZero={
            isDiscrepancyZero
          }
          cashRemark={cashRemark}
          holdAmount={holdAmount}
          netBankDeposit={netBankDeposit}
          closingNotes={closingNotes}
          isSubmitting={isSubmitting}
          formatPrice={formatPrice}
          formatDateDisplay={formatDateDisplay}
          onClose={() =>
            setShowConfirmModal(false)
          }
          onConfirm={() =>
            void handlePerformDayEnd()
          }
        />
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <DayEndSuccessModal
          workingDate={dayEndData?.currentDate.toString()}
          totalRevenue={
            financialSummary.totalRevenue
          }
          actualCash={actualCash}
          formatPrice={formatPrice}
          formatDateDisplay={formatDateDisplay}
          onContinue={handleContinueToLogin}
        />
      )}
    </main>
  );
}

/* =========================================================
   Summary Card
   ========================================================= */

function SummaryCard({
  title,
  value,
  subtitle,
  icon,
  iconClassName,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: ReactNode;
  iconClassName: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconClassName}`}
      >
        {icon}
      </div>

      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-500">
          {title}
        </p>

        <p className="mt-0.5 text-2xl font-bold text-slate-900 truncate">
          {value}
        </p>

        {subtitle && (
          <p className="text-xs text-slate-400 mt-0.5">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}

/* =========================================================
   Breakdown Card
   ========================================================= */

function BreakdownCard({
  label,
  value,
  subtext,
  highlight = false,
}: {
  label: string;
  value: string;
  subtext: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 transition ${
        highlight
          ? "border-amber-200 bg-amber-50/70"
          : "border-slate-200 bg-slate-50/60"
      }`}
    >
      <p
        className={`text-xs font-semibold ${
          highlight
            ? "text-amber-900"
            : "text-slate-500"
        }`}
      >
        {label}
      </p>

      <p
        className={`mt-1.5 text-lg font-bold truncate ${
          highlight
            ? "text-amber-950"
            : "text-slate-900"
        }`}
      >
        {value}
      </p>

      <p className="mt-1 text-[11px] text-slate-500">
        {subtext}
      </p>
    </div>
  );
}

/* =========================================================
   Custom Alert
   ========================================================= */

function CustomAlert({
  alert,
  onClose,
}: {
  alert: AlertState;
  onClose: () => void;
}) {
  const styles = {
    success:
      "border-emerald-200 bg-emerald-50 text-emerald-800",
    error:
      "border-red-200 bg-red-50 text-red-800",
    warning:
      "border-amber-200 bg-amber-50 text-amber-800",
    info:
      "border-amber-200 bg-amber-50 text-amber-800",
  };

  return (
    <div
      className={`flex items-start gap-3 rounded-2xl border p-4 shadow-lg ${styles[alert.variant]}`}
    >
      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />

      <div className="min-w-0 flex-1">
        <p className="font-semibold">
          {alert.title}
        </p>

        <p className="mt-1 text-sm opacity-80">
          {alert.description}
        </p>
      </div>

      <button
        type="button"
        onClick={onClose}
        className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-500 hover:bg-black/5"
      >
        <X size={16} />
      </button>
    </div>
  );
}

/* =========================================================
   Close Day Confirmation Modal
   ========================================================= */

function CloseDayConfirmModal({
  workingDate,
  totalRevenue,
  totalTransactions,
  expectedCashTotal,
  actualCash,
  discrepancy,
  isDiscrepancyZero,
  cashRemark,
  holdAmount,
  netBankDeposit,
  closingNotes,
  isSubmitting,
  formatPrice,
  formatDateDisplay,
  onClose,
  onConfirm,
}: {
  workingDate: string;
  totalRevenue: number;
  totalTransactions: number;
  prevDayAmount: number;
  cashRevenue: number;
  expectedCashTotal: number;
  actualCash: number;
  discrepancy: number;
  isDiscrepancyZero: boolean;
  cashRemark: string;
  holdAmount: number;
  netBankDeposit: number;
  closingNotes: string;
  isSubmitting: boolean;
  formatPrice: (price: number) => string;
  formatDateDisplay: (date: string) => string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget &&
          !isSubmitting
        ) {
          onClose();
        }
      }}
    >
      <div className="flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-900 text-white">
              <Lock size={20} />
            </div>

            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Confirm Business Day End
              </h2>

              <p className="text-sm text-slate-500">
                Review reconciliation summary before
                locking the working day.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Content */}
        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          {/* Summary */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">
                Working Date:
              </span>

              <span className="font-bold text-slate-900">
                {formatDateDisplay(workingDate)}
              </span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">
                Total Day Revenue:
              </span>

              <span className="font-bold text-slate-900">
                {formatPrice(totalRevenue)} (
                {totalTransactions} orders)
              </span>
            </div>

            <div className="h-px bg-slate-200" />

            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">
                Expected Drawer Cash:
              </span>

              <span className="font-semibold text-slate-800">
                {formatPrice(expectedCashTotal)}
              </span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">
                Actual Counted Cash:
              </span>

              <span className="font-bold text-slate-900">
                {formatPrice(actualCash)}
              </span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">
                Reconciliation Discrepancy:
              </span>

              <span
                className={`font-bold ${
                  isDiscrepancyZero
                    ? "text-emerald-700"
                    : discrepancy > 0
                      ? "text-rose-600"
                      : "text-amber-600"
                }`}
              >
                {isDiscrepancyZero
                  ? "0.00 (Balanced)"
                  : discrepancy > 0
                    ? `-${formatPrice(
                        discrepancy,
                      )} (Shortage)`
                    : `+${formatPrice(
                        Math.abs(discrepancy),
                      )} (Surplus)`}
              </span>
            </div>

            <div className="h-px bg-slate-200" />

            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">
                Hold for Tomorrow's Float:
              </span>

              <span className="font-semibold text-slate-800">
                {formatPrice(holdAmount)}
              </span>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="font-bold text-amber-900">
                Net Safe / Bank Deposit:
              </span>

              <span className="text-base font-extrabold text-amber-900">
                {formatPrice(netBankDeposit)}
              </span>
            </div>
          </div>

          {/* Discrepancy Reason */}
          {cashRemark && (
            <div className="rounded-xl border border-slate-200 bg-white p-3.5">
              <p className="text-xs font-semibold text-slate-500">
                Discrepancy Reason:
              </p>

              <p className="mt-1 text-sm text-slate-800">
                {cashRemark}
              </p>
            </div>
          )}

          {/* Closing Notes */}
          {closingNotes && (
            <div className="rounded-xl border border-slate-200 bg-white p-3.5">
              <p className="text-xs font-semibold text-slate-500">
                Closing Notes:
              </p>

              <p className="mt-1 text-sm text-slate-800">
                {closingNotes}
              </p>
            </div>
          )}

          {/* Warning Notice */}
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-800 leading-5">
            <strong className="font-semibold">
              Important:
            </strong>{" "}
            Finalizing day end will close operations
            for this working date and advance to the
            next business cycle. This action cannot be
            reverted.
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="h-11 cursor-pointer rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-amber-900 px-5 text-sm font-semibold text-white hover:bg-amber-700 disabled:bg-slate-300"
          >
            {isSubmitting ? (
              <>
                <Loader2
                  size={17}
                  className="animate-spin"
                />
                Closing Day...
              </>
            ) : (
              <>
                <Check size={17} />
                Confirm & Close Day
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* =========================================================
   Day End Success Modal
   ========================================================= */

function DayEndSuccessModal({
  workingDate,
  actualCash,
  formatPrice,
  formatDateDisplay,
  onContinue,
}: {
  workingDate: any;
  totalRevenue: number;
  actualCash: number;
  formatPrice: (price: number) => string;
  formatDateDisplay: (date: string) => string;
  onContinue: () => void;
}) {
  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 sm:p-8 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
          <CheckCircle2 size={36} />
        </div>

        <h2 className="text-2xl font-bold text-slate-900">
          Day End Completed
        </h2>

        <p className="mt-2 text-sm text-slate-500 leading-6">
          Welcome to new day{" "}
          <strong className="text-slate-800">
            {formatDateDisplay(workingDate)}
          </strong>{" "}
          .
        </p>

        <div className="my-5 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-left text-sm space-y-2">
          <div className="flex justify-between">
            <span className="text-slate-500">
              Cash Reconciled:
            </span>

            <span className="font-bold text-emerald-700">
              {formatPrice(actualCash)}
            </span>
          </div>
        </div>

        <p className="text-xs text-slate-400">
          Please sign in again to begin operations for
          the next business day.
        </p>

        <button
          type="button"
          onClick={onContinue}
          className="mt-6 inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-amber-900 px-5 text-sm font-semibold text-white transition hover:bg-amber-700"
        >
          Continue to Login
        </button>
      </div>
    </div>,
    document.body,
  );
}