import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { DayPlanPage } from './pages/DayPlanPage';
import { ShiftGridPage } from './pages/ShiftGridPage';
import { RedistributionPage } from './pages/RedistributionPage';
import { OfficeDetailPage } from './pages/OfficeDetailPage';
import { DemandAnalysisPage } from './pages/DemandAnalysisPage';
import { SimulatorPage } from './pages/SimulatorPage';
import { AbsencesPage } from './pages/AbsencesPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { LoginPage } from './pages/LoginPage';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Pantalla 1: Login y Selección de Rol */}
        <Route path="/login" element={<LoginPage />} />

        {/* Layout Principal con Navegación para las 10 pantallas operativas */}
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="plan-dia" element={<DayPlanPage />} />
          <Route path="malla" element={<ShiftGridPage />} />
          <Route path="redistribucion" element={<RedistributionPage />} />
          <Route path="oficina/:id" element={<OfficeDetailPage />} />
          <Route path="demanda" element={<DemandAnalysisPage />} />
          <Route path="simulador" element={<SimulatorPage />} />
          <Route path="ausencias" element={<AbsencesPage />} />
          <Route path="reportes" element={<ReportsPage />} />
          <Route path="configuracion" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;
