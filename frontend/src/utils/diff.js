// Word-level dynamic diff algorithm for comparative conflict analysis

export function wordDiff(a = '', b = '') {
  const A = a.split(/\s+/).filter(Boolean);
  const B = b.split(/\s+/).filter(Boolean);
  const n = A.length,
    m = B.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const left = [],
    right = [];
  let i = 0,
    j = 0;

  while (i < n && j < m) {
    if (A[i] === B[j]) {
      left.push({ t: A[i], k: 'same' });
      right.push({ t: B[j], k: 'same' });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      left.push({ t: A[i], k: 'del' });
      i++;
    } else {
      right.push({ t: B[j], k: 'add' });
      j++;
    }
  }

  while (i < n) left.push({ t: A[i++], k: 'del' });
  while (j < m) right.push({ t: B[j++], k: 'add' });

  return { left, right };
}

export function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export const pct = (n) => (n == null ? 'n/a' : `${Math.round(n * 100)}%`);
