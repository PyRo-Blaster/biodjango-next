import React, { useEffect, useState } from 'react';
import { AlertTriangle, Clock } from 'lucide-react';

interface RateLimitAlertProps {
  retryAfter: number;
  onRetryReady?: () => void;
  message?: string;
}

export const RateLimitAlert: React.FC<RateLimitAlertProps> = ({
  retryAfter,
  onRetryReady,
  message = 'Request rate limited.',
}) => {
  const [countdown, setCountdown] = useState(retryAfter);

  useEffect(() => {
    setCountdown(retryAfter);
  }, [retryAfter]);

  useEffect(() => {
    if (countdown <= 0) {
      onRetryReady?.();
      return;
    }

    const timer = window.setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => window.clearInterval(timer);
  }, [countdown, onRetryReady]);

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
      <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-yellow-800 font-medium">{message}</p>
        <p className="text-yellow-700 text-sm mt-1">
          {countdown > 0 ? (
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              请等待 {countdown} 秒后重试
            </span>
          ) : (
            <span className="text-green-700">现在可以重新提交</span>
          )}
        </p>
        <p className="text-yellow-700 text-xs mt-2">
          提示：登录后可获得更高请求配额
        </p>
      </div>
    </div>
  );
};

export default RateLimitAlert;
