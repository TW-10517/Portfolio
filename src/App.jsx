import { Navigate, Route, Routes } from "react-router-dom";
import { EditorPage } from "./pages/EditorPage.jsx";
import { PreviewPage } from "./pages/PreviewPage.jsx";
import { SharePage } from "./pages/SharePage.jsx";
import { LoginPage } from "./pages/LoginPage.jsx";
import { RegisterPage } from "./pages/RegisterPage.jsx";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage.jsx";
import { ResetPasswordPage } from "./pages/ResetPasswordPage.jsx";
import { VerifyEmailPage } from "./pages/VerifyEmailPage.jsx";
import { RequireAuth } from "./components/auth/RequireAuth.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/editor" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
      <Route path="/verify-email/:token" element={<VerifyEmailPage />} />
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
