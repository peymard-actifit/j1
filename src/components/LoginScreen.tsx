import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './LoginScreen.css';

interface LoginScreenProps {
  onClose?: () => void;
}

export const LoginScreen = ({ onClose }: LoginScreenProps) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const { login, register } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      if (isLogin) {
        console.log('Login attempt:', { email, hasPassword: !!password });
        const success = await login(email, password);
        console.log('Login result:', success);
        if (!success) {
          setError('Email ou mot de passe incorrect. Vérifiez vos identifiants ou créez un nouveau compte.');
        } else if (onClose) {
          onClose();
        }
      } else {
        console.log('Registration attempt:', { email, name, hasPassword: !!password });
        await register(email, password, name);
        console.log('Registration successful');
        if (onClose) {
          onClose();
        }
      }
    } catch (err: any) {
      console.error('Login/Register error:', err);
      setError(err.message || 'Une erreur est survenue');
    }
  };

  return (
    <div className="login-screen">
      <div className="login-content">
        <h1 className="login-title">JustOne</h1>
        <p className="login-subtitle">
          {isLogin ? 'Connexion' : 'Créer un compte'}
        </p>

        <form onSubmit={handleSubmit} className="login-form">
          {!isLogin && (
            <div className="form-group">
              <label>Nom</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          )}
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div className="form-group">
            <label>Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isLogin ? "current-password" : "new-password"}
              required
            />
          </div>
          {error && <div className="error-message">{error}</div>}
          <button type="submit" className="submit-button">
            {isLogin ? 'Se connecter' : 'Créer un compte'}
          </button>
        </form>

        <button
          className="switch-mode-button"
          onClick={() => {
            setIsLogin(!isLogin);
            setError('');
          }}
        >
          {isLogin
            ? "Pas encore de compte ? S'inscrire"
            : 'Déjà un compte ? Se connecter'}
        </button>
        {onClose && (
          <button
            className="switch-mode-button"
            onClick={onClose}
            style={{ marginTop: '0.5rem' }}
          >
            Retour
          </button>
        )}
      </div>
    </div>
  );
};

