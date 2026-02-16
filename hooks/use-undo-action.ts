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
  const pendingActions = useRef<Map<string, () => Promise<void>>>(new Map())

  // On unmount: clear timeouts but COMMIT all pending actions
  useEffect(() => {
    const timeouts = pendingTimeouts.current
    const actions = pendingActions.current
    return () => {
      timeouts.forEach(clearTimeout)
      timeouts.clear()
      // Fire-and-forget all pending actions so they aren't lost on navigation
      actions.forEach((action) => {
        action().catch(console.error)
      })
      actions.clear()
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
        pendingActions.current.delete(id)
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
              pendingActions.current.delete(id)
            }
            toast.dismiss(toastId)
          },
        },
      })

      // Store the action for commit-on-unmount
      pendingActions.current.set(id, action)

      const timeout = setTimeout(async () => {
        pendingTimeouts.current.delete(id)
        pendingActions.current.delete(id)
        try {
          await action()
        } catch (err: unknown) {
          toast.error(err instanceof Error ? err.message : "Something went wrong")
        }
      }, ACTION_DELAY_MS)

      pendingTimeouts.current.set(id, timeout)
    },
    [],
  )

  return { execute }
}
