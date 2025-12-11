import { useState, useEffect } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { WelcomeScreen } from './components/WelcomeScreen';
import { CVUpload } from './components/CVUpload';
import { LoginScreen } from './components/LoginScreen';
import { Header } from './components/Header';
import { NavigationBar } from './components/NavigationBar';
import { DataEditor } from './components/DataEditor';
import { storage } from './utils/storage';
import { initializeDefaultStructure } from './utils/storage';
import './App.css';

const AppContent = () => {
  const { user } = useAuth();
  const [showWelcome, setShowWelcome] = useState(false);
  const [showCVUpload, setShowCVUpload] = useState(false);
  const [showDataEditor, setShowDataEditor] = useState(false);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [currentModule, setCurrentModule] = useState<string | null>(null);

  useEffect(() => {
    if (user && user.data.length === 0) {
      // Initialiser la structure par défaut si l'utilisateur n'a pas de données
      const defaultData = initializeDefaultStructure();
      const updatedUser = { ...user, data: defaultData };
      storage.saveUser(updatedUser);
    }
  }, [user]);

  if (!user) {
    return <LoginScreen />;
  }

  const handleWelcomeChoice = (hasCV: boolean) => {
    setShowWelcome(false);
    if (hasCV) {
      setShowCVUpload(true);
    } else {
      // Partir de zéro - initialiser avec structure par défaut
      if (user.data.length === 0) {
        const defaultData = initializeDefaultStructure();
        const updatedUser = { ...user, data: defaultData };
        storage.saveUser(updatedUser);
      }
      setShowDataEditor(true);
    }
  };

  const handleCVAnalysisComplete = (_data: any) => {
    setShowCVUpload(false);
    // TODO: Intégrer les données analysées dans la base de données utilisateur
    setShowDataEditor(true);
  };

  return (
    <div className="app">
      <NavigationBar
        onModuleClick={(module) => setCurrentModule(module)}
        onAIClick={() => setShowAIPanel(true)}
      />
      <div className="app-content" style={{ marginTop: '50px' }}>
        <Header
          onEditClick={() => setShowDataEditor(true)}
          onAIClick={() => setShowAIPanel(true)}
        />

        {showWelcome && (
          <WelcomeScreen onChoice={handleWelcomeChoice} />
        )}

        {!showWelcome && !showCVUpload && !showDataEditor && (
          <div className="main-dashboard">
            <h1>Bienvenue, {user.name} !</h1>
            <p>Gérez vos données CV et générez des CVs personnalisés.</p>
            
            <div className="dashboard-actions">
              <button
                className="dashboard-button"
                onClick={() => setShowWelcome(true)}
              >
                Nouveau CV
              </button>
              <button
                className="dashboard-button"
                onClick={() => setShowDataEditor(true)}
              >
                Éditer mes données
              </button>
            </div>

            {currentModule && (
              <div className="module-view">
                <h2>Module: {currentModule}</h2>
                <p>Fonctionnalité en développement...</p>
              </div>
            )}
          </div>
        )}

        {showCVUpload && (
          <CVUpload
            onAnalysisComplete={handleCVAnalysisComplete}
            onCancel={() => setShowCVUpload(false)}
          />
        )}

        {showDataEditor && (
          <DataEditor onClose={() => setShowDataEditor(false)} />
        )}

        {showAIPanel && (
          <div className="ai-panel-overlay">
            <div className="ai-panel">
              <div className="ai-panel-header">
                <h2>Assistant IA</h2>
                <button onClick={() => setShowAIPanel(false)}>✕</button>
              </div>
              <div className="ai-panel-content">
                <p>Fonctionnalités IA disponibles :</p>
                <ul>
                  <li>Analyse de CV</li>
                  <li>Adaptation à une offre d'emploi</li>
                  <li>Optimisation pour parsing IA</li>
                  <li>Création de CV depuis un exemple</li>
                  <li>Recherche d'offres d'emploi</li>
                  <li>Conseils d'amélioration (JustBoost)</li>
                  <li>Et plus...</li>
                </ul>
                <p className="coming-soon">Interface en développement...</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}

export default App;
