
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import {
  collection,
  getDocs,
  doc,
  setDoc,
  query,
  where,
  deleteDoc,
  serverTimestamp,
  Timestamp,
  writeBatch,
  getDoc,
  updateDoc, 
  arrayUnion, 
} from 'firebase/firestore';

const RXLOCAL_CURRENT_USER_USERNAME_KEY = 'tourfilegen_currentUser_username_v1'; 

export interface ActivityLogEntry {
  timestamp: Timestamp;
  action: string;
  details?: string;
}

export interface UserData {
  username: string;
  email?: string; // Added email field
  password?: string; 
  firstName: string;
  lastName: string;
  isAdmin?: boolean;
  createdAt?: Timestamp;
  firestoreId?: string; 
  activityLog?: ActivityLogEntry[];
}

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserData | null>(null);
  const [isCurrentUserAdmin, setIsCurrentUserAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const { toast } = useToast();

  const fetchUserDetailsByUsername = useCallback(async (username: string): Promise<UserData | null> => {
    if (!db) {
      console.error("Firestore instance (db) is not available for fetching user details by username.");
      return null;
    }
    try {
      const userDocRef = doc(db, 'users', username.toLowerCase());
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const data = userDoc.data();
        return {
          firestoreId: userDoc.id,
          ...data,
          activityLog: data.activityLog || [], 
        } as UserData;
      }
      return null;
    } catch (error) {
      console.error('Error fetching user details by username from Firestore:', error);
      toast({ title: 'Error de Red', description: 'No se pudieron obtener los detalles del usuario.', variant: 'destructive' });
      return null;
    }
  }, [toast]);
  
  const fetchUserDetailsByEmail = useCallback(async (email: string): Promise<UserData | null> => {
    if (!db) {
      console.error("Firestore instance (db) is not available for fetching user details by email.");
      return null;
    }
    try {
      const usersCollectionRef = collection(db, 'users');
      const q = query(usersCollectionRef, where("email", "==", email.toLowerCase()));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        // Assuming email is unique, take the first match. 
        // Add more robust handling if emails might not be unique.
        const userDoc = querySnapshot.docs[0];
        const data = userDoc.data();
        return {
          firestoreId: userDoc.id,
          ...data,
          activityLog: data.activityLog || [],
        } as UserData;
      }
      return null;
    } catch (error) {
      console.error('Error fetching user details by email from Firestore:', error);
      toast({ title: 'Error de Red', description: 'No se pudieron obtener los detalles del usuario por correo.', variant: 'destructive' });
      return null;
    }
  }, [toast]);


  const checkUsernameExists = useCallback(async (username: string): Promise<boolean> => {
    if (!db || !username) return false;
    const userDocRef = doc(db, 'users', username.toLowerCase());
    const docSnap = await getDoc(userDocRef);
    return docSnap.exists();
  }, []);

  // Optional: Add a function to check if an email already exists if needed for registration validation
  const checkEmailExists = useCallback(async (email: string): Promise<boolean> => {
    if (!db || !email) return false;
    const usersCollectionRef = collection(db, 'users');
    const q = query(usersCollectionRef, where("email", "==", email.toLowerCase()));
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  }, []);


  const initializeDefaultAdmin = useCallback(async () => {
    if (!db) {
      console.error("useAuth: Firestore db not ready yet during admin initialization.");
      toast({
        title: 'Error Crítico de Configuración',
        description: 'La conexión con la base de datos no se pudo establecer.',
        variant: 'destructive',
        duration: 10000
      });
      setIsLoading(false);
      return;
    }
    try {
      const adminUsername = 'admin.admin';
      const adminEmail = 'admin@example.com'; // Added email for admin
      const adminDocRef = doc(db, 'users', adminUsername);
      const adminSnapshot = await getDoc(adminDocRef);

      if (!adminSnapshot.exists()) {
        const adminUser: UserData = { 
          username: adminUsername,
          email: adminEmail,
          password: 'admin123', 
          firstName: 'Admin',
          lastName: 'App',
          isAdmin: true,
          createdAt: serverTimestamp() as Timestamp,
          activityLog: [],
        };
        await setDoc(adminDocRef, adminUser);
        console.log(`Default admin user "${adminUsername}" created in Firestore.`);
      }
    } catch (error) {
      console.error('Error initializing default admin:', error);
      toast({ title: 'Error de Inicialización', description: 'No se pudo configurar el administrador.', variant: 'destructive' });
    }
  }, [toast]);


  const checkUserSessionAndAdmin = useCallback(async () => {
    setIsLoading(true);
    if (!db) {
        console.warn("useAuth: Firestore db not ready yet during session check.");
        toast({
          title: 'Error de Conexión con BD',
          description: 'La base de datos no está disponible.',
          variant: 'destructive',
          duration: 7000
        });
        setIsLoading(false);
        return;
    }
    await initializeDefaultAdmin();

    try {
      const storedUsername = localStorage.getItem(RXLOCAL_CURRENT_USER_USERNAME_KEY);
      if (storedUsername) {
        const userDetails = await fetchUserDetailsByUsername(storedUsername); // Use by username for session restore
        if (userDetails) {
          setCurrentUser(userDetails);
          setIsAuthenticated(true);
          setIsCurrentUserAdmin(!!userDetails.isAdmin);
        } else {
          localStorage.removeItem(RXLOCAL_CURRENT_USER_USERNAME_KEY);
          setCurrentUser(null);
          setIsAuthenticated(false);
          setIsCurrentUserAdmin(false);
        }
      } else {
        setCurrentUser(null);
        setIsAuthenticated(false);
        setIsCurrentUserAdmin(false);
      }
    } catch (error) {
      console.error("Error during user session check:", error);
      setCurrentUser(null);
      setIsAuthenticated(false);
      setIsCurrentUserAdmin(false);
    } finally {
      setIsLoading(false);
    }
  }, [fetchUserDetailsByUsername, initializeDefaultAdmin, toast]);


  useEffect(() => {
    checkUserSessionAndAdmin();
  }, [checkUserSessionAndAdmin]);


  const login = useCallback(async (usernameOrEmailInput?: string, passwordInput?: string) => {
    setIsLoading(true);
    if (!db) {
      toast({ title: 'Error de Configuración', description: 'La base de datos no está disponible.', variant: 'destructive' });
      setIsLoading(false);
      return;
    }
    if (!usernameOrEmailInput || !passwordInput) {
      toast({ title: "Error", description: "Usuario/Email y contraseña son requeridos.", variant: "destructive" });
      setIsLoading(false);
      return;
    }

    try {
      let userDetails: UserData | null = null;
      const inputTrimmed = usernameOrEmailInput.trim();

      if (inputTrimmed.includes('@')) { // Assume it's an email
        userDetails = await fetchUserDetailsByEmail(inputTrimmed);
      } else { // Assume it's a username
        userDetails = await fetchUserDetailsByUsername(inputTrimmed);
      }
      

      if (userDetails && userDetails.password === passwordInput) { 
        localStorage.setItem(RXLOCAL_CURRENT_USER_USERNAME_KEY, userDetails.username); // Store username for session
        setCurrentUser(userDetails);
        setIsAuthenticated(true);
        setIsCurrentUserAdmin(!!userDetails.isAdmin);
        const capitalizedFirstName = userDetails.firstName.charAt(0).toUpperCase() + userDetails.firstName.slice(1).toLowerCase();
        toast({ title: "Inicio de Sesión Exitoso", description: `¡Bienvenido de nuevo, ${capitalizedFirstName}!` });
        router.push('/'); 
      } else {
        toast({ title: "Error de Inicio de Sesión", description: "Credenciales incorrectas.", variant: "destructive" });
        setCurrentUser(null);
        setIsAuthenticated(false);
        setIsCurrentUserAdmin(false);
      }
    } catch (error) {
      console.error('Login error:', error);
      toast({ title: "Error de Inicio de Sesión", description: "Ocurrió un problema al iniciar sesión.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [router, toast, fetchUserDetailsByUsername, fetchUserDetailsByEmail]);


  const register = useCallback(async (firstName?: string, lastName?: string, email?: string, username?: string, password?: string) => {
    setIsLoading(true);
    if (!db) {
      toast({ title: 'Error de Configuración', description: 'La base de datos no está disponible.', variant: 'destructive' });
      setIsLoading(false);
      return;
    }
    if (!firstName || !lastName || !email || !username || !password) {
      toast({ title: "Error de Registro", description: "Todos los campos son requeridos.", variant: "destructive" });
      setIsLoading(false);
      return;
    }

    const targetUsername = username.trim().toLowerCase();
    const targetEmail = email.trim().toLowerCase();

    // Optional: Check if email already exists before attempting registration
    const emailExists = await checkEmailExists(targetEmail);
    if (emailExists) {
        toast({ title: "Error de Registro", description: "Este correo electrónico ya está en uso.", variant: "destructive" });
        setIsLoading(false);
        return;
    }
    // Username existence is already checked by the form's debounced check

    try {
      const newUserDocRef = doc(collection(db, 'users'), targetUsername);
      const newUser: UserData = {
        username: targetUsername,
        email: targetEmail,
        password: password, 
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        isAdmin: false,
        createdAt: serverTimestamp() as Timestamp,
        activityLog: [], 
      };

      await setDoc(newUserDocRef, newUser);

      const capitalizedFirstName = newUser.firstName.charAt(0).toUpperCase() + newUser.firstName.slice(1).toLowerCase();
      toast({ title: "Registro Exitoso", description: `Cuenta creada para ${capitalizedFirstName}. Usuario: ${newUser.username}` });
      router.push('/login');

    } catch (error) {
      console.error('Registration error:', error);
      toast({ title: "Error de Registro", description: "Ocurrió un problema al crear la cuenta.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast, router, checkEmailExists]);


  const logout = useCallback(() => {
    localStorage.removeItem(RXLOCAL_CURRENT_USER_USERNAME_KEY);
    setCurrentUser(null);
    setIsAuthenticated(false);
    setIsCurrentUserAdmin(false);
    router.push('/login');
    toast({ title: "Sesión Cerrada", description: "Has cerrado sesión exitosamente." });
  }, [router, toast]);

  const getCurrentUserUsername = useCallback((): string | null => {
    try {
      return localStorage.getItem(RXLOCAL_CURRENT_USER_USERNAME_KEY);
    } catch (error) {
      return null;
    }
  }, []);

  const getCurrentUserDetails = useCallback(async (): Promise<UserData | null> => {
    const username = getCurrentUserUsername();
    if (username) {
        return fetchUserDetailsByUsername(username); // Use by username for consistency
    }
    return null;
  }, [getCurrentUserUsername, fetchUserDetailsByUsername]);


  const getUsersFromFirestore = useCallback(async (): Promise<UserData[]> => {
    if (!db) {
      console.error("Firestore instance (db) is not available in getUsersFromFirestore.");
      throw new Error("La base de datos (Firestore) no está inicializada o disponible.");
    }
    try {
      const usersCollectionRef = collection(db, 'users');
      const usersSnapshot = await getDocs(usersCollectionRef);
      const usersList = usersSnapshot.docs.map(docSnapshot => {
        const data = docSnapshot.data();
        return {
            firestoreId: docSnapshot.id,
            username: data.username,
            email: data.email, // Include email
            firstName: data.firstName,
            lastName: data.lastName,
            isAdmin: data.isAdmin || false,
            activityLog: data.activityLog || [], 
        } as UserData
      });
      return usersList;
    } catch (error: any) {
      console.error("Error fetching users from Firestore in hook:", error);
      throw new Error(`Error al obtener usuarios de Firestore: ${error.message || String(error)}`);
    }
  }, []);

  const deleteUserFromFirestore = async (userFirestoreId: string): Promise<void> => {
    if (!db) {
      toast({ title: 'Error de Configuración', description: 'La base de datos no está disponible.', variant: 'destructive' });
      throw new Error("Firestore not initialized");
    }
    if (!userFirestoreId) {
      toast({ title: 'Error', description: 'ID de usuario no proporcionado.', variant: 'destructive' });
      throw new Error("User ID not provided for deletion.");
    }
    try {
      const userDocRef = doc(db, 'users', userFirestoreId);
      await deleteDoc(userDocRef);
      toast({ title: 'Usuario Eliminado', description: 'El usuario ha sido eliminado de Firestore.' });
    } catch (error) {
      console.error('Error deleting user from Firestore:', error);
      toast({ title: 'Error al Eliminar', description: 'No se pudo eliminar el usuario de Firestore.', variant: 'destructive' });
      throw error;
    }
  };

  const sendPasswordResetEmail = async (emailForReset: string, usernameForLog?: string): Promise<void> => {
    let userToLog = usernameForLog;
    // If username is not provided for logging, try to find the user by email to get their username
    if (!userToLog && db && emailForReset) {
        const userDetailsByEmail = await fetchUserDetailsByEmail(emailForReset);
        if (userDetailsByEmail) {
            userToLog = userDetailsByEmail.username;
        }
    }

    console.warn(`Simulating password reset email to: ${emailForReset} for user ${userToLog || '(username not found)'}. This requires backend implementation for actual email sending or Firebase Auth.`);
    toast({
      title: "Simulación de Recuperación",
      description: `Si ${emailForReset} estuviera registrado, se enviaría un enlace (funcionalidad simulada).`,
      duration: 5000,
    });

    if (db && userToLog) {
      try {
        const userDocRef = doc(db, 'users', userToLog.toLowerCase());
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
           const newLogEntry: ActivityLogEntry = {
            timestamp: serverTimestamp() as Timestamp,
            action: 'Intento de Reseteo de Contraseña',
            details: `Solicitado para el correo: ${emailForReset} (Simulado)`,
          };
          await updateDoc(userDocRef, {
            activityLog: arrayUnion(newLogEntry)
          });
        } else {
          console.warn(`sendPasswordResetEmail: User ${userToLog} not found in Firestore to log activity.`);
        }
      } catch (error) {
        console.error(`Error logging password reset attempt for ${userToLog}:`, error);
      }
    }
    return Promise.resolve();
  };


  return {
    isAuthenticated,
    isLoading,
    currentUser,
    isCurrentUserAdmin,
    login,
    register,
    logout,
    getCurrentUserUsername,
    getCurrentUserDetails,
    fetchUserDetailsByUsername, // Keep this if needed elsewhere for direct username fetching
    fetchUserDetailsByEmail,   // Keep this if needed elsewhere for direct email fetching
    getUsersFromFirestore,
    deleteUserFromFirestore,
    checkUsernameExists,
    checkEmailExists, // Expose if needed by registration form for pre-validation
    sendPasswordResetEmail,
  };
}

