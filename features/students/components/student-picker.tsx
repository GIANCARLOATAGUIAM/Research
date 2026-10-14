import Link from "next/link";

import { DemoBadge, StudentStatusBadge } from "@/components/app/badges";
import { SearchInput } from "@/components/app/list-controls";
import { Button } from "@/components/ui/button";
import { studentName } from "@/lib/format";

import { searchStudents } from "../queries";

// Step 1 of "new visit / incident / appointment / issue": find the student.
// A GET form, so it works without client JavaScript.
export async function StudentPicker({
  path,
  q,
  keep = {},
}: {
  path: string;
  q?: string;
  keep?: Record<string, string | undefined>;
}) {
  const results = q ? await searchStudents(q) : [];
  const extra = Object.entries(keep).filter(([, v]) => v) as [string, string][];
  const hrefFor = (id: string) => `${path}?${new URLSearchParams([...extra, ["student", id]]).toString()}`;

  return (
    <section className="grid gap-4 rounded-lg border bg-card p-4">
      <h2 className="text-sm font-medium">Find the student</h2>
      <form method="get" className="flex flex-wrap items-end gap-3" role="search">
        {extra.map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <SearchInput defaultValue={q} placeholder="Student number or name" label="Student" />
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>

      {q ? (
        results.length ? (
          <ul className="divide-y rounded-lg border">
            {results.map((s) => (
              <li key={s.id}>
                <Link href={hrefFor(s.id)} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50">
                  <span className="font-mono text-xs text-muted-foreground">{s.student_number}</span>
                  <span className="font-medium">{studentName(s)}</span>
                  {s.is_demo ? <DemoBadge /> : null}
                  <StudentStatusBadge status={s.status} />
                  <span className="ml-auto text-xs text-muted-foreground">{s.college}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            No student found. <Link href="/students/new" className="text-primary hover:underline">Add the student first</Link>.
          </p>
        )
      ) : null}
    </section>
  );
}
