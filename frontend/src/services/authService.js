import { signInWithEmailAndPassword, signOut, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';
import api from './api';

export const authService = {
  async login({ email, password }) {
    await signInWithEmailAndPassword(auth, email, password);
    // El id token ya lo añade api.js en cada request (ver interceptor); aquí solo pedimos
    // los datos de roster (rol, allowed_content, etc.) que viven en Mongo.
    const response = await api.get('/api/auth/me');
    return response.data;
  },

  async getCurrentUser() {
    const response = await api.get('/api/auth/me');
    return response.data;
  },

  async logout() {
    await signOut(auth);
  },

  async sendPasswordReset(email) {
    // Nadie ve/gestiona una contraseña en claro -- ni el alumno, ni el admin.
    await sendPasswordResetEmail(auth, email);
  },
};
