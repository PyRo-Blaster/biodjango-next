import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Upload, FileText, Download } from "lucide-react";
import {
  handleApiError,
  projectsApi,
  sequencesApi,
  type ProjectDetail as ProjectDetailData,
  type Sequence,
} from "../api";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";
import clsx from "clsx";

export const ProjectDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<ProjectDetailData | null>(null);
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const { user } = useAuth();
  const { showToast } = useToast();

  useEffect(() => {
    if (!id) return;
    const loadDetails = async () => {
      try {
        const projectData = await projectsApi.get(id);
        setProject(projectData);
        setSequences(await sequencesApi.listByProject(id));
      } catch (error) {
        console.error("Failed to fetch details", error);
        showToast(handleApiError(error).message, "error");
        setProject(null);
      } finally {
        setIsLoading(false);
      }
    };

    void loadDetails();
  }, [id, showToast]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;

    setIsUploading(true);
    try {
      await projectsApi.uploadFasta(id, file);
      showToast("Upload successful!", "success");
      const projectData = await projectsApi.get(id);
      setProject(projectData);
      setSequences(await sequencesApi.listByProject(id));
    } catch (error) {
      console.error("Upload failed", error);
      showToast(handleApiError(error).message, "error");
    } finally {
      setIsUploading(false);
    }
  };

  const handleExport = () => {
    if (!sequences || sequences.length === 0) return;

    const fastaContent = sequences
      .map((seq) => `>${seq.name}\n${seq.sequence}`)
      .join("\n");
    const blob = new Blob([fastaContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${project?.name || "sequences"}_export.fasta`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (isLoading) return <LoadingSpinner />;
  if (!project) return <div>Project not found or access denied.</div>;

  const canUpload = Boolean(
    user?.is_staff || (project.owner && project.owner.username === user?.username),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Link
          to="/projects"
          className="p-2 hover:bg-slate-100 rounded-full text-slate-500"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h2 className="text-2xl font-bold text-slate-800">{project.name}</h2>
          <p className="text-slate-500">{project.description}</p>
        </div>
      </div>

      {canUpload && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Upload className="w-5 h-5 text-primary-600" />
            Upload Sequences (FASTA)
          </h3>
          <div className="flex items-center gap-4">
            <input
              type="file"
              accept=".fasta,.fa,.txt"
              onChange={handleFileUpload}
              disabled={isUploading}
              className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
            />
            {isUploading && (
              <span className="text-sm text-slate-500">Uploading...</span>
            )}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
          <h3 className="font-semibold text-slate-800">
            Sequences ({sequences.length})
          </h3>
          <button
            onClick={handleExport}
            disabled={sequences.length === 0}
            className={clsx(
              "text-sm flex items-center gap-1",
              sequences.length === 0
                ? "text-slate-300 cursor-not-allowed"
                : "text-primary-600 hover:text-primary-700",
            )}
          >
            <Download className="w-4 h-4" /> Export All
          </button>
        </div>
        <div className="divide-y divide-slate-100">
          {sequences.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              No sequences found in this project.
            </div>
          ) : (
            sequences.map((seq) => (
              <div
                key={seq.id}
                className="p-4 hover:bg-slate-50 transition-colors group"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-slate-400" />
                    <span className="font-mono font-medium text-primary-700">
                      {seq.name}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400">
                    {new Date(seq.created_at).toLocaleDateString()}
                  </span>
                </div>
                <pre className="text-xs font-mono bg-slate-50 p-2 rounded text-slate-600 overflow-x-auto whitespace-pre-wrap break-all">
                  {seq.sequence}
                </pre>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
