"use client";

export default function ErrorScreen({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-24">
      <div className="w-full max-w-md rounded-xl border border-rose-200 bg-rose-50 p-6">
        <p className="text-xs font-medium uppercase tracking-wider text-rose-700">Something went wrong</p>
        <h1 className="mt-2 text-lg font-semibold text-stone-900">The simulator hit an error it could not recover from.</h1>
        <p className="mt-2 text-sm text-stone-700">Nothing was sent anywhere. Reload the demo to continue; your edits on this page are discarded.</p>
        <button
          type="button"
          onClick={() => reset()}
          className="mt-4 inline-flex h-10 items-center rounded-lg bg-stone-900 px-4 text-sm font-medium text-white hover:bg-stone-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-2"
        >
          Reload the demo
        </button>
      </div>
    </main>
  );
}
