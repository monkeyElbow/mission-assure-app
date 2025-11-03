// src/data/useRosterSummary.js
import { useEffect, useState, useCallback } from 'react'
import { api } from './api.local'

export function useRosterSummary(tripId) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [data, setData] = useState(null)

  const refresh = useCallback(async () => {
    if (!tripId) return
    setLoading(true)
    setError(null)
    try {
      const res = await api.getRosterSummary(tripId)
      setData(res)
    } catch (e) {
      setError(e)
    } finally {
      setLoading(false)
    }
  }, [tripId])

  useEffect(() => {
    refresh()
  }, [refresh])

  return {
    loading,
    error,
    data,
    ready: data?.ready_roster || [],
    pending: data?.pending_coverage || [],
    coveredCount: data?.covered_count || 0,
    pendingCount: data?.pending_count || 0,
    unassignedSpots: (data?.unassigned_spots || 0) + (data?.held_spots || 0),
    refresh
  }
}
