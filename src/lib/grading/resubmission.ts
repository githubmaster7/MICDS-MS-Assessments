/**
 * Resubmission eligibility.
 *
 * A student may resubmit a standard only if they made a meaningful change
 * since their last submitted attempt:
 *   - at least one self-score (skill, prompt, or Standard 4 rating) differs
 *     from the last attempt, OR
 *   - at least one written answer differs at all (any added, removed, or
 *     edited word) from the last attempt.
 *
 * "Words changed" is measured via a word-level LCS diff: the number of
 * words in the old answer not part of the longest common subsequence, plus
 * the number of words in the new answer not part of it. This counts edits
 * (a changed word costs 2 — one removed, one added) and pure
 * insertions/deletions (cost 1 each), while ignoring whitespace-only
 * differences and simple word reordering within the shared subsequence.
 */

function tokenize(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean)
}

/**
 * Length of the longest common subsequence of two word arrays.
 */
function lcsLength(a: string[], b: string[]): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0))
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1])
    }
  }
  return dp[a.length][b.length]
}

/**
 * Number of words added, removed, or edited between two pieces of text.
 * Whitespace-only differences count as zero.
 */
export function countWordChanges(oldText: string, newText: string): number {
  const oldWords = tokenize(oldText)
  const newWords = tokenize(newText)
  if (oldWords.length === 0 && newWords.length === 0) return 0
  const shared = lcsLength(oldWords, newWords)
  return (oldWords.length - shared) + (newWords.length - shared)
}

/**
 * Returns true if the new answer differs at all (beyond whitespace) from
 * the old one.
 */
export function isRevised(oldText: string, newText: string): boolean {
  return countWordChanges(oldText, newText) > 0
}
