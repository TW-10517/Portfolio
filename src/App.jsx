import { Navigate, Route, Routes } from "react-router-dom";
import { EditorPage } from "./pages/EditorPage.jsx";
import { PreviewPage } from "./pages/PreviewPage.jsx";
import { SharePage } from "./pages/SharePage.jsx";
import { LoginPage } from "./pages/LoginPage.jsx";
import { RegisterPage } from "./pages/RegisterPage.jsx";
import { RequireAuth } from "./components/auth/RequireAuth.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/editor" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/editor"
        element={
          <RequireAuth>
            <EditorPage />
          </RequireAuth>
        }
      />
      <Route path="/preview" element={<PreviewPage />} />
      <Route path="/p/:slug" element={<SharePage />} />
      <Route path="*" element={<Navigate to="/editor" replace />} />
    </Routes>
  );
}
