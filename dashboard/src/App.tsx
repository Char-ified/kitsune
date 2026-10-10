import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { RequireAuth } from './components/RequireAuth';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { ConnectRepoPage } from './pages/ConnectRepoPage';
import { WebhookSetupPage } from './pages/WebhookSetupPage';
import { PickCharacterPage } from './pages/PickCharacterPage';
import { PetViewPage } from './pages/PetViewPage';
import { StyleGuidePage } from './pages/StyleGuidePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { Layout } from './components/Layout';
import { AuthProvider } from './auth/AuthContext';

export const App = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<Layout />}>
            {/* Public */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/styleguide" element={<StyleGuidePage />} />

            {/* Protected: must be logged in */}
            <Route element={<RequireAuth />}>
              <Route path="/" element={<Navigate to="/connect" replace />} />
              <Route path="/connect" element={<ConnectRepoPage />} />
              <Route path="/repos/:repoId/webhook" element={<WebhookSetupPage />} />
              <Route path="/repos/:repoId/pick-character" element={<PickCharacterPage />} />
              <Route path="/repos/:repoId" element={<PetViewPage />} />
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
};
