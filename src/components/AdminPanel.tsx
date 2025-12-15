import { useState, useEffect } from 'react';
import { storage } from '../utils/storage';
import { User } from '../types/database';
import './AdminPanel.css';

export function AdminPanel() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    setError('');
    try {
      // Essayer depuis l'API
      const apiUsers = await storage.getUsers();
      if (apiUsers && apiUsers.length > 0) {
        setUsers(apiUsers);
      } else {
        // Si l'API ne retourne rien, charger depuis le cache localStorage
        const cachedUser = storage.getCurrentUserFromCache();
        if (cachedUser) {
          setUsers([cachedUser]);
        } else {
          setUsers([]);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Erreur lors du chargement');
      // En cas d'erreur, charger depuis le cache
      const cachedUser = storage.getCurrentUserFromCache();
      if (cachedUser) {
        setUsers([cachedUser]);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-panel">
      <h2>Panneau d'administration</h2>
      <div className="admin-section">
        <h3>Liste des utilisateurs</h3>
        {error && <div className="error-message">{error}</div>}
        {loading ? (
          <p>Chargement...</p>
        ) : users.length === 0 ? (
          <p>Aucun utilisateur trouvé.</p>
        ) : (
          <div className="users-list">
            <table className="users-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nom</th>
                  <th>Email</th>
                  <th>Mot de passe</th>
                  <th>Langue</th>
                  <th>Admin</th>
                  <th>Nb champs</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id}>
                    <td className="id-cell">{user.id}</td>
                    <td>{user.name}</td>
                    <td>{user.email}</td>
                    <td className="password-cell">{user.password}</td>
                    <td>{user.baseLanguage}</td>
                    <td>{user.isAdmin ? 'Oui' : 'Non'}</td>
                    <td>{user.data?.length || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <button onClick={loadUsers} className="refresh-button">🔄 Actualiser</button>
        
        <div className="debug-info">
          <h4>Informations de débogage</h4>
          <p><strong>ID utilisateur actuel (localStorage):</strong> {storage.getCurrentUserId() || 'Aucun'}</p>
          <p><strong>Utilisateur en cache:</strong> {storage.getCurrentUserFromCache() ? 'Oui' : 'Non'}</p>
          {storage.getCurrentUserFromCache() && (
            <div className="cached-user-details">
              <p><strong>Email:</strong> {storage.getCurrentUserFromCache()?.email}</p>
              <p><strong>Mot de passe:</strong> {storage.getCurrentUserFromCache()?.password}</p>
              <p><strong>Nom:</strong> {storage.getCurrentUserFromCache()?.name}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
