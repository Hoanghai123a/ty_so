export function getCounterGrid(counterCount) {
  const count = Math.max(1, counterCount);
  const columns = count < 5 ? 1 : 2;
  return { columns, rows: Math.ceil(count / columns) };
}
