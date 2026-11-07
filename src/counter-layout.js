export function getCounterGrid(counterCount) {
  const count = Math.max(1, counterCount);
  if (count === 3) return { columns: 1, rows: 3 };

  const rows = count >= 4 ? 2 : 1;

  return { columns: Math.ceil(count / rows), rows };
}
