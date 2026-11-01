"use client";

import { useEffect, useState } from "react";
import { clearCurrent } from "@/components/workspace/session";

export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  const [clearing, setClearing] = useState(false);
  useEffect(() => {
    console.error(error);
  }, [error]);
  const message = error instanceof Error && error.message ? error.message : "Something unexpected happened.";
  return (
    <main className="mx-auto max-w-[640px] px-4 py-20">
      <h1 className="display text-[40px]">Something went wrong.</h1>
      <p className="mt-3 text-[15px] text-ink-2">
        GapMap hit an error while showing this page. Your saved analyses are still in this browser. You can try again, or start over with a clean page (this clears only the
        work in progress, not Recent analyses).
      </p>
      <p className="mt-3 rounded-md border border-rule bg-sheet p-3 font-mono text-[12.5px] text-ink-2">{message}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" onClick={() => retry()} className="rounded-md bg-ink px-4 py-2.5 text-[14px] font-semibold text-white">
          Try again
        </button>
        <button
          type="button"
          disabled={clearing}
          onClick={async () => {
            setClearing(true);
            await clearCurrent();
            window.location.reload();
          }}
          className="rounded-md border border-ink bg-sheet px-4 py-2.5 text-[14px] font-semibold"
        >
          Start over
        </button>
      </div>
    </main>
  );
}
