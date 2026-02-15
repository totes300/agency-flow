import { useRef, useCallback, useEffect } from "react"
import { toast } from "sonner"

const UNDO_DELAY_MS = 5000
const ACTION_DELAY_MS = 4800 // Slightly before toast dismisses to avoid race

/**
 * Hook implementing the 5-second delayed mutation with undo toast (constraint #17).
 *
 * The destructive action is NOT committed until the toast auto-dismisses.
 * Clicking Undo cancels the pending mutation entirely.
 */
export function useUndoAction() {
  const pendingTimeouts = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  // Clean up pending timeouts on unmount
  useEffect(() => {
    const timeouts = pendingTimeouts.current
    return () => {
      timeouts.forEach(clearTimeout)
      timeouts.clear()
    }
  }, [])

  const execute = useCallback(
    ({
      action,
      message,
      id,
    }: {
      action: () => Promise<void>
      message: string
      id: string
    }) => {
      // Cancel any existing pending action for this ID
      const existing = pendingTimeouts.current.get(id)
      if (existing) {
        clearTimeout(existing)
        pendingTimeouts.current.delete(id)
      }

      const toastId = toast(message, {
        duration: UNDO_DELAY_MS,
        action: {
          label: "Undo",
          onClick: () => {
            const timeout = pendingTimeouts.current.get(id)
            if (timeout) {
              clearTimeout(timeout)
              pendingTimeouts.current.delete(id)
            }
            toast.dismiss(toastId)
          },
        },
      })

      const timeout = setTimeout(async () => {
        pendingTimeouts.current.delete(id)
        try {
          await action()
        } catch (err: unknown) {
          toast.error((err as Error).message)
        }
      }, ACTION_DELAY_MS)

      pendingTimeouts.current.set(id, timeout)
    },
    [],
  )

  return { execute }
}
