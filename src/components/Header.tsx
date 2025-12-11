import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './Header.css';

interface HeaderProps {
  onEditClick: () => void;
}

export const Header = ({ onEditClick }: HeaderProps) => {
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
    <header className="app-header">
      <div className="header-left">
        <button className="edit-button" onClick={onEditClick}>
          ✏️ Édition
        </button>
        <span className="user-name">{user?.name || 'Utilisateur'}</span>
      </div>

      <div className="header-right">
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
    </header>
  );
};

