import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import PrivateRoute from './components/PrivateRoute';
import { CreatePostProvider } from './context/CreatePostContext';
import CreatePostModal from './components/CreatePostModal';
import HomeFeed from './components/HomeFeed';
import EditProfile from './components/EditProfile';
import UserProfile from './components/UserProfile';
import ViewUserProfile from './components/ViewUserProfile';
import DiscussionForum from './components/DiscussionForum';
import Lists from './components/Lists';
import Messaging from './components/Messaging';
import Notifications from './components/Notifications';
import Trending from './components/Trending';
import DepartmentTrends from './components/DepartmentTrends';
import Settings from './components/Settings';
import HashtagPage from './components/HashtagPage';
import BlockedUsers from './components/BlockedUsers';
import Login from './components/Login';
import SignUp from './components/SignUp';
import ForgotPasswordModal from './components/ForgotPasswordModal';
import ResetPassword from './components/ResetPassword';
import VerifyEmail from './components/VerifyEmail';
import AuthAction from './components/AuthAction';
import Username from './components/Username';
import PublicUserProfile from './components/PublicUserProfile';
import AdminLogin from './components/Admin/AdminLogin';
import AdminRoute from './components/Admin/AdminRoute';
import AdminDashboard from './components/Admin/AdminDashboard';
import PostModeration from './components/Admin/PostModeration';
import ReportsAnalytics from './components/Admin/ReportsAnalytics';
import SentimentAnalysis from './components/Admin/SentimentAnalysis';
import UserManagement from './components/Admin/UserManagement';
import SuspendedUsers from './components/Admin/SuspendedUsers';
import AdminProfileSettings from './components/Admin/AdminProfileSettings';
import AdminPinSetup from './components/Admin/AdminPinSetup';
import AdminEmailVerification from './components/Admin/AdminEmailVerification';
import AdminAlumniSignups from './components/Admin/AdminAlumniSignups';
import CreatePost from './components/CreatePost';

function App() {
  return (
    <BrowserRouter>
      <CreatePostProvider>
        <CreatePostModal />
        <Routes>
        {/* Public Routes */}
        <Route path="/" element={<SignUp />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/forgot-password" element={<ForgotPasswordModal />} />
        <Route path="/auth/action" element={<AuthAction />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/username" element={<Username />} />
        
        {/* Admin Routes — login is public; all other admin screens require admin session */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/verify-email" element={<AdminEmailVerification />} />
        <Route path="/admin/setup-pin" element={<AdminRoute><AdminPinSetup /></AdminRoute>} />
        <Route path="/admin-dashboard" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
        <Route path="/user-management" element={<AdminRoute><UserManagement /></AdminRoute>} />
        <Route path="/admin/alumni-signups" element={<AdminRoute><AdminAlumniSignups /></AdminRoute>} />
        <Route path="/suspended-users" element={<AdminRoute><SuspendedUsers /></AdminRoute>} />
        <Route path="/post-moderation" element={<AdminRoute><PostModeration /></AdminRoute>} />
        <Route path="/reports-analytics" element={<AdminRoute><ReportsAnalytics /></AdminRoute>} />
        <Route path="/sentiment-analysis" element={<AdminRoute><SentimentAnalysis /></AdminRoute>} />
        <Route path="/admin/profile-settings" element={<AdminRoute><AdminProfileSettings /></AdminRoute>} />
        <Route path="/:username" element={<PublicUserProfile />} />
        
        {/* Protected Routes - user stays until logout */}
        <Route path="/home" element={<PrivateRoute><HomeFeed /></PrivateRoute>} />
        <Route path="/create-post" element={<PrivateRoute><CreatePost /></PrivateRoute>} />
        <Route path="/profile" element={<PrivateRoute><UserProfile /></PrivateRoute>} />
        <Route path="/edit-profile" element={<PrivateRoute><EditProfile /></PrivateRoute>} />
        <Route path="/user/:username" element={<PrivateRoute><ViewUserProfile /></PrivateRoute>} />
        <Route path="/hashtag/:hashtag" element={<PrivateRoute><HashtagPage /></PrivateRoute>} />
        <Route path="/discussion" element={<PrivateRoute><DiscussionForum /></PrivateRoute>} />
        <Route path="/discussion/:groupId" element={<PrivateRoute><DiscussionForum /></PrivateRoute>} />
        <Route path="/lists/:listId" element={<PrivateRoute><Lists /></PrivateRoute>} />
        <Route path="/lists" element={<PrivateRoute><Lists /></PrivateRoute>} />
        <Route path="/messages" element={<PrivateRoute><Messaging /></PrivateRoute>} />
        <Route path="/notifications" element={<PrivateRoute><Notifications /></PrivateRoute>} />
        <Route path="/explore" element={<PrivateRoute><Trending /></PrivateRoute>} />
        <Route path="/explore/department/:departmentId" element={<PrivateRoute><DepartmentTrends /></PrivateRoute>} />
        <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
        <Route path="/blocked-users" element={<PrivateRoute><BlockedUsers /></PrivateRoute>} />
        </Routes>
      </CreatePostProvider>
    </BrowserRouter>
  );
}

export default App;
