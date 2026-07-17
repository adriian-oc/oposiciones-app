import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';

// En dev/staging sin credenciales reales, REACT_APP_FIREBASE_AUTH_EMULATOR_HOST apunta al
// emulador local y el resto de la config puede ser de mentira (el emulador no llama a Google).
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || 'fake-api-key',
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || 'demo-oposiciones.firebaseapp.com',
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || 'demo-oposiciones',
};

export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);

const emulatorHost = process.env.REACT_APP_FIREBASE_AUTH_EMULATOR_HOST;
if (emulatorHost) {
  connectAuthEmulator(auth, `http://${emulatorHost}`, { disableWarnings: true });
}
