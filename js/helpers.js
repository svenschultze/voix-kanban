export const cloneColumns = (cols = []) => cols.map((col) => ({ ...col }));

export const cloneTasks = (list = []) => JSON.parse(JSON.stringify(list));

export const formatMinutes = (minutes = 0) => {
  const total = Math.max(0, Number(minutes) || 0);
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours && mins) return `${hours}h ${mins}m`;
  if (hours) return `${hours}h`;
  return `${mins}m`;
};

export const makeId = (prefix = "item") =>
  `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
