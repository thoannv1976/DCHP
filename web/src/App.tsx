import { Link, Route, Routes, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth";
import ProgramListPage from "./pages/ProgramListPage";
import ProgramEditPage from "./pages/ProgramEditPage";
import ProgramDetailPage from "./pages/ProgramDetailPage";
import SyllabusEditPage from "./pages/SyllabusEditPage";

function Header() {
  const { user, login, logout, loading } = useAuth();
  return (
    <header className="bg-white border-b border-slate-200">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" className="text-lg font-semibold text-indigo-700">
          DCHP — Đề cương học phần
        </Link>
        <div className="text-sm">
          {loading ? null : user ? (
            <div className="flex items-center gap-3">
              <span className="text-slate-600">{user.displayName ?? user.email}</span>
              <button className="btn-secondary" onClick={logout}>
                Đăng xuất
              </button>
            </div>
          ) : (
            <button className="btn-primary" onClick={login}>
              Đăng nhập với Google
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-slate-500">Đang tải...</div>;
  if (!user)
    return (
      <div className="max-w-md mx-auto mt-20 card text-center">
        <h2 className="text-lg font-semibold mb-2">Cần đăng nhập</h2>
        <p className="text-slate-600 text-sm">
          Vui lòng đăng nhập với Google để bắt đầu xây dựng đề cương.
        </p>
      </div>
    );
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-slate-50">
        <Header />
        <main className="max-w-6xl mx-auto px-4 py-6">
          <Routes>
            <Route
              path="/"
              element={
                <Protected>
                  <ProgramListPage />
                </Protected>
              }
            />
            <Route
              path="/programs/new"
              element={
                <Protected>
                  <ProgramEditPage />
                </Protected>
              }
            />
            <Route
              path="/programs/:programId"
              element={
                <Protected>
                  <ProgramDetailPage />
                </Protected>
              }
            />
            <Route
              path="/programs/:programId/edit"
              element={
                <Protected>
                  <ProgramEditPage />
                </Protected>
              }
            />
            <Route
              path="/programs/:programId/syllabi/:syllabusId"
              element={
                <Protected>
                  <SyllabusEditPage />
                </Protected>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </AuthProvider>
  );
}
