import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import '../styles.css';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { ProfileProvider } from './context/ProfileContext';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <AuthProvider>
      <ProfileProvider>
        <App />
      </ProfileProvider>
    </AuthProvider>
  </React.StrictMode>
);
