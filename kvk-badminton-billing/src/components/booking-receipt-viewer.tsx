import { useEffect, useRef } from "react";

export default function BookingReceiptViewer({ pdf, filename, onClose }: {
  pdf: Blob;
  filename: string;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const viewer = useRef<HTMLIFrameElement>(null);
  const printLink = useRef<HTMLAnchorElement>(null);
  const downloadLink = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(pdf);
    if (viewer.current) viewer.current.src = objectUrl;
    if (printLink.current) printLink.current.href = objectUrl;
    if (downloadLink.current) downloadLink.current.href = objectUrl;
    return () => URL.revokeObjectURL(objectUrl);
  }, [pdf]);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  return (
    <dialog ref={dialog} aria-labelledby="receipt-title" onClose={onClose}
      className="fixed inset-0 m-auto h-[90vh] w-[95vw] max-w-5xl overflow-hidden rounded-2xl bg-white p-0 shadow-xl backdrop:bg-black/60">
      <div className="flex h-full flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
          <h2 id="receipt-title" className="font-semibold text-slate-900">Booking receipt</h2>
          <div className="flex flex-wrap items-center gap-3 text-sm font-semibold">
            <a ref={printLink} target="_blank" rel="noopener" className="text-slate-700 underline">Open PDF to print</a>
            <a ref={downloadLink} download={filename} className="rounded-lg bg-slate-900 px-3 py-2 text-white">Download PDF</a>
            <button type="button" onClick={() => dialog.current?.close()} className="cursor-pointer rounded-lg border border-slate-200 px-3 py-2">
              Close
            </button>
          </div>
        </header>
        <iframe ref={viewer} title="Booking receipt PDF" className="min-h-0 w-full flex-1" />
      </div>
    </dialog>
  );
}
