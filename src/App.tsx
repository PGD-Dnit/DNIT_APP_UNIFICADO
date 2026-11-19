// src/App.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import AppShell from "./app/AppShell";
import SinglePanoPage from "./modules/imagem_360/SinglePanoPage";
import ComparePage from "./modules/imagem_360/ComparePage";
import SingleImagePage from "./modules/imagem_obra/SingleImagePage";
import CompareImagePage from "./modules/imagem_obra/CompareImagePage";
import ObraDetailsPage from "./pages/ObraDetailsPage";
import GestaoObrasContratosPage from "./pages/GestaoObrasContratosPage";
import LoginPage from "./pages/LoginPage";
import PrivateRoute from "./components/PrivateRoute";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <AppShell />
          </PrivateRoute>
        }
      />
      <Route
        path="/view360"
        element={
          <PrivateRoute>
            <SinglePanoPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/compare"
        element={
          <PrivateRoute>
            <ComparePage />
          </PrivateRoute>
        }
      />
      <Route
        path="/view-image"
        element={
          <PrivateRoute>
            <SingleImagePage />
          </PrivateRoute>
        }
      />
      <Route
        path="/compare-image"
        element={
          <PrivateRoute>
            <CompareImagePage />
          </PrivateRoute>
        }
      />
      <Route
        path="/detalhes-obra"
        element={
          <PrivateRoute>
            <ObraDetailsPage />
          </PrivateRoute>
        }
      />
      <Route
        path="/gestao-obras-contratos"
        element={
          <PrivateRoute>
            <GestaoObrasContratosPage />
          </PrivateRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
