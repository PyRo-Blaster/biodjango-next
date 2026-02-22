import React, { useState, useEffect } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { Folder, Lock, Unlock, Eye, Clock, Plus, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

interface Project {
  id: string;
  name: string;
  description: string;
  owner: { username: string };
  created_at: string;
  sequences_count: number;
  is_public: boolean;
  access_status: "PENDING" | "APPROVED" | "REJECTED" | null;
  is_allowed: boolean;
}

export const ProjectsList = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();
  const { showToast } = useToast();
  const [requestReason, setRequestReason] = useState("");
  const [requestingId, setRequestingId] = useState<string | null>(null);

  // Create Project Modal State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newProject, setNewProject] = useState({
    name: "",
    description: "",
    is_public: false,
  });
  const [createError, setCreateError] = useState("");

  const fetchProjects = async () => {
    try {
      const response = await axios.get("/api/projects/projects/");
      setProjects(response.data);
    } catch (error) {
      console.error("Failed to fetch projects", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");
    try {
      await axios.post("/api/projects/projects/", newProject);
      setIsCreateModalOpen(false);
      setNewProject({ name: "", description: "", is_public: false });
      fetchProjects();
    } catch (err: any) {
      setCreateError(
        err.response?.data?.name?.[0] || "Failed to create project",
      );
    }
  };

  const handleRequestAccess = async (projectId: string) => {
    try {
      await axios.post("/api/projects/access-requests/", {
        project: projectId,
        reason: requestReason || "Requesting access to view sequences.",
      });
      setRequestingId(null);
      setRequestReason("");
      fetchProjects(); // Refresh to show pending status
    } catch (error) {
      showToast("Failed to request access", "error");
    }
  };

  if (isLoading) return <div>Loading projects...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-800">Projects</h2>
        {user?.is_staff && (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-primary-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Project
          </button>
        )}
      </div>

      {/* Create Project Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Create New Project</h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {createError && (
              <div className="mb-4 p-2 bg-red-50 text-red-600 text-sm rounded">
                {createError}
              </div>
            )}
            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Project Name
                </label>
                <input
                  type="text"
                  required
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 outline-none"
                  value={newProject.name}
                  onChange={(e) =>
                    setNewProject({ ...newProject, name: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary-500 outline-none h-24"
                  value={newProject.description}
                  onChange={(e) =>
                    setNewProject({
                      ...newProject,
                      description: e.target.value,
                    })
                  }
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_public"
                  checked={newProject.is_public}
                  onChange={(e) =>
                    setNewProject({
                      ...newProject,
                      is_public: e.target.checked,
                    })
                  }
                  className="rounded text-primary-600 focus:ring-primary-500"
                />
                <label htmlFor="is_public" className="text-sm text-slate-700">
                  Make this project public
                </label>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((project) => (
          <div
            key={project.id}
            className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-blue-50 rounded-lg">
                <Folder className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex flex-col items-end">
                {project.is_public ? (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full flex items-center gap-1">
                    <Unlock className="w-3 h-3" /> Public
                  </span>
                ) : (
                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-full flex items-center gap-1">
                    <Lock className="w-3 h-3" /> Private
                  </span>
                )}
              </div>
            </div>

            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              {project.name}
            </h3>
            <p className="text-sm text-slate-500 mb-4 line-clamp-2">
              {project.description || "No description provided."}
            </p>

            <div className="flex items-center gap-4 text-xs text-slate-400 mb-6">
              <span>{project.sequences_count} sequences</span>
              <span>•</span>
              <span>By {project.owner.username}</span>
            </div>

            <div className="border-t border-slate-100 pt-4">
              {project.is_allowed || project.is_public ? (
                <Link
                  to={`/projects/${project.id}`}
                  className="w-full flex justify-center items-center gap-2 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  View Sequences
                </Link>
              ) : (
                <div>
                  {project.access_status === "PENDING" ? (
                    <button
                      disabled
                      className="w-full flex justify-center items-center gap-2 py-2 bg-yellow-100 text-yellow-700 rounded-lg cursor-not-allowed"
                    >
                      <Clock className="w-4 h-4" />
                      Pending Approval
                    </button>
                  ) : requestingId === project.id ? (
                    <div className="space-y-2">
                      <input
                        type="text"
                        placeholder="Reason..."
                        className="w-full text-sm border rounded px-2 py-1"
                        value={requestReason}
                        onChange={(e) => setRequestReason(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleRequestAccess(project.id)}
                          className="flex-1 bg-primary-600 text-white text-xs py-1.5 rounded"
                        >
                          Submit
                        </button>
                        <button
                          onClick={() => setRequestingId(null)}
                          className="flex-1 bg-slate-200 text-slate-700 text-xs py-1.5 rounded"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setRequestingId(project.id)}
                      className="w-full flex justify-center items-center gap-2 py-2 border border-primary-600 text-primary-600 rounded-lg hover:bg-primary-50 transition-colors"
                    >
                      Request Access
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
