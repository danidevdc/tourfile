"use client";

import React, { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { toast as sonnerToast } from 'sonner';
import { db, auth } from '@/lib/firebase';
import {
  type User as FirebaseUser,
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
  onSnapshot,
} from 'firebase/firestore';

export interface UserProfile {
  uid: string;
  email: string;
  isAdmin?: boolean;
  createdAt?: Date;
  lastSignInTime?: Date;
  activityLog?: ActivityLogEntry[];
  firstName?: string;
  lastName?: string;
  username?: string;
  generatedReportsCount?: number;
  activeSessionId?: string;
}

export interface ActivityLogEntry {
  timestamp: Timestamp;
  action: string;
  details?: string;
}

export interface CurrentUser extends FirebaseUser {
  profile?: UserProfile;
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  currentUser: CurrentUser | null;
  isCurrentUserAdmin: boolean;
  login: (email?: string, password?: string) => Promise<void>;
  register: (email?: string, password?: string) => Promise<void>;
  logout: () => void;
  sendPasswordReset: (emailForReset: string) => Promise<void>;
  checkEmailExists: (email: string) => Promise<boolean>;
  getCurrentUserUsername: () => string | null;
  getCurrentUserDetails: () => Promise<UserProfile | null>;
  getAllUserProfiles: () => Promise<UserProfile[]>;
  deleteUserFromFirestore: (uidToDelete: string) => Promise<void>;
  incrementUserReportCountBy: (uid: string, amount: number) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ADMIN_EMAIL = 'daniish77@gmail.com';
const INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000;
const SESSION_ID_KEY = 'app_session_id';

function AuthProviderInternal({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const { toast } = useToast();

  const handleLogout = useCallback(async (isSilent = false, message?: string) => {
    if (!auth) return;
    setIsLoading(true);
    try {
      await signOut(auth);
      if (typeof window !== 'undefined') {
        sessionStorage.clear();
      }
      router.push('/login');
      if (!isSilent) {
        sonnerToast.success('Sesión Cerrada', { description: 'Has cerrado sesión exitosamente.' });
      } else {
        sonnerToast.warning('Sesión Expirada', { description: message || 'Tu sesión ha expirado.', duration: 5000 });
      }
    } catch (error) {
      console.error("Logout error:", error);
      toast({ title: "Error", description: "No se pudo cerrar la sesión.", variant: "destructive" });
    } finally {
      setCurrentUser(null);
      setIsLoading(false);
    }
  }, [router, toast]);

  const fetchUserProfile = useCallback(async (uid: string): Promise<UserProfile | null> => {
    if (!db) return null;
    try {
      const userProfileDocRef = doc(db, 'userProfiles', uid);
      const userProfileDoc = await getDoc(userProfileDocRef);
      if (userProfileDoc.exists()) {
        const data = userProfileDoc.data();
        return {
          ...data,
          uid: uid,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : undefined,
          lastSignInTime: data.lastSignInTime instanceof Timestamp ? data.lastSignInTime.toDate() : undefined,
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          username: data.username || '',
          generatedReportsCount: data.generatedReportsCount || 0,
        } as UserProfile;
      }
      return null;
    } catch (error) {
      console.error("Error fetching user profile:", error);
      toast({ title: "Error", description: "No se pudo cargar el perfil del usuario.", variant: "destructive" });
      return null;
    }
  }, [toast]);

  useEffect(() => {
    if (typeof window === 'undefined' || !currentUser) return;
    let inactivityTimer: NodeJS.Timeout;
    const resetInactivityTimer = () => {
      clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => {
        handleLogout(true, 'Tu sesión ha sido cerrada por inactividad.');
      }, INACTIVITY_TIMEOUT_MS);
    };
    const handleUserActivity = () => resetInactivityTimer();
    window.addEventListener('mousemove', handleUserActivity);
    window.addEventListener('keydown', handleUserActivity);
    window.addEventListener('click', handleUserActivity);
    window.addEventListener('scroll', handleUserActivity);
    resetInactivityTimer();
    return () => {
      clearTimeout(inactivityTimer);
      window.removeEventListener('mousemove', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
      window.removeEventListener('click', handleUserActivity);
      window.removeEventListener('scroll', handleUserActivity);
    };
  }, [currentUser, handleLogout]);

  useEffect(() => {
    if (!auth) {
      toast({ title: "Error Crítico", description: "La autenticación de Firebase no está disponible.", variant: "destructive", duration: 10000 });
      setIsLoading(false);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setIsLoading(true);
      if (firebaseUser) {
        const profile = await fetchUserProfile(firebaseUser.uid);
        const localSessionId = sessionStorage.getItem(SESSION_ID_KEY);
        if (profile && profile.activeSessionId && localSessionId !== profile.activeSessionId) {
          handleLogout(true, 'Tu sesión se ha cerrado porque iniciaste sesión en otro dispositivo.');
          return;
        }
        setCurrentUser({ ...firebaseUser, profile: profile || undefined });
      } else {
        setCurrentUser(null);
        sessionStorage.removeItem(SESSION_ID_KEY);
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [fetchUserProfile, handleLogout, toast]);

  // Real-time session monitoring
  useEffect(() => {
    if (!currentUser?.uid || !db) return;

    const localSessionId = sessionStorage.getItem(SESSION_ID_KEY);
    if (!localSessionId) return;

    const userProfileDocRef = doc(db, 'userProfiles', currentUser.uid);
    const unsubscribe = onSnapshot(userProfileDocRef, (docSnapshot) => {
      if (docSnapshot.exists()) {
        const profile = docSnapshot.data();
        if (profile.activeSessionId && profile.activeSessionId !== localSessionId) {
          handleLogout(true, 'Tu sesión se ha cerrado porque iniciaste sesión en otro dispositivo.');
        }
      }
    });

    return () => unsubscribe();
  }, [currentUser?.uid, handleLogout]);

  const login = useCallback(async (emailInput?: string, passwordInput?: string) => {
    setIsLoading(true);
    if (!auth || !db || !emailInput || !passwordInput) {
      toast({ title: "Error", description: "Correo y contraseña son requeridos.", variant: "destructive" });
      setIsLoading(false);
      return;
    }
    try {
      const userCredential = await signInWithEmailAndPassword(auth, emailInput.trim().toLowerCase(), passwordInput);
      const firebaseUser = userCredential.user;
      const newSessionId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      sessionStorage.setItem(SESSION_ID_KEY, newSessionId);
      const userProfileDocRef = doc(db, 'userProfiles', firebaseUser.uid);
      await updateDoc(userProfileDocRef, { activeSessionId: newSessionId, lastSignInTime: serverTimestamp() });
      const profile = await fetchUserProfile(firebaseUser.uid);
      setCurrentUser({ ...firebaseUser, profile });
      sonnerToast.success('Inicio de Sesión Exitoso', { description: `¡Bienvenido de nuevo, ${profile?.email || "Usuario"}!` });
      router.push('/');
    } catch (error: any) {
      let message = "Correo electrónico o contraseña incorrectos.";
      if (error.code === 'auth/user-disabled') message = "Esta cuenta de usuario ha sido deshabilitada.";
      toast({ title: "Error de Inicio de Sesión", description: message, variant: "destructive" });
      setCurrentUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [router, toast, fetchUserProfile]);

  const register = useCallback(async (email?: string, password?: string) => {
    setIsLoading(true);
    if (!auth || !db || !email || !password) {
      toast({ title: "Error de Registro", description: "Correo y contraseña son requeridos.", variant: "destructive" });
      setIsLoading(false);
      return;
    }
    const targetEmail = email.trim().toLowerCase();
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, targetEmail, password);
      const firebaseUserRegistered = userCredential.user;
      await setDoc(doc(db, 'userProfiles', firebaseUserRegistered.uid), {
        email: targetEmail,
        isAdmin: targetEmail === ADMIN_EMAIL,
        createdAt: serverTimestamp(),
        activityLog: [],
        generatedReportsCount: 0,
        activeSessionId: '',
      });
      toast({ title: "Registro Exitoso", description: `Cuenta creada para ${targetEmail}. Por favor, inicia sesión.`, variant: "success" as any });
      if (auth.currentUser) await signOut(auth);
      router.push('/login');
    } catch (error: any) {
      let message = "Ocurrió un problema al crear la cuenta.";
      if (error.code === 'auth/email-already-in-use') message = "Este correo electrónico ya está registrado.";
      toast({ title: "Error de Registro", description: message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast, router]);

  const sendPasswordReset = useCallback(async (emailForReset: string) => {
    if (!auth) return;
    setIsLoading(true);
    try {
      await fbSendPasswordResetEmail(auth, emailForReset.trim());
      toast({ title: "Correo de Recuperación Enviado", description: `Si una cuenta existe para ${emailForReset}, se ha enviado un correo.`, duration: 7000, variant: "success" as any });
    } catch (error: any) {
      toast({ title: "Error", description: "No se pudo enviar el correo de recuperación.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);
  
  const checkEmailExists = useCallback(async (email: string): Promise<boolean> => {
    if (!db || !email) return false;
    const q = query(collection(db, 'userProfiles'), where("email", "==", email.trim().toLowerCase()));
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  }, []);
  
  const incrementUserReportCountBy = useCallback(async (uid: string, amount: number) => {
    if (!db || !uid || amount <= 0) return;
    await updateDoc(doc(db, 'userProfiles', uid), { generatedReportsCount: increment(amount) });
  }, []);

  const getAllUserProfiles = useCallback(async (): Promise<UserProfile[]> => {
    if (!db) return [];
    const profilesSnapshot = await getDocs(collection(db, 'userProfiles'));
    return profilesSnapshot.docs.map(docSnapshot => {
      const data = docSnapshot.data();
      return {
        ...data,
        uid: docSnapshot.id,
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : undefined,
        lastSignInTime: data.lastSignInTime instanceof Timestamp ? data.lastSignInTime.toDate() : undefined,
      } as UserProfile;
    });
  }, []);

  const deleteUserFromFirestore = async (uidToDelete: string): Promise<void> => {
    if (!db) throw new Error("Firestore not initialized");
    if (currentUser?.uid === uidToDelete) {
      toast({ title: "Acción no permitida", description: "No puedes eliminar tu propia cuenta.", variant: "destructive" });
      throw new Error("Cannot delete own user profile.");
    }
    await deleteDoc(doc(db, 'userProfiles', uidToDelete));
    toast({ title: 'Perfil Eliminado', variant: "success" as any });
  };
  
  const value: AuthContextType = {
    isAuthenticated: !!currentUser,
    isLoading,
    currentUser,
    isCurrentUserAdmin: !!currentUser?.profile?.isAdmin,
    login,
    register,
    logout: () => handleLogout(false),
    sendPasswordReset,
    checkEmailExists,
    getCurrentUserUsername: () => currentUser?.profile?.email || null,
    getCurrentUserDetails: () => currentUser?.uid ? fetchUserProfile(currentUser.uid) : Promise.resolve(null),
    getAllUserProfiles,
    deleteUserFromFirestore,
    incrementUserReportCountBy,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}


export function AuthProvider({ children }: { children: ReactNode }) {
    return <AuthProviderInternal>{children}</AuthProviderInternal>
}


export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
