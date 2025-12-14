import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types/database';
import { storage } from '../utils/storage';

interface AuthContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  login: (email: string, password: string) => Promise<User | null>;
  logout: () => void;
  register: (email: string, password: string, name: string) => Promise<User | null>;
  enterAdminMode: (code: string) => boolean;
  isAdminMode: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdminMode, setIsAdminMode] = useState(false);

  useEffect(() => {
    // Charger l'utilisateur depuis le stockage local
    const userId = storage.getCurrentUserId();
    if (userId) {
      storage.getUser(userId)
        .then(loadedUser => {
          if (loadedUser) {
            setUser(loadedUser);
          }
        })
        .catch(() => {
          // Utilisateur non trouvé, déconnexion
          storage.setCurrentUser(null);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string): Promise<User | null> => {
    try {
      const foundUser = await storage.getUserByEmail(email);
      if (foundUser && foundUser.password === password) {
        setUser(foundUser);
        storage.setCurrentUser(foundUser);
        return foundUser;
      }
      return null;
    } catch (error) {
      console.error('Login error:', error);
      return null;
    }
  };

  const logout = () => {
    setUser(null);
    storage.setCurrentUser(null);
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
      setUser(savedUser);
      storage.setCurrentUser(savedUser);
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

  if (loading) {
    return null;
  }

  return (
    <AuthContext.Provider value={{ user, setUser, login, logout, register, enterAdminMode, isAdminMode }}>
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
