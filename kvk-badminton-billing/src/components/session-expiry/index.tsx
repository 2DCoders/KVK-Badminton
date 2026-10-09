import { useEffect, useRef, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { LockKeyhole } from "lucide-react";
import {
  getSessionExpired,
  redirectToLogin,
  subscribeToSessionExpiry,
} from "../../services/session-expiry";

export default function SessionExpiryBoundary({ children }: { children: ReactNode }) {
  const expired = useSyncExternalStore(subscribeToSessionExpiry, getSessionExpired, () => false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!expired) return;
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => { dialog?.close(); };
  }, [expired]);

  if (!expired) return children;

  // A native modal stays above page dialogs and traps focus inside this message.
  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="session-expired-title"
      aria-describedby="session-expired-description"
      onCancel={(event) => { event.preventDefault(); redirectToLogin(); }}
      className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl border-0 bg-white p-7 text-center text-slate-900 shadow-2xl backdrop:bg-slate-950/60 backdrop:backdrop-blur-sm"
    >
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-700">
        <LockKeyhole size={26} aria-hidden="true" />
      </div>
      <h2 id="session-expired-title" className="text-xl font-semibold">Session expired</h2>
      <p id="session-expired-description" className="mt-3 text-sm leading-6 text-slate-600">
        Your session has expired or is no longer valid. Please log in again to continue.
      </p>
      <button
        type="button"
        autoFocus
        onClick={redirectToLogin}
        className="mt-6 w-full cursor-pointer rounded-xl bg-amber-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-amber-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
      >
        Go to login
      </button>
    </dialog>
  );
}
