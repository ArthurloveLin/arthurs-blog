// app/page.tsx  (or app/memo/page.tsx)
// ─────────────────────────────────────────────────────────────────────────────
// Memo workspace — the only Page in this slice.
//
// Rendering strategy:
//   • The page shell (layout, sidebar data) is a Server Component.
//   • Interactive state lives in <MemoWorkspace> which is "use client".
//   • Memos would typically be fetched server-side and passed as props.

import { Suspense } from "react";
import { MemoWorkspace } from "@/components/MemoWorkspace";
import { aggregateTags, memosByDay, todayYMD } from "@/lib/utils";
import { SAMPLE_MEMOS } from "@/lib/sample-data"; // replace with real fetch
import type { Memo } from "@/lib/types";

// In production: replace with your data-fetching function.
async function getMemos(): Promise<Memo[]> {
  // e.g. return prisma.memo.findMany({ orderBy: { date: "desc" } });
  return SAMPLE_MEMOS;
}

export default async function MemoPage() {
  const memos  = await getMemos();
  const today  = todayYMD();
  const byDay  = memosByDay(memos);
  const tags   = aggregateTags(memos);

  return (
    <Suspense fallback={null}>
      <MemoWorkspace
        initialMemos={memos}
        today={today}
        byDay={byDay}
        tags={tags}
      />
    </Suspense>
  );
}
