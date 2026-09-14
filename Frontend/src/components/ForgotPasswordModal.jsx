import React from 'react';
import { useNavigate } from 'react-router-dom';
import Login from './Login';
import ForgotPassword from './ForgotPassword';

/**
 * Renders Login as background with ForgotPassword as a modal overlay when at /forgot-password.
 */
export default function ForgotPasswordModal() {
  const navigate = useNavigate();

  return (
    <>
      <Login />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="absolute inset-0 bg-black/50"
          onClick={() => navigate('/login')}
          aria-hidden="true"
        />
        <div className="relative w-full max-w-md" onClick={(e) => e.stopPropagation()}>
          <ForgotPassword asModal onClose={() => navigate('/login')} />
        </div>
      </div>
    </>
  );
}
