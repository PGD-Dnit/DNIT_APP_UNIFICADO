// src/App.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import AppShell from "./app/AppShell";
import SinglePanoPage from "./modules/imagem_360/SinglePanoPage";
import ComparePage from "./modules/imagem_360/ComparePage";
import SingleImagePage from "./modules/imagem_obra/SingleImagePage";
import CompareImagePage from "./modules/imagem_obra/CompareImagePage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<AppShell />} />
      <Route path="/view360" element={<SinglePanoPage />} />
      <Route path="/compare" element={<ComparePage />} />
      <Route path="/view-image" element={<SingleImagePage />} />
      <Route path="/compare-image" element={<CompareImagePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
