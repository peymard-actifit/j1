import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { storage } from '../utils/storage';
import './AdminPanel.css';

export const AdminPanel = () => {
  const { isAdminMode } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);
  const [message, setMessage] = useState('');

  if (!isAdminMode) {
    return null;
  }

  const handleDeleteAllUsers = async () => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer TOUS les utilisateurs ? Cette action est irréversible !')) {
      return;
    }

    setIsDeleting(true);
    setMessage('Suppression en cours...');
    
    try {
      await storage.deleteAllUsers();
      // Nettoyer aussi le localStorage
      localStorage.removeItem('j1_current_user');
      setMessage('Tous les utilisateurs ont été supprimés avec succès. Vous pouvez maintenant créer un nouveau compte.');
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error: any) {
      console.error('Error deleting users:', error);
      setMessage(`Erreur lors de la suppression: ${error.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="admin-panel">
      <h3>Panneau Administrateur</h3>
      <div className="admin-actions">
        <button
          className="admin-button delete-all-button"
          onClick={handleDeleteAllUsers}
          disabled={isDeleting}
        >
          {isDeleting ? 'Suppression...' : 'Supprimer tous les utilisateurs'}
        </button>
        {message && (
          <div className={`admin-message ${message.includes('Erreur') ? 'error' : 'success'}`}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
};

