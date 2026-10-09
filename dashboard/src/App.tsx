import { BrowserRouter, Routes, Route } from 'react-router';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { ConnectRepoPage } from './pages/ConnectRepoPage';
import { WebhookSetupPage } from './pages/WebhookSetupPage';
import { PickCharacterPage } from './pages/PickCharacterPage';
import { PetViewPage } from './pages/PetViewPage';
import { StyleGuidePage } from './pages/StyleGuidePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { Layout } from './components/Layout';

export const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/connect" element={<ConnectRepoPage />} />
          <Route path="/repos/:repoId/webhook" element={<WebhookSetupPage />} />
          <Route path="/repos/:repoId/pick-character" element={<PickCharacterPage />} />
          <Route path="/repos/:repoId" element={<PetViewPage />} />
          <Route path="/styleguide" element={<StyleGuidePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};
