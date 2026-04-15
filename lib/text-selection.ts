export interface TextSelectionInsertionResult {
  value: string
  selectionStart: number
  selectionEnd: number
}

export function insertTextAtSelection(
  value: string,
  insertion: string,
  selectionStart: number,
  selectionEnd: number,
): TextSelectionInsertionResult {
  const nextValue = `${value.slice(0, selectionStart)}${insertion}${value.slice(selectionEnd)}`
  const nextCaret = selectionStart + insertion.length

  return {
    value: nextValue,
    selectionStart: nextCaret,
    selectionEnd: nextCaret,
  }
}