import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import UbahPassword from './pages/UbahPassword';

import MuridDashboard from './pages/Murid/Dashboard';
import MuridMateri from './pages/Murid/Materi';
import MateriDetail from './pages/Murid/MateriDetail';
import Latihan from './pages/Murid/Latihan';

import GuruDashboard from './pages/Guru/Dashboard';
import GuruMurid from './pages/Guru/Murid';
import GuruMateri from './pages/Guru/Materi';
import GuruSoal from './pages/Guru/Soal';

import AdminDashboard from './pages/Admin/Dashboard';
import AdminEduNusa from './pages/Admin/EduNusa';
import AdminUsers from './pages/Admin/Users';
import AdminMapel from './pages/Admin/Mapel';
import AdminLatihAI from './pages/Admin/LatihAI';

export default function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route
          path="/ubah-password"
          element={
            <ProtectedRoute>
              <UbahPassword />
            </ProtectedRoute>
          }
        />

        <Route
          path="/murid/dashboard"
          element={
            <ProtectedRoute allowedRoles={['murid']}>
              <MuridDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/murid/materi"
          element={
            <ProtectedRoute allowedRoles={['murid']}>
              <MuridMateri />
            </ProtectedRoute>
          }
        />
        <Route
          path="/murid/materi/:id"
          element={
            <ProtectedRoute allowedRoles={['murid']}>
              <MateriDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/murid/latihan/:materi_id"
          element={
            <ProtectedRoute allowedRoles={['murid']}>
              <Latihan />
            </ProtectedRoute>
          }
        />

        <Route
          path="/guru/dashboard"
          element={
            <ProtectedRoute allowedRoles={['guru', 'admin']}>
              <GuruDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/guru/murid"
          element={
            <ProtectedRoute allowedRoles={['guru', 'admin']}>
              <GuruMurid />
            </ProtectedRoute>
          }
        />
        <Route
          path="/guru/materi"
          element={
            <ProtectedRoute allowedRoles={['guru', 'admin']}>
              <GuruMateri />
            </ProtectedRoute>
          }
        />
        <Route
          path="/guru/soal"
          element={
            <ProtectedRoute allowedRoles={['guru', 'admin']}>
              <GuruSoal />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminUsers />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/edunusa"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminEduNusa />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/mapel"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminMapel />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/latih-ai"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminLatihAI />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
