interface DiffEntry {
  type: "same" | "add" | "remove";
  value: string;
}

export interface LatexDiffSegment {
  id: string;
  kind: "unchanged" | "changed";
  beforeLines: string[];
  afterLines: string[];
}

export type DiffSegmentDecision = "accepted" | "rejected";

function splitLines(input: string): string[] {
  return input.length === 0 ? [] : input.split("\n");
}

function buildLcsTable(left: string[], right: string[]): number[][] {
  const table: number[][] = Array.from({ length: left.length + 1 }, () =>
    Array.from({ length: right.length + 1 }, () => 0),
  );

  for (let i = left.length - 1; i >= 0; i -= 1) {
    for (let j = right.length - 1; j >= 0; j -= 1) {
      if (left[i] === right[j]) {
        table[i][j] = table[i + 1][j + 1] + 1;
      } else {
        table[i][j] = Math.max(table[i + 1][j], table[i][j + 1]);
      }
    }
  }

  return table;
}

function buildDiff(left: string[], right: string[]): DiffEntry[] {
  const table = buildLcsTable(left, right);
  const entries: DiffEntry[] = [];

  let i = 0;
  let j = 0;

  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) {
      entries.push({ type: "same", value: left[i] });
      i += 1;
      j += 1;
      continue;
    }

    if (table[i + 1][j] >= table[i][j + 1]) {
      entries.push({ type: "remove", value: left[i] });
      i += 1;
      continue;
    }

    entries.push({ type: "add", value: right[j] });
    j += 1;
  }

  while (i < left.length) {
    entries.push({ type: "remove", value: left[i] });
    i += 1;
  }

  while (j < right.length) {
    entries.push({ type: "add", value: right[j] });
    j += 1;
  }

  return entries;
}

export function buildLatexDiff(before: string, after: string): string {
  const entries = buildDiff(splitLines(before), splitLines(after));

  return entries
    .map((entry) => {
      if (entry.type === "same") {
        return `  ${entry.value}`;
      }
      if (entry.type === "add") {
        return `+ ${entry.value}`;
      }
      return `- ${entry.value}`;
    })
    .join("\n");
}

export function buildLatexDiffSegments(before: string, after: string): LatexDiffSegment[] {
  const entries = buildDiff(splitLines(before), splitLines(after));
  const segments: LatexDiffSegment[] = [];

  let sameLines: string[] = [];
  let removedLines: string[] = [];
  let addedLines: string[] = [];
  let index = 0;

  const flushSame = () => {
    if (sameLines.length === 0) {
      return;
    }

    segments.push({
      id: `same-${index}`,
      kind: "unchanged",
      beforeLines: [...sameLines],
      afterLines: [...sameLines],
    });
    index += 1;
    sameLines = [];
  };

  const flushChanged = () => {
    if (removedLines.length === 0 && addedLines.length === 0) {
      return;
    }

    segments.push({
      id: `change-${index}`,
      kind: "changed",
      beforeLines: [...removedLines],
      afterLines: [...addedLines],
    });
    index += 1;
    removedLines = [];
    addedLines = [];
  };

  for (const entry of entries) {
    if (entry.type === "same") {
      flushChanged();
      sameLines.push(entry.value);
      continue;
    }

    flushSame();
    if (entry.type === "remove") {
      removedLines.push(entry.value);
    } else {
      addedLines.push(entry.value);
    }
  }

  flushSame();
  flushChanged();

  return segments;
}

export function applyDiffSegmentDecisions(
  segments: LatexDiffSegment[],
  decisions: Partial<Record<string, DiffSegmentDecision>>,
): string {
  const lines: string[] = [];

  for (const segment of segments) {
    if (segment.kind === "unchanged") {
      lines.push(...segment.afterLines);
      continue;
    }

    const decision = decisions[segment.id];
    if (decision === "accepted") {
      lines.push(...segment.afterLines);
    } else {
      lines.push(...segment.beforeLines);
    }
  }

  return lines.join("\n");
}
