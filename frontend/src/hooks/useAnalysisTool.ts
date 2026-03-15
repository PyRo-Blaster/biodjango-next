import { useCallback, useState } from 'react';
import { type ApiErrorInfo, handleApiError } from '../api/client';

interface UseAnalysisToolOptions<T> {
  onSuccess?: (data: T) => void;
  onError?: (error: ApiErrorInfo) => void;
}

export function useAnalysisTool<T = unknown>(options?: UseAnalysisToolOptions<T>) {
  const [loading, setLoading] = useState(false);
  const [errorInfo, setErrorInfo] = useState<ApiErrorInfo | null>(null);
  const [data, setData] = useState<T | null>(null);

  const resetError = useCallback(() => {
    setErrorInfo(null);
  }, []);

  const resetData = useCallback(() => {
    setData(null);
  }, []);

  const execute = useCallback(
    async (request: () => Promise<T>) => {
      setLoading(true);
      setErrorInfo(null);
      try {
        const responseData = await request();
        setData(responseData);
        options?.onSuccess?.(responseData);
        return responseData;
      } catch (error) {
        const parsed = handleApiError(error);
        setErrorInfo(parsed);
        options?.onError?.(parsed);
        return undefined;
      } finally {
        setLoading(false);
      }
    },
    [options]
  );

  return {
    loading,
    errorInfo,
    data,
    setData,
    execute,
    resetError,
    resetData,
  };
}

export default useAnalysisTool;
