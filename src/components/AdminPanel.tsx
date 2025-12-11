import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { storage } from '../utils/storage';
import { api } from '../utils/api';
import './AdminPanel.css';

export const AdminPanel = () => {
  const { isAdminMode } = useAuth();
  const [isDeleting, setIsDeleting] = useState(false);
  const [message, setMessage] = useState('');

  if (!isAdminMode) {
    return null;
  }

  const [isExporting, setIsExporting] = useState(false);

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

  const handleExportLoginJson = async () => {
    setIsExporting(true);
    setMessage('Export en cours...');
    
    try {
      const response = await fetch('/api/users?exportJson=true');
      const entries = await response.json();
      
      // Créer un blob et télécharger le fichier
      const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'login.json';
      link.click();
      URL.revokeObjectURL(url);
      
      setMessage(`✅ Export réussi : ${entries.length} utilisateur(s) exporté(s). Téléchargez login.json et placez-le à la racine du projet.`);
    } catch (error: any) {
      console.error('Error exporting login.json:', error);
      setMessage(`Erreur lors de l'export: ${error.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="admin-panel">
      <h3>Panneau Administrateur</h3>
      <div className="admin-actions">
        <button
          className="admin-button export-button"
          onClick={handleExportLoginJson}
          disabled={isExporting}
        >
          {isExporting ? 'Export...' : '📥 Exporter vers login.json'}
        </button>
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

