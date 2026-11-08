export function getCounterGrid(counterCount) {
  const count = Math.max(1, counterCount);
  if (count === 3) return { columns: 1, rows: 3 };

  const columns = count === 1 ? 1 : 2;
  return { columns, rows: Math.ceil(count / columns) };
}
