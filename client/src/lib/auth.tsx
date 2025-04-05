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
        console.log("Memeriksa status autentikasi...");
        const response = await apiRequest<AuthResponse>("/api/auth/status", {
          method: "GET",
        });
        
        console.log("Status autentikasi:", response.authenticated);
        
        if (response.authenticated && response.user) {
          console.log("Pengguna terautentikasi:", response.user.username);
          setUser(response.user);
        } else {
          console.log("Pengguna tidak terautentikasi");
          setUser(null);
        }
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
      const response = await apiRequest<AuthResponse>("/api/login", {
        method: "POST",
        body: JSON.stringify({ username, password, remember_me: rememberMe }),
        headers: {
          "Content-Type": "application/json",
        },
      });
      
      if (response.success && response.user) {
        setUser(response.user);
      } else {
        throw new Error(response.message || "Login failed");
      }
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
      await apiRequest<{ success: boolean }>("/api/logout", {
        method: "POST",
      });
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