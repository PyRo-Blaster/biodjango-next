import React, { useEffect, useState } from "react";
import { Dna, RefreshCw } from "lucide-react";
import clsx from "clsx";
import { analysisApi } from "../api";
import type { PrimerDesignResult, PrimerPair } from "../api";
import { RateLimitAlert } from "../components/RateLimitAlert";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorBanner } from "../components/ui/ErrorBanner";
import { useAnalysisTool } from "../hooks/useAnalysisTool";
import { useTaskPolling } from "../hooks/useTaskPolling";

export const PrimerDesign = () => {
  const [sequence, setSequence] = useState("");
  const [productSize, setProductSize] = useState("100-300");
  const [tmOpt, setTmOpt] = useState(60.0);
  const [taskId, setTaskId] = useState<string | null>(null);
  const { loading, errorInfo, execute, resetError } = useAnalysisTool<{ id: string }>();
  const { status, result, error } = useTaskPolling<PrimerDesignResult>(taskId);

  useEffect(() => {
    if (error) setTaskId(null);
  }, [error]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTaskId(null);
    resetError();

    const created = await execute(() =>
      analysisApi.submitPrimerDesign({
        sequence,
        product_size_range: productSize,
        tm_opt: tmOpt,
      }),
    );
    if (created?.id) setTaskId(created.id);
  };

  const busy = Boolean(taskId) && status !== "SUCCESS" && status !== "FAILURE";

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
        <Dna className="w-6 h-6 text-primary-600" />
        Primer Design
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm h-fit">
          <form onSubmit={handleSubmit} className="space-y-4">
            {errorInfo?.isRateLimited && (
              <RateLimitAlert
                retryAfter={errorInfo.retryAfter || 10}
                message={errorInfo.message}
                onRetryReady={resetError}
              />
            )}
            {errorInfo && !errorInfo.isRateLimited && (
              <ErrorBanner message={errorInfo.message} />
            )}

            <div>
              <label htmlFor="primer-sequence" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Template Sequence (DNA)
              </label>
              <textarea
                id="primer-sequence"
                value={sequence}
                onChange={(e) =>
                  setSequence(e.target.value.toUpperCase().replace(/[^ATCGN]/g, ""))
                }
                className="w-full h-40 p-3 text-sm font-mono border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                placeholder="ATCG..."
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="product-size" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Product Size
                </label>
                <input
                  id="product-size"
                  type="text"
                  value={productSize}
                  onChange={(e) => setProductSize(e.target.value)}
                  className="w-full p-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  placeholder="100-300"
                />
              </div>
              <div>
                <label htmlFor="tm-opt" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Optimal Tm (°C)
                </label>
                <input
                  id="tm-opt"
                  type="number"
                  value={tmOpt}
                  onChange={(e) => setTmOpt(parseFloat(e.target.value))}
                  className="w-full p-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                  step="0.5"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || busy}
              className="w-full py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {loading || busy ? "Designing..." : "Design Primers"}
            </button>
          </form>
        </div>

        <div className="lg:col-span-2">
          {busy && (
            <div className="flex flex-col items-center justify-center text-primary-600 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-12">
              <RefreshCw className="w-8 h-8 mb-2 animate-spin" />
              <p className="text-sm">Status: {status}</p>
            </div>
          )}
          {status === "FAILURE" && error && (
            <ErrorBanner className="mb-4" message={error} />
          )}
          {result?.primers && (
            <div className="space-y-4">
              {result.primers.map((pair, idx) => (
                <div
                  key={idx}
                  className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden"
                >
                  <div className="bg-slate-50 dark:bg-slate-800/50 px-4 py-2 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      Pair #{pair.rank}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Product Size: {pair.product_size} bp
                    </span>
                  </div>
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <PrimerCard type="Forward" data={pair.forward} color="blue" />
                    <PrimerCard type="Reverse" data={pair.reverse} color="green" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!result && !loading && !busy && !errorInfo && status !== "FAILURE" && (
            <EmptyState message="Enter sequence and parameters to generate primers" />
          )}
        </div>
      </div>
    </div>
  );
};

const PrimerCard = ({
  type,
  data,
  color,
}: {
  type: string;
  data: PrimerPair["forward"];
  color: "blue" | "green";
}) => {
  const colorClasses =
    color === "blue"
      ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-100 dark:border-blue-800"
      : "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-100 dark:border-green-800";

  return (
    <div className={clsx("p-3 rounded-lg border", colorClasses)}>
      <div className="flex justify-between items-center mb-2">
        <span className="font-bold text-xs uppercase tracking-wider">
          {type} Primer
        </span>
        <span className="text-xs opacity-75">{data.length} bp</span>
      </div>
      <div className="font-mono text-sm break-all mb-2 font-medium">
        {data.sequence}
      </div>
      <div className="flex gap-4 text-xs opacity-80">
        <span>Tm: {typeof data.tm === "number" ? data.tm.toFixed(1) : data.tm}°C</span>
        <span>
          GC: {typeof data.gc_percent === "number" ? data.gc_percent.toFixed(1) : data.gc_percent}%
        </span>
      </div>
    </div>
  );
};
