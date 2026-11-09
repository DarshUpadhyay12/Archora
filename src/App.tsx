import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from '@/layouts/AppLayout';
import { ProtectedRoute } from '@/components/common/ProtectedRoute';
import { Home } from '@/pages/Home';
import { Features } from '@/pages/Features';
import { HowItWorks } from '@/pages/HowItWorks';
import { ArchitectureTutor } from '@/pages/ArchitectureTutor';
import { DesignConceptGenerator } from '@/pages/DesignConceptGenerator';
import { JuryPortfolioAssistant } from '@/pages/JuryPortfolioAssistant';
import { ProjectLibrary } from '@/pages/ProjectLibrary';
import { AIHistory } from '@/pages/AIHistory';
import { FileLibrary } from '@/pages/FileLibrary';
import { GalleryShowcase } from '@/pages/GalleryShowcase';
import { About } from '@/pages/About';
import { LoginSignUp } from '@/pages/LoginSignUp';
import { ProfileSettings } from '@/pages/ProfileSettings';
import { Contact } from '@/pages/Contact';
import { VastuVision } from '@/pages/VastuVision';
import { storageService } from '@/services/storageService';

const LogoutAction: React.FC = () => {
  React.useEffect(() => {
    storageService.logout();
  }, []);
  return <Navigate to="/login" replace />;
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppLayout />}>
          {/* Public Authentication Route */}
          <Route path="login" element={<LoginSignUp />} />
          <Route path="logout" element={<LogoutAction />} />

          {/* Protected Studio Routes — First page is /login if unauthenticated */}
          <Route
            index
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            }
          />
          <Route
            path="features"
            element={
              <ProtectedRoute>
                <Features />
              </ProtectedRoute>
            }
          />
          <Route
            path="how-it-works"
            element={
              <ProtectedRoute>
                <HowItWorks />
              </ProtectedRoute>
            }
          />
          <Route
            path="tutor"
            element={
              <ProtectedRoute>
                <ArchitectureTutor />
              </ProtectedRoute>
            }
          />
          <Route
            path="concepts"
            element={
              <ProtectedRoute>
                <DesignConceptGenerator />
              </ProtectedRoute>
            }
          />
          <Route
            path="vastu"
            element={
              <ProtectedRoute>
                <VastuVision />
              </ProtectedRoute>
            }
          />
          <Route
            path="portfolio"
            element={
              <ProtectedRoute>
                <JuryPortfolioAssistant />
              </ProtectedRoute>
            }
          />
          <Route
            path="projects"
            element={
              <ProtectedRoute>
                <ProjectLibrary />
              </ProtectedRoute>
            }
          />
          <Route
            path="history"
            element={
              <ProtectedRoute>
                <AIHistory />
              </ProtectedRoute>
            }
          />
          <Route
            path="files"
            element={
              <ProtectedRoute>
                <FileLibrary />
              </ProtectedRoute>
            }
          />
          <Route
            path="gallery"
            element={
              <ProtectedRoute>
                <GalleryShowcase />
              </ProtectedRoute>
            }
          />
          <Route
            path="about"
            element={
              <ProtectedRoute>
                <About />
              </ProtectedRoute>
            }
          />
          <Route
            path="profile"
            element={
              <ProtectedRoute>
                <ProfileSettings />
              </ProtectedRoute>
            }
          />
          <Route
            path="contact"
            element={
              <ProtectedRoute>
                <Contact />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default App;
