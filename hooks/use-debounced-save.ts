import { useRef, useCallback, useEffect } from "react"

export function useDebouncedSave<T>(
  saveFn: (value: T) => Promise<void>,
  delay = 1000,
) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveFnRef = useRef(saveFn)
  const pendingValueRef = useRef<{ value: T } | null>(null)
  saveFnRef.current = saveFn

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      // Flush pending value on unmount so last edit is not lost
      if (pendingValueRef.current) {
        saveFnRef.current(pendingValueRef.current.value).catch(console.error)
        pendingValueRef.current = null
      }
    }
  }, [])

  const trigger = useCallback(
    (value: T) => {
      pendingValueRef.current = { value }
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(async () => {
        pendingValueRef.current = null
        await saveFnRef.current(value)
      }, delay)
    },
    [delay],
  )

  return trigger
}
