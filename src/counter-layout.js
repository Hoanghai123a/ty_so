export function getCounterGrid(counterCount) {
  const count = Math.max(1, counterCount);
  const rows = count >= 4 ? 2 : 1;

  return { columns: Math.ceil(count / rows), rows };
}
