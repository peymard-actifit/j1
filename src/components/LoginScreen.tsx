import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './LoginScreen.css';

interface LoginScreenProps {
  onClose: () => void;
}

export function LoginScreen({ onClose }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState('');
  const { login, register } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      if (isRegister) {
        if (!name.trim()) {
          setError('Le nom est requis');
          return;
        }
        const user = await register(email, password, name);
        if (user) {
          onClose();
        } else {
          setError('Erreur lors de l\'inscription');
        }
      } else {
        const user = await login(email, password);
        if (user) {
          onClose();
        } else {
          setError('Email ou mot de passe incorrect');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Une erreur s\'est produite');
    }
  };

  return (
    <div className="login-screen-overlay">
      <div className="login-screen">
        <button className="close-btn" onClick={onClose}>✕</button>
        <h2>{isRegister ? 'Inscription' : 'Connexion'}</h2>
        <form onSubmit={handleSubmit}>
          {isRegister && (
            <input
              type="text"
              placeholder="Nom"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Mot de passe"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <div className="error-message">{error}</div>}
          <button type="submit" className="submit-btn">
            {isRegister ? 'S\'inscrire' : 'Se connecter'}
          </button>
          <button
            type="button"
            className="toggle-mode-btn"
            onClick={() => setIsRegister(!isRegister)}
          >
            {isRegister ? 'Déjà un compte ? Se connecter' : 'Pas de compte ? S\'inscrire'}
          </button>
        </form>
      </div>
    </div>
  );
}
