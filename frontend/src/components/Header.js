import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from './';
import useAuthStore from '../store/authStore';
import useRewardsStore from '../store/rewardsStore';

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const { userRewards, fetchUserRewards, canClaimDailyReward, resetDailyReward } = useRewardsStore();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  // Fetch rewards data when component mounts
  useEffect(() => {
    if (user?._id) {
      fetchUserRewards(user._id).catch(console.error);
      resetDailyReward();
    }
  }, [user?._id, fetchUserRewards, resetDailyReward]);

  const handleLogout = () => {
    logout();
    navigate('/login');
    setIsMobileMenuOpen(false);
  };

  // Don't show header on login/register pages
  if (['/login', '/register'].includes(location.pathname)) {
    return null;
  }
  const navLinks = [
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/add-medication', label: 'Add Medication' },
    { path: '/dose-logging', label: 'Log Dose' },
    { path: '/rewards', label: 'Rewards', badge: canClaimDailyReward() },
    { path: '/adherence-reports', label: 'Reports' },
    { path: '/settings', label: 'Settings' }
  ];

  const handleNavClick = (path) => {
    navigate(path);
    setIsMobileMenuOpen(false);
  };
  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 justify-between items-center">
          {/* Logo and App Name */}
          <div className="flex items-center flex-shrink-0">
            <div 
              className="flex items-center cursor-pointer"
              onClick={() => navigate('/dashboard')}
            >
              <div className="bg-medical-600 text-white p-2 rounded-lg mr-3">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">MedTracker</h1>
            </div>
          </div>          {/* Desktop Navigation */}
          <nav className="hidden md:flex space-x-4">
            {navLinks.map(({ path, label, badge }) => (
              <div key={path} className="relative">
                <Button
                  variant={location.pathname === path ? 'primary' : 'ghost'}
                  onClick={() => navigate(path)}
                  className={`${
                    location.pathname === path
                      ? 'dark:bg-medical-600 dark:hover:bg-medical-700'
                      : 'dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-700'
                  }`}
                >
                  {label}
                </Button>
                {badge && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    !
                  </span>
                )}
              </div>
            ))}
          </nav>

          {/* Desktop User Menu with Rewards */}
          <div className="hidden md:flex items-center space-x-4">
            {/* Rewards Summary */}
            <div className="flex items-center space-x-3 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 px-3 py-2 rounded-lg border border-blue-200 dark:border-blue-700">
              <div className="text-center">
                <div className="text-sm font-bold text-blue-600 dark:text-blue-400">
                  {userRewards?.totalPoints || 0}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Points</div>
              </div>
              <div className="text-center">
                <div className="text-sm font-bold text-purple-600 dark:text-purple-400">
                  {userRewards?.currentLevel || 1}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Level</div>
              </div>
              <div className="text-center">
                <div className="text-sm font-bold text-orange-600 dark:text-orange-400">
                  {userRewards?.currentStreak || 0}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Streak</div>
              </div>
            </div>
            
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Hello, {user?.firstName || 'User'}
            </span>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleLogout}
              className="dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Logout
            </Button>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:text-gray-500 dark:hover:text-gray-400 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-medical-500"
              aria-expanded="false"
            >
              <span className="sr-only">Open main menu</span>
              {!isMobileMenuOpen ? (
                <svg className="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              ) : (
                <svg className="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>      {/* Mobile menu */}
      {isMobileMenuOpen && (        <div className="md:hidden">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-lg">
            {navLinks.map(({ path, label, badge }) => (
              <div key={path} className="relative">
                <button
                  onClick={() => handleNavClick(path)}
                  className={`block px-3 py-2 rounded-md text-base font-medium w-full text-left transition-all duration-200 ${
                    location.pathname === path
                      ? 'bg-medical-100 dark:bg-medical-900 text-medical-700 dark:text-medical-200 border-l-4 border-medical-500'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {label}
                  {badge && (
                    <span className="ml-2 bg-red-500 text-white text-xs rounded-full px-2 py-1">
                      New Reward!
                    </span>
                  )}
                </button>
              </div>
            ))}
            
            {/* Mobile Rewards Summary */}
            <div className="mx-3 my-3 p-3 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                    {userRewards?.totalPoints || 0}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Points</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
                    {userRewards?.currentLevel || 1}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Level</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-orange-600 dark:text-orange-400">
                    {userRewards?.currentStreak || 0}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Streak</div>
                </div>
              </div>
            </div>
            
            {/* Mobile User Info and Logout */}
            <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700 mt-3">
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                Hello, {user?.firstName || 'User'}
              </div>
              <button
                onClick={handleLogout}
                className="w-full text-left px-3 py-2 rounded-md text-base font-medium text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/20 transition-all duration-200"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}</header>
  );
};

export default Header;
