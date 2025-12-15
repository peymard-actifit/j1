import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types/database';
import { storage } from '../utils/storage';

interface AuthContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  updateUser: (user: User) => void; // Fonction helper qui met à jour user ET cache
  login: (email: string, password: string) => Promise<User | null>;
  logout: () => void;
  register: (email: string, password: string, name: string) => Promise<User | null>;
  enterAdminMode: (code: string) => boolean;
  isAdminMode: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdminMode, setIsAdminMode] = useState(false);

  // Wrapper pour setUser qui met automatiquement à jour le cache
  const setUser = (newUser: User | null) => {
    setUserState(newUser);
    if (newUser) {
      storage.setCurrentUserInCache(newUser);
    } else {
      storage.clearCurrentUserCache();
    }
  };

  useEffect(() => {
    // Charger l'utilisateur depuis le stockage local
    const userId = storage.getCurrentUserId();
    if (userId) {
      // Essayer d'abord de charger depuis localStorage (fallback)
      const cachedUser = storage.getCurrentUserFromCache();
      if (cachedUser) {
        setUser(cachedUser);
        setLoading(false);
        // En arrière-plan, essayer de mettre à jour depuis l'API
      storage.getUser(userId)
        .then(loadedUser => {
          if (loadedUser) {
            setUser(loadedUser); // setUser met déjà à jour le cache
          }
        })
          .catch(() => {
            // Si l'API échoue, on garde l'utilisateur en cache
            console.warn('Impossible de charger l\'utilisateur depuis l\'API, utilisation du cache');
          });
      } else {
        // Pas de cache, essayer depuis l'API
        storage.getUser(userId)
          .then(loadedUser => {
            if (loadedUser) {
              setUser(loadedUser); // setUser met déjà à jour le cache
            } else {
              // Utilisateur non trouvé, déconnexion
              storage.setCurrentUser(null);
            }
          })
          .catch(() => {
            // Erreur API, déconnexion
            console.error('Erreur lors du chargement de l\'utilisateur');
            storage.setCurrentUser(null);
          })
          .finally(() => {
            setLoading(false);
          });
      }
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string): Promise<User | null> => {
    try {
      // Essayer d'abord depuis l'API
      let foundUser = await storage.getUserByEmail(email);
      
      // Si l'API échoue, essayer depuis le cache localStorage
      if (!foundUser) {
        const cachedUser = storage.getCurrentUserFromCache();
        if (cachedUser && cachedUser.email.toLowerCase() === email.toLowerCase()) {
          foundUser = cachedUser;
        }
      }
      
      // Vérifier le mot de passe
      if (foundUser && foundUser.password === password) {
        storage.setCurrentUser(foundUser);
        setUser(foundUser); // setUser met déjà à jour le cache
        return foundUser;
      }
      
      // Si aucun utilisateur trouvé, retourner null
      return null;
    } catch (error) {
      console.error('Login error:', error);
      // En cas d'erreur, essayer depuis le cache
      try {
        const cachedUser = storage.getCurrentUserFromCache();
        if (cachedUser && cachedUser.email.toLowerCase() === email.toLowerCase() && cachedUser.password === password) {
          storage.setCurrentUser(cachedUser);
          setUser(cachedUser);
          return cachedUser;
        }
      } catch (cacheError) {
        console.error('Cache error:', cacheError);
      }
      return null;
    }
  };

  const logout = () => {
    setUser(null);
    storage.setCurrentUser(null);
    storage.clearCurrentUserCache();
  };

  const register = async (email: string, password: string, name: string): Promise<User | null> => {
    try {
      const newUser: User = {
        id: Date.now().toString(),
        email,
        password, // En production, devrait être hashé
        name,
        baseLanguage: 'fr',
        isAdmin: false,
        data: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const savedUser = await storage.saveUser(newUser);
      storage.setCurrentUser(savedUser);
      setUser(savedUser); // setUser met déjà à jour le cache
      return savedUser;
    } catch (error) {
      console.error('Register error:', error);
      return null;
    }
  };

  const enterAdminMode = (code: string): boolean => {
    if (user?.isAdmin && user?.adminCode === code) {
      setIsAdminMode(true);
      return true;
    }
    return false;
  };

  // Fonction helper pour mettre à jour l'utilisateur ET le cache
  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
    storage.setCurrentUserInCache(updatedUser);
  };

  if (loading) {
    return null;
  }

  return (
    <AuthContext.Provider value={{ user, setUser, updateUser, login, logout, register, enterAdminMode, isAdminMode }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
