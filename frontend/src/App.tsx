import React from 'react';
import { AuthProvider } from './context/AuthContext';
import { Layout } from './layouts/MainLayout';
import { Routes, Route, Navigate } from 'react-router-dom';
import { SequenceAnalysis } from './pages/SequenceAnalysis';
import { PeptideCalculator } from './pages/PeptideCalculator';
import { Blast } from './pages/Blast';
import { MSA } from './pages/MSA';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { ProjectsList } from './pages/ProjectsList';
import { ProjectDetail } from './pages/ProjectDetail';
import { AdminDashboard } from './pages/AdminDashboard';

// Placeholder components for routes not yet implemented
const Dashboard = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-semibold mb-2">Welcome Back</h3>
            <p className="text-slate-600">Select a tool from the sidebar to start your analysis.</p>
        </div>
    </div>
);

function App() {
  return (
    <AuthProvider>
        <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            
            <Route path="/*" element={
                <Layout>
                    <Routes>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/projects" element={<ProjectsList />} />
                        <Route path="/projects/:id" element={<ProjectDetail />} />
                        <Route path="/admin-dashboard" element={<AdminDashboard />} />
                        <Route path="/sequence-analysis" element={<SequenceAnalysis />} />
                        <Route path="/peptide-calc" element={<PeptideCalculator />} />
                        <Route path="/blast" element={<Blast />} />
                        <Route path="/msa" element={<MSA />} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </Layout>
            } />
        </Routes>
    </AuthProvider>
  );
}

export default App;
