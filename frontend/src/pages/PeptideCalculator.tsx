import React, { useEffect, useState } from "react";
import { Download, Loader2, RefreshCw } from "lucide-react";
import { analysisApi } from "../api";
import type { PeptideCalcResult } from "../api";
import { RateLimitAlert } from "../components/RateLimitAlert";
import { ErrorBanner } from "../components/ui/ErrorBanner";
import { useAnalysisTool } from "../hooks/useAnalysisTool";
import { useTaskPolling } from "../hooks/useTaskPolling";

export const PeptideCalculator = () => {
  const [targetMass, setTargetMass] = useState<string>("500.0");
  const [errorRange, setErrorRange] = useState<string>("1.0");
  const [numAminoAcids, setNumAminoAcids] = useState<string>("4");
  const [taskId, setTaskId] = useState<string | null>(null);
  const { loading, errorInfo, execute, resetError } = useAnalysisTool<{ id: string }>();
  const { status, result, error } = useTaskPolling<PeptideCalcResult>(taskId);

  useEffect(() => {
    if (error) setTaskId(null);
  }, [error]);

  const handleCalculate = async (e: React.FormEvent) => {
    e.preventDefault();
    setTaskId(null);
    resetError();

    const created = await execute(() =>
      analysisApi.submitPeptideCalc({
        target_mass: parseFloat(targetMass),
        error_range: parseFloat(errorRange),
        num_amino_acids: parseInt(numAminoAcids),
      }),
    );

    if (created?.id) setTaskId(created.id);
  };

  const handleDownload = () => {
    if (!result?.csv_content) return;
    const blob = new Blob([result.csv_content], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `peptide_calc_${targetMass}_${numAminoAcids}aa.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const busy = Boolean(taskId) && status !== "SUCCESS" && status !== "FAILURE";

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold text-slate-800 mb-6">
        Peptide Calculator
      </h2>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <form onSubmit={handleCalculate} className="space-y-6">
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="target-mass" className="block text-sm font-medium text-slate-700 mb-2">
                Target Mass (Da)
              </label>
              <input
                id="target-mass"
                type="number"
                step="0.01"
                value={targetMass}
                onChange={(e) => setTargetMass(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
                required
              />
            </div>

            <div>
              <label htmlFor="error-range" className="block text-sm font-medium text-slate-700 mb-2">
                Error Range (Da)
              </label>
              <input
                id="error-range"
                type="number"
                step="0.01"
                value={errorRange}
                onChange={(e) => setErrorRange(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="num-aa" className="block text-sm font-medium text-slate-700 mb-2">
              Number of Amino Acids
            </label>
            <select
              id="num-aa"
              value={numAminoAcids}
              onChange={(e) => setNumAminoAcids(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
            >
              {[2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">
              Note: Calculation complexity increases exponentially with length.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading || busy}
            className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading || busy ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              "Calculate Peptides"
            )}
          </button>
        </form>

        {busy && (
          <div className="mt-6 flex flex-col items-center text-primary-600">
            <RefreshCw className="w-8 h-8 mb-2 animate-spin" />
            <p className="text-sm">
              {status ? `Status: ${status}` : "Submitting..."}
            </p>
          </div>
        )}

        {status === "FAILURE" && error && (
          <ErrorBanner className="mt-6" message={error} />
        )}

        {result?.csv_content && (
          <div className="mt-8 pt-6 border-t border-slate-100 animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-slate-600">
                Calculation Complete
              </span>
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 font-medium px-3 py-1.5 rounded-md hover:bg-primary-50 transition-colors"
              >
                <Download className="w-4 h-4" />
                Download CSV
              </button>
            </div>

            <div className="bg-slate-50 rounded-lg border border-slate-200 p-4 max-h-60 overflow-y-auto font-mono text-xs text-slate-600">
              <pre>{result.csv_content}</pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
