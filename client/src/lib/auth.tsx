import { createContext, useState, useEffect, ReactNode } from "react";
import { apiRequest } from "./queryClient";

interface User {
  id: number;
  username: string;
  name: string;
  role: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  login: (username: string, password: string, rememberMe?: boolean) => Promise<void>;
  logout: () => Promise<void>;
}

interface AuthResponse {
  authenticated: boolean;
  user?: User;
  success?: boolean;
  message?: string;
}

export const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  isLoading: true,
  user: null,
  login: async () => {},
  logout: async () => {},
});

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Check if the user is authenticated on initial load
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const response = await apiRequest("GET", "/api/user");
        const userData = await response.json();
        setUser(userData);
      } catch (error) {
        console.error("Auth status check failed:", error);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAuthStatus();
  }, []);

  // Login function
  const login = async (username: string, password: string, rememberMe: boolean = false) => {
    setIsLoading(true);
    
    try {
      const response = await apiRequest("POST", "/api/login", { 
        username, 
        password, 
        remember_me: rememberMe 
      });
      
      const userData = await response.json();
      setUser(userData);
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Logout function
  const logout = async () => {
    setIsLoading(true);
    
    try {
      await apiRequest("POST", "/api/logout");
      setUser(null);
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: !!user,
        isLoading,
        user,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};