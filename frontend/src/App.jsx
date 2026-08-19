// App.jsx — Routing + protection
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Layout from './components/Layout';
import PredictIV from './pages/PredictIV';
import Pricing from './pages/Pricing';
import Surface from './pages/Surface';
import Evaluation from './pages/Evaluation';
import AdminUsers from './pages/AdminUsers';
import { getCurrentUser } from './api/client';
import EDA from './pages/EDA';
import Methodology from './pages/Methodology';
import SurfaceMethodology from './pages/SurfaceMethodology';
import DataPreparation from './pages/DataPreparation';

// Protège les routes : redirige vers /login si pas de token
function ProtectedRoute({ children, adminOnly = false }) {
  const user = getCurrentUser();
  const token = localStorage.getItem('pwc_token');
  if (!token || !user) return <Navigate to="/login" replace />;
  if (adminOnly && !user.is_admin) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>

        <Route path="/" element={<PredictIV />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/surface" element={<Surface />} />
        <Route path="/evaluation" element={<Evaluation />} />
        <Route path="/eda" element={<EDA />} />
        <Route path="/data-preparation" element={<DataPreparation />} />
        <Route path="/methodology" element={<Methodology />} />
        <Route path="/surface-methodology" element={<SurfaceMethodology />} />
        <Route path="/admin" element={
          <ProtectedRoute adminOnly><AdminUsers /></ProtectedRoute>
        } />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}