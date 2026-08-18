/**
 * Small, stateless diffing helpers shared by every history/timeline view
 * (teacher regrade history, student resubmission history) so "what exactly
 * changed" is computed identically wherever it's shown, rather than
 * duplicated ad hoc per component.
 */

/** Items present in `after` whose value differs from (or is new relative to) `before`, keyed by id. */
export function diffItems<T>(
  before: T[] | undefined,
  after: T[] | undefined,
  getId: (item: T) => string,
  getValue: (item: T) => number,
): { id: string; item: T; beforeValue: number | undefined }[] {
  if (!after || after.length === 0) return []
  const beforeById = new Map((before ?? []).map((item) => [getId(item), getValue(item)]))
  return after
    .map((item) => ({ id: getId(item), item, beforeValue: beforeById.get(getId(item)) }))
    .filter(({ item, beforeValue }) => beforeValue !== getValue(item))
}

/** Written responses whose text differs from the previous attempt's response to the same prompt (or are new). */
export function diffWrittenResponses(
  before: { promptDefinitionId: string; responseText: string }[] | undefined,
  after: { promptDefinitionId: string; responseText: string }[],
): { promptDefinitionId: string; beforeText: string | undefined; afterText: string }[] {
  const beforeById = new Map((before ?? []).map((wr) => [wr.promptDefinitionId, wr.responseText]))
  return after
    .map((wr) => ({
      promptDefinitionId: wr.promptDefinitionId,
      beforeText: beforeById.get(wr.promptDefinitionId),
      afterText: wr.responseText,
    }))
    .filter(({ beforeText, afterText }) => beforeText !== afterText)
}
