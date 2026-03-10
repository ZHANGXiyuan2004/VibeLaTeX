export interface ErrorLocation {
  offset: number;
  line: number;
  column: number;
}

export function parseErrorPosition(message: string): number | null {
  const match = /at position (\d+)/i.exec(message);
  if (!match) {
    return null;
  }

  const parsed = Number(match[1]);
  if (Number.isNaN(parsed)) {
    return null;
  }
  return parsed;
}

export function getErrorLocation(source: string, offset: number | null): ErrorLocation | null {
  if (!offset || offset <= 0) {
    return null;
  }

  const safeOffset = Math.min(Math.max(1, offset), source.length + 1);
  const before = source.slice(0, safeOffset - 1);
  const lines = before.split("\n");
  const line = lines.length;
  const column = (lines.at(-1)?.length ?? 0) + 1;

  return {
    offset: safeOffset,
    line,
    column,
  };
}
