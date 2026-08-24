import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { LoginPage } from "./pages/LoginPage.jsx";
import { RegisterPage } from "./pages/RegisterPage.jsx";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage.jsx";
import { ResetPasswordPage } from "./pages/ResetPasswordPage.jsx";
import { VerifyEmailPage } from "./pages/VerifyEmailPage.jsx";
import { RequireAuth } from "./components/auth/RequireAuth.jsx";

// The editor and the portfolio renderer are by far the largest part of the
// bundle, and neither is needed to show a login form — which is the first
// thing most visits hit. Splitting them means the auth pages no longer pay
// for the AI Video studio, the theme engine and every portfolio section.
const EditorPage = lazy(() => import("./pages/EditorPage.jsx").then((m) => ({ default: m.EditorPage })));
const PreviewPage = lazy(() => import("./pages/PreviewPage.jsx").then((m) => ({ default: m.PreviewPage })));
const SharePage = lazy(() => import("./pages/SharePage.jsx").then((m) => ({ default: m.SharePage })));

function RouteFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950" role="status" aria-live="polite">
      <span className="text-sm text-slate-400">Loading…</span>
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
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
    </Suspense>
  );
}
