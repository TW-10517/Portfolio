import { Navigate, Route, Routes } from "react-router-dom";
import { EditorPage } from "./pages/EditorPage.jsx";
import { PreviewPage } from "./pages/PreviewPage.jsx";
import { SharePage } from "./pages/SharePage.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/editor" replace />} />
      <Route path="/editor" element={<EditorPage />} />
      <Route path="/preview" element={<PreviewPage />} />
      <Route path="/p/:slug" element={<SharePage />} />
      <Route path="*" element={<Navigate to="/editor" replace />} />
    </Routes>
  );
}
