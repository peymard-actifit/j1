import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types/database';
import { storage } from '../utils/storage';

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  register: (email: string, password: string, name: string) => Promise<User>;
  isAdmin: boolean;
  enterAdminMode: (code: string) => boolean;
  isAdminMode: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ADMIN_CODE = '12411241';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isAdminMode, setIsAdminMode] = useState(false);

  useEffect(() => {
    const currentUser = storage.getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
    }
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    const foundUser = storage.getUserByEmail(email);
    if (foundUser && foundUser.password === password) { // TODO: hash password
      setUser(foundUser);
      storage.setCurrentUser(foundUser);
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    setIsAdminMode(false);
    storage.setCurrentUser(null);
  };

  const register = async (email: string, password: string, name: string): Promise<User> => {
    const users = storage.getUsers();
    if (users.find(u => u.email === email)) {
      throw new Error('Cet email est déjà utilisé');
    }

    const newUser: User = {
      id: Date.now().toString(),
      email,
      password, // TODO: hash password
      name,
      baseLanguage: 'fr',
      isAdmin: false,
      data: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    storage.saveUser(newUser);
    setUser(newUser);
    storage.setCurrentUser(newUser);
    return newUser;
  };

  const enterAdminMode = (code: string): boolean => {
    if (code === ADMIN_CODE && user) {
      setIsAdminMode(true);
      return true;
    }
    return false;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        register,
        isAdmin: user?.isAdmin || false,
        enterAdminMode,
        isAdminMode,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

