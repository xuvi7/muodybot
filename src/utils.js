export function readNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function readCsv(value, fallback) {
  if (!value) {
    return fallback;
  }

  const values = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  return values.length > 0 ? values : fallback;
}

export function readBoolean(value, fallback) {
  if (value === undefined) {
    return fallback;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

export function pick(items) {
  return items[Math.floor(Math.random() * items.length)];
}

export function weightedPick(items) {
  const totalWeight = items.reduce((sum, item) => sum + getWeight(item), 0);

  if (totalWeight <= 0) {
    return pick(items);
  }

  let target = Math.random() * totalWeight;

  for (const item of items) {
    target -= getWeight(item);

    if (target <= 0) {
      return item;
    }
  }

  return items[items.length - 1];
}

export function flattenValues(value) {
  if (Array.isArray(value)) {
    return value.flatMap(flattenValues);
  }

  if (value && typeof value === 'object') {
    return [value, ...Object.values(value).flatMap(flattenValues)];
  }

  return [];
}

export function getRandomMilliseconds(minValue, maxValue, multiplier) {
  const min = Math.max(0, Math.min(minValue, maxValue));
  const max = Math.max(0, Math.max(minValue, maxValue));

  if (max <= min) {
    return Math.round(min * multiplier);
  }

  return Math.round((min + Math.random() * (max - min)) * multiplier);
}

export function sleep(delayMs, signal) {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }

    let timeout;
    const finish = () => {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', onAbort);
      resolve();
    };
    const onAbort = () => finish();

    timeout = setTimeout(finish, delayMs);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export function formatDuration(durationMs) {
  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes === 0) {
    return `${seconds}s`;
  }

  return seconds === 0 ? `${minutes}m` : `${minutes}m ${seconds}s`;
}

export function addDays(date, days) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export function pad2(value) {
  return String(value).padStart(2, '0');
}

function getWeight(item) {
  const weight = Number(item?.weight);
  return Number.isFinite(weight) && weight > 0 ? weight : 1;
}
