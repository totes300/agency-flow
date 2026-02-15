import { useRef, useCallback, useEffect } from "react"

export function useDebouncedSave<T>(
  saveFn: (value: T) => Promise<void>,
  delay = 1000,
) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveFnRef = useRef(saveFn)
  saveFnRef.current = saveFn

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  const trigger = useCallback(
    (value: T) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(async () => {
        await saveFnRef.current(value)
      }, delay)
    },
    [delay],
  )

  return trigger
}
