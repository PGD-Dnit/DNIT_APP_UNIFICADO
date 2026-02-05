// src/App.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import AppShell from "./app/AppShell";
import ComparePage from "./modules/imagem_360/ComparePage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<AppShell />} />
      <Route path="/compare" element={<ComparePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
