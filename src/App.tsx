import { useState, useEffect } from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { WelcomeScreen } from './components/WelcomeScreen';
import { LoginScreen } from './components/LoginScreen';
import { NavigationBar } from './components/NavigationBar';
import { DataEditor } from './components/DataEditor';
import { storage } from './utils/storage';
import { initializeDefaultStructure, mergeDefaultFieldsWithExisting } from './utils/storage';
import './App.css';

const AppContent = () => {
  const { user, setUser } = useAuth();
  const [showDataEditor, setShowDataEditor] = useState(true); // Toujours afficher l'éditeur
  const [showImport, setShowImport] = useState(false);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [pendingChoice, setPendingChoice] = useState<'cv' | 'zero' | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialiser showWelcome selon l'état de l'utilisateur
  useEffect(() => {
    // Attendre un peu pour que l'auth se charge
    const timer = setTimeout(() => {
      if (user === null || user === undefined) {
        // Utilisateur non connecté - afficher le welcome
        setShowWelcome(true);
        setIsLoading(false);
      } else if (user) {
        // Utilisateur connecté - masquer le welcome
        setShowWelcome(false);
        setIsLoading(false);
      }
    }, 100);
    
    return () => clearTimeout(timer);
  }, [user]);

  useEffect(() => {
    if (user) {
      if (!user.data || user.data.length === 0) {
        // Initialiser la structure par défaut si l'utilisateur n'a pas de données
        const defaultData = initializeDefaultStructure();
        const updatedUser = { ...user, data: defaultData };
        storage.saveUser(updatedUser).catch(error => {
          console.error('Error initializing default structure:', error);
        });
      } else {
        // Fusionner les nouveaux champs par défaut avec les données existantes
        const mergedData = mergeDefaultFieldsWithExisting(user.data);
        if (mergedData.length > user.data.length) {
          // Il y a de nouveaux champs à ajouter
          const updatedUser = { ...user, data: mergedData };
          storage.saveUser(updatedUser).catch(error => {
            console.error('Error merging default fields:', error);
          });
        }
      }
    }
  }, [user]);

  // Si l'utilisateur vient de s'inscrire et qu'il y a un choix en attente
  useEffect(() => {
    if (user && pendingChoice) {
      setShowLogin(false);
      setShowWelcome(false);
      // Attendre un peu pour s'assurer que tout est bien chargé
      setTimeout(() => {
        if (pendingChoice === 'cv') {
          setShowImport(true);
          setPendingChoice(null);
        } else {
          // Partir de zéro - initialiser avec structure par défaut
          if (!user.data || user.data.length === 0) {
            const defaultData = initializeDefaultStructure();
            const updatedUser = { ...user, data: defaultData };
            storage.saveUser(updatedUser).then(saved => {
              setUser(saved);
              setShowDataEditor(true);
              setPendingChoice(null);
            }).catch(error => {
              console.error('Error saving default structure:', error);
              // Afficher l'éditeur même en cas d'erreur
              setShowDataEditor(true);
              setPendingChoice(null);
            });
          } else {
            setShowDataEditor(true);
            setPendingChoice(null);
          }
        }
      }, 300);
    }
  }, [user, pendingChoice, setUser]);

  const handleWelcomeChoice = (hasCV: boolean) => {
    // Si l'utilisateur n'est pas connecté, demander de créer un compte
    if (!user) {
      setPendingChoice(hasCV ? 'cv' : 'zero');
      setShowWelcome(false);
      setShowLogin(true);
    } else {
      // Utilisateur connecté, procéder directement
      setShowWelcome(false);
      if (hasCV) {
        setShowImport(true);
      } else {
        // Partir de zéro - initialiser avec structure par défaut
        if (user.data.length === 0) {
          const defaultData = initializeDefaultStructure();
          const updatedUser = { ...user, data: defaultData };
          storage.saveUser(updatedUser);
        }
        setShowDataEditor(true);
      }
    }
  };


  // Afficher un loader pendant le chargement initial
  if (isLoading) {
    return (
      <div className="app">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
          <p>Chargement...</p>
        </div>
      </div>
    );
  }

  // Afficher l'écran de login si demandé
  if (showLogin && !user) {
    return <LoginScreen onClose={() => {
      setShowLogin(false);
      setShowWelcome(true); // Revenir au welcome si on ferme le login
      setPendingChoice(null);
    }} />;
  }

  // Afficher l'écran de bienvenue pour les non-connectés
  if (!user && !showLogin) {
    return <WelcomeScreen onChoice={handleWelcomeChoice} />;
  }

  // Afficher l'écran de login si demandé
  if (showLogin && !user) {
    return <LoginScreen onClose={() => {
      setShowLogin(false);
      setPendingChoice(null);
    }} />;
  }

  // Si l'utilisateur n'est pas connecté, ne rien afficher d'autre
  if (!user) {
    return null;
  }

  return (
    <div className="app">
      <NavigationBar
        onModuleClick={() => {}}
        onAIClick={() => setShowAIPanel(true)}
        onImportClick={() => setShowImport(!showImport)}
      />
      <div className="app-content" style={{ marginTop: '50px' }}>
        {showDataEditor && user && (
          <DataEditor 
            showImport={showImport}
            onImportClose={() => setShowImport(false)}
          />
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
