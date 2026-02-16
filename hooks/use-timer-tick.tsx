"use client"

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react"

type TimerTickContextValue = {
  now: number
  subscribe: () => () => void
}

const TimerTickContext = createContext<TimerTickContextValue | null>(null)

/**
 * Single shared setInterval for the entire app.
 * Interval only ticks when at least one consumer is subscribed.
 */
export function TimerTickProvider({ children }: { children: ReactNode }) {
  const [now, setNow] = useState(() => Date.now())
  const subscriberCount = useRef(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startInterval = useCallback(() => {
    if (intervalRef.current) return
    intervalRef.current = setInterval(() => {
      setNow(Date.now())
    }, 1000)
  }, [])

  const stopInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const subscribe = useCallback(() => {
    subscriberCount.current++
    if (subscriberCount.current === 1) {
      startInterval()
    }
    return () => {
      subscriberCount.current--
      if (subscriberCount.current === 0) {
        stopInterval()
      }
    }
  }, [startInterval, stopInterval])

  useEffect(() => {
    return () => stopInterval()
  }, [stopInterval])

  return (
    <TimerTickContext.Provider value={{ now, subscribe }}>
      {children}
    </TimerTickContext.Provider>
  )
}

/**
 * Subscribe to the shared timer tick (1s interval).
 * Only call this in components that need live ticking (active timer capsule, floating widget).
 * Returns the current timestamp that updates every second.
 */
export function useTimerTick(): number {
  const ctx = useContext(TimerTickContext)
  if (!ctx) throw new Error("useTimerTick must be used within TimerTickProvider")

  useEffect(() => {
    return ctx.subscribe()
  }, [ctx])

  return ctx.now
}
