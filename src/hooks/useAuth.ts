
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { db, auth } from '@/lib/firebase'; // Import auth from firebase config
import {
  type User as FirebaseUser, // Firebase Auth User type
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail as fbSendPasswordResetEmail,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
  Timestamp,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  deleteDoc,
  increment,
} from 'firebase/firestore';

// TourFileGen specific user profile data stored in Firestore
export interface UserProfile {
  uid: string; // Firebase Auth UID
  email: string; // Normalized email
  isAdmin?: boolean;
  createdAt?: Timestamp;
  activityLog?: ActivityLogEntry[];
  firstName?: string;
  lastName?: string;
  username?: string;
  generatedReportsCount?: number;
  activeSessionId?: string; // For single-session enforcement
}

export interface ActivityLogEntry {
  timestamp: Timestamp;
  action: string;
  details?: string;
}

// This will be the structure of our currentUser state, combining Auth info and Profile info
export interface CurrentUser extends FirebaseUser {
  profile?: UserProfile; // Optional profile, fetched from Firestore
}

const ADMIN_EMAIL = 'daniish77@gmail.com';
const INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour for inactivity logout
const SESSION_ID_KEY = 'app_session_id'; // Key for sessionStorage

export function useAuth() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCurrentUserAdmin, setIsCurrentUserAdmin] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  
  const logout = useCallback(async (isSilent = false, message?: string) => {
    if (!auth) return;
    setIsLoading(true);
    try {
      await signOut(auth);
      sessionStorage.removeItem(SESSION_ID_KEY);
      
      router.push('/login');

      if (!isSilent) {
        toast({ title: "Sesión Cerrada", description: "Has cerrado sesión exitosamente.", className: "bg-green-100 dark:bg-green-900 border-green-500" });
      } else {
        toast({ title: "Sesión Expirada", description: message || "Tu sesión ha expirado.", duration: 5000 });
      }

    } catch (error) {
      console.error("Logout error:", error);
      toast({ title: "Error", description: "No se pudo cerrar la sesión.", variant: "destructive" });
    } finally {
      // This state change happens after redirect, so it's safe
      setCurrentUser(null);
      setIsCurrentUserAdmin(false);
      setIsLoading(false);
    }
  }, [router, toast]);


  const fetchUserProfile = useCallback(async (uid: string): Promise<UserProfile | null> => {
    if (!db) return null;
    try {
      const userProfileDocRef = doc(db, 'userProfiles', uid);
      const userProfileDoc = await getDoc(userProfileDocRef);
      if (userProfileDoc.exists()) {
        const data = userProfileDoc.data() as UserProfile;
        return {
          ...data,
          uid: uid,
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          username: data.username || '',
          generatedReportsCount: data.generatedReportsCount || 0,
        };
      }
      return null;
    } catch (error) {
      console.error("Error fetching user profile:", error);
      toast({ title: "Error", description: "No se pudo cargar el perfil del usuario.", variant: "destructive" });
      return null;
    }
  }, [toast]);

  // Inactivity and Session Handling Effect
  useEffect(() => {
    if (typeof window === 'undefined' || !currentUser) return;

    let inactivityTimer: NodeJS.Timeout;

    const resetInactivityTimer = () => {
      clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => {
        logout(true, 'Tu sesión ha sido cerrada por inactividad.');
      }, INACTIVITY_TIMEOUT_MS);
    };

    const handleUserActivity = () => {
      resetInactivityTimer();
    };

    // Set up event listeners for user activity
    window.addEventListener('mousemove', handleUserActivity);
    window.addEventListener('keydown', handleUserActivity);
    window.addEventListener('click', handleUserActivity);
    window.addEventListener('scroll', handleUserActivity);

    // Initial start of the timer
    resetInactivityTimer();

    // Cleanup function
    return () => {
      clearTimeout(inactivityTimer);
      window.removeEventListener('mousemove', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
      window.removeEventListener('click', handleUserActivity);
      window.removeEventListener('scroll', handleUserActivity);
    };
  }, [currentUser, logout]);


  useEffect(() => {
    if (!auth) {
        console.error("Firebase Auth is not initialized. App will not function correctly.");
        toast({ title: "Error Crítico", description: "La autenticación de Firebase no está disponible.", variant: "destructive", duration: 10000 });
        setIsLoading(false);
        return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setIsLoading(true);
      if (firebaseUser) {
        const profile = await fetchUserProfile(firebaseUser.uid);
        const localSessionId = sessionStorage.getItem(SESSION_ID_KEY);

        // Single-session validation
        if (profile && profile.activeSessionId && localSessionId !== profile.activeSessionId) {
            logout(true, 'Tu sesión se ha cerrado porque iniciaste sesión en otro dispositivo.');
            return;
        }

        setCurrentUser({ ...firebaseUser, profile: profile || undefined });
        setIsCurrentUserAdmin(!!profile?.isAdmin || firebaseUser.email === ADMIN_EMAIL);
      } else {
        setCurrentUser(null);
        setIsCurrentUserAdmin(false);
        sessionStorage.removeItem(SESSION_ID_KEY);
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [fetchUserProfile, toast, logout]);


  const login = useCallback(async (emailInput?: string, passwordInput?: string) => {
    setIsLoading(true);
    if (!auth || !db) {
      toast({ title: 'Error de Configuración', description: 'Firebase Auth o Firestore no está disponible.', variant: 'destructive' });
      setIsLoading(false);
      return;
    }
    if (!emailInput || !passwordInput) {
      toast({ title: "Error", description: "Correo y contraseña son requeridos.", variant: "destructive" });
      setIsLoading(false);
      return;
    }

    const emailToUseForLogin = emailInput.trim().toLowerCase();

    try {
      const userCredential = await signInWithEmailAndPassword(auth, emailToUseForLogin, passwordInput);
      const firebaseUser = userCredential.user;

      // Create and set the new session ID
      const newSessionId = `${'${Date.now()}'}-${Math.random().toString(36).substring(2, 9)}`;
      sessionStorage.setItem(SESSION_ID_KEY, newSessionId);
      const userProfileDocRef = doc(db, 'userProfiles', firebaseUser.uid);
      await updateDoc(userProfileDocRef, { activeSessionId: newSessionId });
      
      const profile = await fetchUserProfile(firebaseUser.uid);

      setCurrentUser({ ...firebaseUser, profile });
      setIsCurrentUserAdmin(!!profile?.isAdmin || firebaseUser.email === ADMIN_EMAIL);
      
      const displayName = profile?.email || "Usuario";
      toast({ title: "Inicio de Sesión Exitoso", description: `¡Bienvenido de nuevo, ${'${displayName}'}!`, className: "bg-green-100 dark:bg-green-900 border-green-500" });
      router.push('/');
    } catch (error: any) {
      console.error('Login error:', error.code, error.message);
      sessionStorage.removeItem(SESSION_ID_KEY);
      let title = "Error de Inicio de Sesión";
      let message = "Ocurrió un problema al intentar iniciar sesión.";

      if (error.code) {
        switch (error.code) {
          case 'auth/user-not-found':
          case 'auth/wrong-password':
          case 'auth/invalid-credential':
            message = "Correo electrónico o contraseña incorrectos.";
            break;
          case 'auth/invalid-email':
            message = "El formato del correo electrónico es inválido.";
            break;
          case 'auth/user-disabled':
            message = "Esta cuenta de usuario ha sido deshabilitada.";
            title = "Cuenta Deshabilitada";
            break;
          default:
            message = error.message || "Credenciales inválidas o error desconocido.";
        }
      }
      toast({ title: title, description: message, variant: "destructive" });
      setCurrentUser(null);
      setIsCurrentUserAdmin(false);
    } finally {
      setIsLoading(false);
    }
  }, [router, toast, fetchUserProfile]);

  const register = useCallback(async (email?: string, password?: string) => {
    setIsLoading(true);
    if (!auth || !db) {
      toast({ title: 'Error de Configuración', description: 'Firebase Auth o Firestore no está disponible.', variant: 'destructive' });
      setIsLoading(false);
      return;
    }
    if (!email || !password) {
      toast({ title: "Error de Registro", description: "Correo y contraseña son requeridos.", variant: "destructive" });
      setIsLoading(false);
      return;
    }

    const targetEmail = email.trim().toLowerCase();
    let firebaseUserRegistered;

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, targetEmail, password);
      firebaseUserRegistered = userCredential.user;

      const userProfileData: UserProfile = {
        uid: firebaseUserRegistered.uid,
        email: targetEmail,
        isAdmin: targetEmail === ADMIN_EMAIL,
        createdAt: serverTimestamp() as Timestamp,
        activityLog: [],
        generatedReportsCount: 0,
        activeSessionId: '', // Initialize as empty
      };

      await setDoc(doc(db, 'userProfiles', firebaseUserRegistered.uid), userProfileData);

      toast({ title: "Registro Exitoso", description: `Cuenta creada para ${'${targetEmail}'}. Por favor, inicia sesión.`, className: "bg-green-100 dark:bg-green-900 border-green-500" });
      
      if (auth.currentUser) { 
        await signOut(auth);
      }
      router.push('/login'); 

    } catch (error: any) {
      console.error('Registration process error:', error.code, error.message);
      let message = "Ocurrió un problema al crear la cuenta.";

      if (error.code) {
        switch (error.code) {
          case 'auth/email-already-in-use':
            message = "Este correo electrónico ya está registrado.";
            break;
          case 'auth/invalid-email':
            message = "El formato del correo electrónico es inválido.";
            break;
          case 'auth/weak-password':
            message = "La contraseña es demasiado débil. Debe tener al menos 6 caracteres.";
            break;
          case 'auth/requires-recent-login':
             message = "Esta operación es sensible y requiere autenticación reciente. Intenta iniciar sesión de nuevo.";
             break;
          case 'permission-denied':
             message = "Permiso denegado por Firebase Authentication. Verifica la configuración de tu proyecto.";
             break;
          default:
            message = error.message || "Error desconocido durante el registro.";
        }
      } else if (firebaseUserRegistered && error.message && error.message.toLowerCase().includes('firestore')) {
        console.error(`Firestore Error after user ${'${firebaseUserRegistered.uid}'} created: ${'${error.message}'}`);
        message = "La cuenta de autenticación fue creada, pero hubo un problema al guardar el perfil. Contacta al soporte.";
      } else {
        console.error('Non-Firebase error or unknown error structure:', error);
      }

      toast({ title: "Error de Registro", description: message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast, router]);


  const sendPasswordReset = useCallback(async (emailForReset: string) => {
    if (!auth) {
        toast({ title: 'Error de Configuración', description: 'Firebase Auth no está disponible.', variant: 'destructive' });
        return;
    }
    setIsLoading(true);
    try {
      await fbSendPasswordResetEmail(auth, emailForReset.trim());
      toast({
        title: "Correo de Recuperación Enviado",
        description: `Si una cuenta existe para ${'${emailForReset}'}, se ha enviado un correo con instrucciones.`,
        duration: 7000,
        className: "bg-green-100 dark:bg-green-900 border-green-500"
      });
    } catch (error: any) {
      console.error("Password reset error:", error);
      let message = "No se pudo enviar el correo de recuperación.";
      if (error.code === 'auth/user-not-found') {
        message = `Si una cuenta existe para ${'${emailForReset}'}, se ha enviado un correo. Si no lo ves, revisa tu carpeta de spam.`;
         toast({
            title: "Verifica tu Correo",
            description: message,
            duration: 7000,
            className: "bg-green-100 dark:bg-green-900 border-green-500"
        });
        setIsLoading(false);
        return;

      } else if (error.code === 'auth/invalid-email') {
        message = "El formato del correo electrónico es inválido.";
      }
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);


  const checkEmailExists = useCallback(async (email: string): Promise<boolean> => {
    if (!db || !email) return false;
    try {
      const profilesRef = collection(db, 'userProfiles');
      const q = query(profilesRef, where("email", "==", email.trim().toLowerCase()));
      const querySnapshot = await getDocs(q);
      return !querySnapshot.empty;
    } catch (error) {
        console.error("Error checking email existence in Firestore (could be rules or network):", error);
        return false; 
    }
  }, []);

  const incrementUserReportCountBy = useCallback(async (uid: string, amount: number) => {
    if (!db || !uid || amount <= 0) {
      console.warn("Could not increment report count. Missing db, uid, or amount <= 0.", { uid, amount });
      return;
    }
    const userProfileDocRef = doc(db, 'userProfiles', uid);
    try {
      await updateDoc(userProfileDocRef, {
        generatedReportsCount: increment(amount)
      });
    } catch (error) {
      console.error(`Error incrementing report count for user ${'${uid}'}:`, error);
    }
  }, []);


  const getCurrentUserUsername = useCallback((): string | null => {
    return currentUser?.profile?.email || null;
  }, [currentUser]);

  const getCurrentUserDetails = useCallback(async (): Promise<UserProfile | null> => {
    if (currentUser?.uid) {
        return fetchUserProfile(currentUser.uid);
    }
    return null;
  }, [currentUser, fetchUserProfile]);

  const getAllUserProfiles = useCallback(async (): Promise<UserProfile[]> => {
    if (!db) {
      toast({ title: "Error de BD", description: "Firestore no está disponible.", variant: "destructive" });
      return [];
    }
    if (!isCurrentUserAdmin) {
      toast({ title: "Acceso Denegado", description: "No tienes permisos para ver todos los usuarios.", variant: "destructive" });
      return [];
    }
    try {
      const profilesCollectionRef = collection(db, 'userProfiles');
      const profilesSnapshot = await getDocs(profilesCollectionRef);
      const usersList = profilesSnapshot.docs.map(docSnapshot => {
        const data = docSnapshot.data() as UserProfile;
        return {
          ...data,
          uid: docSnapshot.id,
          generatedReportsCount: data.generatedReportsCount || 0,
        };
      });
      return usersList;
    } catch (error: any) {
      console.error("Error fetching all user profiles from Firestore:", error);
      toast({ title: "Error", description: `No se pudieron obtener los perfiles: ${'${error.message}'}`, variant: "destructive" });
      return [];
    }
  }, [isCurrentUserAdmin, toast]);


  const deleteUserFromFirestore = async (uidToDelete: string): Promise<void> => {
    if (!db) throw new Error("Firestore not initialized");
    if (!uidToDelete) throw new Error("User UID not provided for deletion.");

    if (currentUser?.uid === uidToDelete) {
        toast({title: "Acción no permitida", description: "No puedes eliminar tu propia cuenta desde aquí.", variant: "destructive"});
        throw new Error("Cannot delete own user profile through this admin function.");
    }

    try {
      const userProfileDocRef = doc(db, 'userProfiles', uidToDelete);
      await deleteDoc(userProfileDocRef);
      toast({ title: 'Perfil Eliminado', description: 'El perfil de usuario ha sido eliminado de Firestore.', className: "bg-green-100 dark:bg-green-900 border-green-500" });
    } catch (error) {
      console.error('Error deleting user profile from Firestore:', error);
      toast({ title: 'Error al Eliminar', description: 'No se pudo eliminar el perfil de Firestore.', variant: 'destructive' });
      throw error;
    }
  };


  return {
    isAuthenticated: !!currentUser,
    isLoading,
    currentUser,
    isCurrentUserAdmin,
    login,
    register,
    logout: () => logout(false), // Public logout is never silent
    sendPasswordReset: sendPasswordReset,
    checkEmailExists,
    getCurrentUserUsername, 
    getCurrentUserDetails,
    getAllUserProfiles,
    deleteUserFromFirestore,
    incrementUserReportCountBy,
  };
}
