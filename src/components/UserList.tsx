import { useState, useEffect } from 'react';
import { storage } from '../utils/storage';
import { User } from '../types/database';
import './UserList.css';

export function UserList() {
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
    <div className="user-list-container">
      <h2>Liste des utilisateurs</h2>
      <button onClick={loadUsers} className="refresh-button">🔄 Actualiser</button>
      
      {error && <div className="error-message">{error}</div>}
      
      {loading ? (
        <p>Chargement...</p>
      ) : users.length === 0 ? (
        <p>Aucun utilisateur trouvé.</p>
      ) : (
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
      )}
      
      <div className="debug-info">
        <h3>Informations de débogage</h3>
        <p><strong>ID utilisateur actuel (localStorage):</strong> {storage.getCurrentUserId() || 'Aucun'}</p>
        <p><strong>Utilisateur en cache:</strong> {storage.getCurrentUserFromCache() ? 'Oui' : 'Non'}</p>
        {storage.getCurrentUserFromCache() && (
          <div className="cached-user-details">
            <p>Email: {storage.getCurrentUserFromCache()?.email}</p>
            <p>Mot de passe: {storage.getCurrentUserFromCache()?.password}</p>
          </div>
        )}
      </div>
    </div>
  );
}
