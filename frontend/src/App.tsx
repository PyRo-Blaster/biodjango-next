import React from 'react';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
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
import { Dashboard } from './pages/Dashboard';
import { PrimerDesign } from './pages/PrimerDesign';
import { AntibodyAnnotation } from './pages/AntibodyAnnotation';

function App() {
  return (
    <ThemeProvider>
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
                        <Route path="/primer-design" element={<PrimerDesign />} />
                        <Route path="/antibody-annotation" element={<AntibodyAnnotation />} />
                        <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </Layout>
            } />
        </Routes>
    </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
