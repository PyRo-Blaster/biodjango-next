import { useEffect, useState } from 'react';
import { apiClient, handleApiError } from '../api/client';

export type TaskState = 'PENDING' | 'STARTED' | 'SUCCESS' | 'FAILURE';

export interface TaskStatus {
  id: string;
  task_type?: string;
  status: TaskState;
  error_message?: string;
  updated_at?: string;
}

export interface TaskResult<T> extends TaskStatus {
  result?: T;
}

interface UseTaskPollingResult<T> {
  status: TaskState | null;
  result: T | null;
  error: string | null;
  reset: () => void;
}

const TERMINAL = new Set<TaskState>(['SUCCESS', 'FAILURE']);

/**
 * Poll the analysis task status endpoint every ``intervalMs`` and, on SUCCESS,
 * fetch the full result payload from the split ``/result/`` endpoint.
 *
 * Passing ``taskId = null`` disables polling. On terminal state (SUCCESS or
 * FAILURE) the interval clears and no further requests fire.
 */
export function useTaskPolling<T>(
  taskId: string | null,
  intervalMs: number = 2000
): UseTaskPollingResult<T> {
  const [status, setStatus] = useState<TaskState | null>(null);
  const [result, setResult] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setStatus(taskId ? 'PENDING' : null);
    setResult(null);
    setError(null);
  }, [taskId]);

  useEffect(() => {
    if (!taskId || (status && TERMINAL.has(status))) {
      return;
    }

    let cancelled = false;

    const tick = async () => {
      try {
        const poll = await apiClient.get<TaskStatus>(`/analysis/tasks/${taskId}/`);
        if (cancelled) return;
        setStatus(poll.data.status);

        if (poll.data.status === 'SUCCESS') {
          const full = await apiClient.get<TaskResult<T>>(
            `/analysis/tasks/${taskId}/result/`
          );
          if (cancelled) return;
          setResult(full.data.result ?? null);
        } else if (poll.data.status === 'FAILURE') {
          setError(poll.data.error_message ?? 'Task failed');
        }
      } catch (err) {
        if (cancelled) return;
        setError(handleApiError(err).message);
      }
    };

    const handle = window.setInterval(tick, intervalMs);
    return () => {
      cancelled = true;
      window.clearInterval(handle);
    };
  }, [taskId, status, intervalMs]);

  return {
    status,
    result,
    error,
    reset: () => {
      setStatus(null);
      setResult(null);
      setError(null);
    },
  };
}
