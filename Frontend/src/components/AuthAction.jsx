import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

/**
 * Single entry point for all Firebase email action links.
 * Firebase uses ONE custom action URL for password reset, email verification, and recover email.
 * This component routes each mode to the correct handler page.
 */
export default function AuthAction() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const mode = searchParams.get('mode');
    const oobCode = searchParams.get('oobCode');
    const apiKey = searchParams.get('apiKey');
    const lang = searchParams.get('lang');

    const params = new URLSearchParams();
    if (oobCode) params.set('oobCode', oobCode);
    if (mode) params.set('mode', mode);
    if (apiKey) params.set('apiKey', apiKey);
    if (lang) params.set('lang', lang);
    const query = params.toString();

    switch (mode) {
      case 'resetPassword':
        navigate(`/reset-password?${query}`, { replace: true });
        break;
      case 'verifyEmail':
        navigate(`/verify-email?${query}`, { replace: true });
        break;
      case 'recoverEmail':
        // Firebase recover email = user undoing an email change
        navigate(`/login?${query}`, { replace: true });
        break;
      default:
        navigate('/login', { replace: true });
    }
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#7C3AED]"></div>
    </div>
  );
}
