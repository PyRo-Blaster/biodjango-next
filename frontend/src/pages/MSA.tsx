import React, { useEffect, useState } from "react";
import { AlertCircle, AlignJustify, FileText, Loader2, RefreshCw } from "lucide-react";
import { analysisApi } from "../api";
import type { MsaResult } from "../api";
import { MsaViewer } from "../components/MsaViewer";
import { RateLimitAlert } from "../components/RateLimitAlert";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorBanner } from "../components/ui/ErrorBanner";
import { useAnalysisTool } from "../hooks/useAnalysisTool";
import { useTaskPolling } from "../hooks/useTaskPolling";

export const MSA = () => {
  const [sequence, setSequence] = useState("");
  const [taskId, setTaskId] = useState<string | null>(null);
  const { loading, errorInfo, execute, resetError } = useAnalysisTool<{ id: string }>();
  const { status, result, error, reset } = useTaskPolling<MsaResult>(taskId);

  useEffect(() => {
    if (error) setTaskId(null);
  }, [error]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTaskId(null);
    resetError();

    const created = await execute(() => analysisApi.submitMsa({ sequence }));
    if (created?.id) setTaskId(created.id);
  };

  const handleReset = () => {
    setTaskId(null);
    reset();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <h2 className="text-2xl font-bold text-slate-800">Multiple Sequence Alignment (MSA)</h2>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
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
                <label htmlFor="msa-sequence" className="block text-sm font-medium text-slate-700 mb-2">
                  Sequences (FASTA)
                </label>
                <textarea
                  id="msa-sequence"
                  value={sequence}
                  onChange={(e) => setSequence(e.target.value)}
                  placeholder=">Seq1&#10;MTEITAAMVK...&#10;>Seq2&#10;MTEITAAMVK..."
                  className="w-full h-64 p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none font-mono text-sm resize-none"
                  required
                />
                <p className="text-xs text-slate-500 mt-2">Enter at least 2 sequences.</p>
              </div>

              <button
                type="submit"
                disabled={!!taskId || loading}
                className="w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {taskId || loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Run Alignment"}
              </button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-2">
          {taskId ? (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 flex flex-col items-center justify-center min-h-[300px] text-center space-y-4">
              {status === "SUCCESS" ? (
                <div className="space-y-4 w-full text-left">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-4">
                      <h3 className="font-semibold text-green-600 flex items-center gap-2">
                        <FileText className="w-5 h-5" />
                        Alignment Complete
                      </h3>
                      <button
                        onClick={handleReset}
                        className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded-md transition-colors"
                      >
                        Start New Alignment
                      </button>
                    </div>
                    <span className="text-xs text-slate-400">Task ID: {taskId}</span>
                  </div>
                  {result?.output && <MsaViewer clustalContent={result.output} />}
                </div>
              ) : status === "FAILURE" ? (
                <div className="text-red-500 flex flex-col items-center">
                  <AlertCircle className="w-12 h-12 mb-2" />
                  <p className="font-medium">Alignment Failed</p>
                  <p className="text-sm mt-2 bg-red-50 p-2 rounded">{error}</p>
                </div>
              ) : (
                <div className="text-primary-600 flex flex-col items-center animate-pulse">
                  <RefreshCw className="w-12 h-12 mb-4 animate-spin" />
                  <p className="font-medium text-lg">Aligning Sequences...</p>
                  <p className="text-slate-500">Status: {status}</p>
                </div>
              )}
            </div>
          ) : (
            <EmptyState
              icon={AlignJustify}
              message="Enter sequences to start MSA"
              className="h-full min-h-[400px]"
            />
          )}
        </div>
      </div>
    </div>
  );
};
