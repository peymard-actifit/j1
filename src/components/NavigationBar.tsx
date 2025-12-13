import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { AdminPanel } from './AdminPanel';
import './NavigationBar.css';

interface NavigationBarProps {
  onModuleClick: (module: string) => void;
  onAIClick: () => void;
  onImportClick: () => void;
}

const MODULES = [
  { id: 'justpush', name: 'JustPush', icon: '📤' },
  { id: 'justweb', name: 'JustWeb', icon: '🌐' },
  { id: 'justboost', name: 'JustBoost', icon: '🚀' },
  { id: 'justfind', name: 'JustFind', icon: '🔍' },
  { id: 'jobdone', name: 'JobDone', icon: '✅' },
  { id: 'justrpa', name: 'JustRPA', icon: '🤖' },
];

// Récupérer la version depuis package.json
const APP_VERSION = import.meta.env.VITE_APP_VERSION || '1.67.0';

export const NavigationBar = ({ onModuleClick, onAIClick, onImportClick }: NavigationBarProps) => {
  const { user, logout } = useAuth();
  const [showMenu, setShowMenu] = useState(false);
  const [showAdminPrompt, setShowAdminPrompt] = useState(false);
  const [adminCode, setAdminCode] = useState('');
  const { enterAdminMode, isAdminMode: adminMode } = useAuth();

  const handleAdminSubmit = () => {
    if (enterAdminMode(adminCode)) {
      setShowAdminPrompt(false);
      setAdminCode('');
    } else {
      alert('Code administrateur incorrect');
    }
  };

  return (
    <>
      <nav className="navigation-bar">
        <div className="nav-left-section">
          <button className="nav-import-button" onClick={onImportClick} title="Importer un CV">
            📄 Importer
          </button>
          <div className="nav-modules">
            {MODULES.map(module => (
              <button
                key={module.id}
                className="nav-module-button"
                onClick={() => onModuleClick(module.id)}
                title={module.name}
              >
                <span className="nav-module-icon">{module.icon}</span>
                <span className="nav-module-name">{module.name}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="nav-right-section">
          <span className="nav-version">v{APP_VERSION}</span>
          <button className="nav-ai-button" onClick={onAIClick} title="IA">
            🤖 IA
          </button>
          <div className="user-menu">
            <button
              className="user-menu-button"
              onClick={() => setShowMenu(!showMenu)}
            >
              {user?.name || 'Menu'} ▼
            </button>
            {showMenu && (
              <div className="user-menu-dropdown">
                <button onClick={() => {/* Modifier password */}}>
                  Modifier le mot de passe
                </button>
                <button onClick={() => setShowAdminPrompt(true)}>
                  Passer administrateur
                </button>
                {adminMode && (
                  <div className="admin-badge">Mode Admin Actif</div>
                )}
                <button onClick={logout}>Déconnexion</button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {adminMode && (
        <AdminPanel />
      )}

      {showAdminPrompt && (
        <div className="admin-prompt-overlay">
          <div className="admin-prompt">
            <h3>Code administrateur</h3>
            <input
              type="password"
              value={adminCode}
              onChange={(e) => setAdminCode(e.target.value)}
              placeholder="Entrez le code"
              onKeyPress={(e) => e.key === 'Enter' && handleAdminSubmit()}
            />
            <div className="admin-prompt-actions">
              <button onClick={() => setShowAdminPrompt(false)}>Annuler</button>
              <button onClick={handleAdminSubmit}>Valider</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

