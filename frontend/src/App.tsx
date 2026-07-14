import { Suspense, lazy } from "react";
import { AuthProvider } from "./context/AuthContext";
import { useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { ToastProvider } from "./context/ToastContext";
import { Layout } from "./layouts/MainLayout";
import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { LoadingSpinner } from "./components/ui/LoadingSpinner";

// Lazy load all page components for code splitting
const Dashboard = lazy(() =>
  import("./pages/Dashboard").then((m) => ({ default: m.Dashboard })),
);
const ProjectsList = lazy(() =>
  import("./pages/ProjectsList").then((m) => ({ default: m.ProjectsList })),
);
const ProjectDetail = lazy(() =>
  import("./pages/ProjectDetail").then((m) => ({ default: m.ProjectDetail })),
);
const AdminDashboard = lazy(() =>
  import("./pages/AdminDashboard").then((m) => ({ default: m.AdminDashboard })),
);
const SequenceAnalysis = lazy(() =>
  import("./pages/SequenceAnalysis").then((m) => ({
    default: m.SequenceAnalysis,
  })),
);
const PeptideCalculator = lazy(() =>
  import("./pages/PeptideCalculator").then((m) => ({
    default: m.PeptideCalculator,
  })),
);
const Blast = lazy(() =>
  import("./pages/Blast").then((m) => ({ default: m.Blast })),
);
const MSA = lazy(() => import("./pages/MSA").then((m) => ({ default: m.MSA })));
const PrimerDesign = lazy(() =>
  import("./pages/PrimerDesign").then((m) => ({ default: m.PrimerDesign })),
);
const AntibodyAnnotation = lazy(() =>
  import("./pages/AntibodyAnnotation").then((m) => ({
    default: m.AntibodyAnnotation,
  })),
);

function PageLoader() {
  return <LoadingSpinner />;
}

function LayoutShell() {
  return (
    <Layout>
      <Suspense fallback={<PageLoader />}>
        <Outlet />
      </Suspense>
    </Layout>
  );
}

function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <PageLoader />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route element={<LayoutShell />}>
              <Route
                path="/"
                element={
                  <RequireAuth>
                    <Dashboard />
                  </RequireAuth>
                }
              />
              <Route
                path="/projects"
                element={
                  <RequireAuth>
                    <ProjectsList />
                  </RequireAuth>
                }
              />
              <Route
                path="/projects/:id"
                element={
                  <RequireAuth>
                    <ProjectDetail />
                  </RequireAuth>
                }
              />
              <Route
                path="/admin-dashboard"
                element={
                  <RequireAuth>
                    <AdminDashboard />
                  </RequireAuth>
                }
              />
              <Route
                path="/sequence-analysis"
                element={
                  <RequireAuth>
                    <SequenceAnalysis />
                  </RequireAuth>
                }
              />
              <Route
                path="/peptide-calc"
                element={
                  <RequireAuth>
                    <PeptideCalculator />
                  </RequireAuth>
                }
              />
              <Route
                path="/blast"
                element={
                  <RequireAuth>
                    <Blast />
                  </RequireAuth>
                }
              />
              <Route
                path="/msa"
                element={
                  <RequireAuth>
                    <MSA />
                  </RequireAuth>
                }
              />
              <Route
                path="/primer-design"
                element={
                  <RequireAuth>
                    <PrimerDesign />
                  </RequireAuth>
                }
              />
              <Route
                path="/antibody-annotation"
                element={
                  <RequireAuth>
                    <AntibodyAnnotation />
                  </RequireAuth>
                }
              />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
