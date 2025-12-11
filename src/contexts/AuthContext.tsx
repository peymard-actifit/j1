import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types/database';
import { storage } from '../utils/storage';

interface AuthContextType {
  user: User | null;
  setUser: (user: User | null) => void;
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
    const loadCurrentUser = async () => {
      const userId = storage.getCurrentUserId();
      if (userId) {
        try {
          const user = await storage.getUser(userId);
          if (user) {
            setUser(user);
          }
        } catch (error) {
          console.error('Error loading user:', error);
          storage.setCurrentUser(null);
        }
      }
    };
    loadCurrentUser();
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const foundUser = await storage.getUserByEmail(email);
      if (foundUser && foundUser.password === password) { // TODO: hash password
        setUser(foundUser);
        storage.setCurrentUser(foundUser);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    setIsAdminMode(false);
    storage.setCurrentUser(null);
  };

  const register = async (email: string, password: string, name: string): Promise<User> => {
    try {
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
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

      const savedUser = await storage.saveUser(newUser);
      setUser(savedUser);
      storage.setCurrentUser(savedUser);
      return savedUser;
    } catch (error: any) {
      throw error;
    }
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
        setUser,
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

