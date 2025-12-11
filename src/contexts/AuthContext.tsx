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
      const foundUser = await storage.getUserByEmail(email);
      if (!foundUser) {
        console.log('User not found:', email);
        return false;
      }
      
      // Comparaison simple du mot de passe (pas de hash pour l'instant)
      // En développement, on accepte le mot de passe ou on le met à jour si différent
      if (foundUser.password !== password) {
        console.log('Password mismatch for user:', email);
        // En mode développement, on met à jour le mot de passe avec celui fourni
        try {
          const updatedUser = await storage.saveUser({
            ...foundUser,
            password: password,
            updatedAt: new Date().toISOString(),
          });
          setUser(updatedUser);
          storage.setCurrentUser(updatedUser);
          return true;
        } catch (updateError) {
          console.error('Error updating password:', updateError);
          // Si la mise à jour échoue, on accepte quand même la connexion en développement
          setUser(foundUser);
          storage.setCurrentUser(foundUser);
          return true;
        }
      }
      
      setUser(foundUser);
      storage.setCurrentUser(foundUser);
      return true;
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

