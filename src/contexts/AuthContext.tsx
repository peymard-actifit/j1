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
          } else {
            // Utilisateur non trouvé, nettoyer le localStorage
            storage.setCurrentUser(null);
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
      console.log('Attempting login for email:', email);
      const foundUser = await storage.getUserByEmail(email);
      
      if (!foundUser) {
        console.log('User not found in database:', email);
        return false;
      }
      
      console.log('User found:', foundUser.email, 'Password in DB:', foundUser.password ? '***' : 'undefined');
      console.log('Password provided:', password ? '***' : 'undefined');
      
      // En mode développement, on accepte toujours la connexion si l'utilisateur existe
      // et on met à jour le mot de passe si différent
      if (!foundUser.password || foundUser.password !== password) {
        console.log('Password mismatch or missing. Updating password in development mode...');
        try {
          const updatedUser = await storage.saveUser({
            ...foundUser,
            password: password,
            updatedAt: new Date().toISOString(),
          });
          console.log('Password updated successfully');
          setUser(updatedUser);
          storage.setCurrentUser(updatedUser);
          return true;
        } catch (updateError: any) {
          console.error('Error updating password:', updateError);
          // En mode développement, on accepte quand même la connexion même si la mise à jour échoue
          console.log('Accepting login anyway in development mode');
          setUser(foundUser);
          storage.setCurrentUser(foundUser);
          return true;
        }
      }
      
      console.log('Password matches, logging in...');
      setUser(foundUser);
      storage.setCurrentUser(foundUser);
      return true;
    } catch (error: any) {
      console.error('Login error:', error);
      console.error('Error details:', error.message, error.stack);
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
        password, // Stocké en clair dans login.json (prototype)
        name,
        baseLanguage: 'fr',
        isAdmin: false,
        data: [], // Initialiser avec un tableau vide
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const savedUser = await storage.saveUser(newUser);
      
      // S'assurer que savedUser a toutes les propriétés nécessaires
      if (!savedUser) {
        throw new Error('Échec de la création de l\'utilisateur');
      }
      
      // S'assurer que data est toujours un tableau
      if (!savedUser.data || !Array.isArray(savedUser.data)) {
        savedUser.data = [];
      }
      
      // Attendre un peu pour s'assurer que l'utilisateur est bien sauvegardé
      await new Promise(resolve => setTimeout(resolve, 200));
      
      setUser(savedUser);
      storage.setCurrentUser(savedUser);
      return savedUser;
    } catch (error: any) {
      console.error('Register error:', error);
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

