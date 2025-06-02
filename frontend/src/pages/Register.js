import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button, Input, Card, Alert } from '../components';
import useAuthStore from '../store/authStore';
import { validateEmail, validatePassword } from '../utils';
import { debugAuthState, prepareForRegistration } from '../utils/debugAuth';

const Register = () => {
  const navigate = useNavigate();
  const { register, loading, error } = useAuthStore();
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    dateOfBirth: '',
    phoneNumber: '',
    agreedToTerms: false
  });
  
  const [validationErrors, setValidationErrors] = useState({});

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    // Clear validation error when user starts typing
    if (validationErrors[name]) {
      setValidationErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const errors = {};
    
    if (!formData.firstName.trim()) {
      errors.firstName = 'First name is required';
    }
    
    if (!formData.lastName.trim()) {
      errors.lastName = 'Last name is required';
    }
    
    if (!formData.email) {
      errors.email = 'Email is required';
    } else if (!validateEmail(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }
    
    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (!validatePassword(formData.password)) {
      errors.password = 'Password must be at least 8 characters with uppercase, lowercase, number, and special character';
    }
    
    if (!formData.confirmPassword) {
      errors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }
    
    if (!formData.dateOfBirth) {
      errors.dateOfBirth = 'Date of birth is required';
    } else {
      const birthDate = new Date(formData.dateOfBirth);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      if (age < 13) {
        errors.dateOfBirth = 'You must be at least 13 years old to use this service';
      }
    }
    
    if (!formData.agreedToTerms) {
      errors.agreedToTerms = 'You must agree to the terms and conditions';
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      console.log('🔍 Registration Debug: Starting...');
      debugAuthState();
      prepareForRegistration();
      
      const userData = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.toLowerCase(),
        password: formData.password,
        dateOfBirth: formData.dateOfBirth,
        phoneNumber: formData.phoneNumber.trim() || undefined
      };
      
      console.log('📝 Calling register function...');
      const result = await register(userData);
      console.log('✅ Registration result:', result);
      
      if (result) {
        console.log('🚀 Registration successful, redirecting to login...');
        // Navigate to login page so user can sign in
        navigate('/login', { 
          replace: true, 
          state: { 
            message: 'Registration successful! Please log in with your credentials.',
            email: userData.email 
          }
        });
      }
      
    } catch (error) {
      console.error('❌ Registration failed:', error);
    }
  };
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 flex items-center justify-center py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-lg w-full space-y-6 sm:space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto h-14 w-14 sm:h-16 sm:w-16 bg-gradient-to-br from-medical-500 to-medical-600 dark:from-medical-400 dark:to-medical-500 rounded-2xl flex items-center justify-center shadow-lg transform hover:scale-105 transition-transform duration-300">
            <svg className="h-8 w-8 sm:h-9 sm:w-9 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <h2 className="mt-6 text-2xl sm:text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-200 bg-clip-text text-transparent">
            Create your MedTracker account
          </h2>
          <p className="mt-2 text-sm sm:text-base text-gray-600 dark:text-gray-400 max-w-sm mx-auto">
            Join thousands of users taking control of their medication adherence
          </p>
        </div>

        {/* Registration Form */}
        <Card className="p-6 sm:p-8 bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm border border-gray-200 dark:border-gray-700 shadow-xl hover:shadow-2xl transition-shadow duration-300">
          <form className="space-y-5 sm:space-y-6" onSubmit={handleSubmit}>
            {error && (
              <Alert
                type="error"
                message={error}
                className="mb-4"
              />
            )}

            {/* Name Fields */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
              <div>
                <label htmlFor="firstName" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  First Name
                </label>
                <Input
                  id="firstName"
                  name="firstName"
                  type="text"
                  autoComplete="given-name"
                  required
                  value={formData.firstName}
                  onChange={handleChange}
                  placeholder="First name"
                  error={validationErrors.firstName}
                  className="dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400 focus:ring-medical-500 focus:border-medical-500 dark:focus:ring-medical-400 dark:focus:border-medical-400"
                />
              </div>

              <div>
                <label htmlFor="lastName" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Last Name
                </label>
                <Input
                  id="lastName"
                  name="lastName"
                  type="text"
                  autoComplete="family-name"
                  required
                  value={formData.lastName}
                  onChange={handleChange}
                  placeholder="Last name"
                  error={validationErrors.lastName}
                  className="dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400 focus:ring-medical-500 focus:border-medical-500 dark:focus:ring-medical-400 dark:focus:border-medical-400"
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Email Address
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={formData.email}
                onChange={handleChange}
                placeholder="Enter your email"
                error={validationErrors.email}
                className="dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400 focus:ring-medical-500 focus:border-medical-500 dark:focus:ring-medical-400 dark:focus:border-medical-400"
              />
            </div>

            {/* Password Fields */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
              <div>
                <label htmlFor="password" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Password
                </label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Create password"
                  error={validationErrors.password}
                  className="dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400 focus:ring-medical-500 focus:border-medical-500 dark:focus:ring-medical-400 dark:focus:border-medical-400"
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Confirm Password
                </label>
                <Input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Confirm password"
                  error={validationErrors.confirmPassword}
                  className="dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400 focus:ring-medical-500 focus:border-medical-500 dark:focus:ring-medical-400 dark:focus:border-medical-400"
                />
              </div>
            </div>

            {/* Date of Birth and Phone Number */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
              <div>
                <label htmlFor="dateOfBirth" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Date of Birth
                </label>
                <Input
                  id="dateOfBirth"
                  name="dateOfBirth"
                  type="date"
                  required
                  value={formData.dateOfBirth}
                  onChange={handleChange}
                  error={validationErrors.dateOfBirth}
                  className="dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400 focus:ring-medical-500 focus:border-medical-500 dark:focus:ring-medical-400 dark:focus:border-medical-400"
                />
              </div>

              <div>
                <label htmlFor="phoneNumber" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Phone Number <span className="text-gray-400 dark:text-gray-500 font-normal">(Optional)</span>
                </label>
                <Input
                  id="phoneNumber"
                  name="phoneNumber"
                  type="tel"
                  autoComplete="tel"
                  value={formData.phoneNumber}
                  onChange={handleChange}
                  placeholder="Enter phone number"
                  className="dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400 focus:ring-medical-500 focus:border-medical-500 dark:focus:ring-medical-400 dark:focus:border-medical-400"
                />
              </div>
            </div>

            {/* Terms Agreement */}
            <div className="flex items-start space-x-3">
              <div className="flex items-center h-5 mt-1">
                <input
                  id="agreedToTerms"
                  name="agreedToTerms"
                  type="checkbox"
                  checked={formData.agreedToTerms}
                  onChange={handleChange}
                  className="h-4 w-4 text-medical-600 dark:text-medical-400 focus:ring-medical-500 dark:focus:ring-medical-400 border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                />
              </div>
              <div className="text-sm">
                <label htmlFor="agreedToTerms" className="text-gray-700 dark:text-gray-300 leading-relaxed">
                  I agree to the{' '}
                  <Link to="/terms" className="text-medical-600 dark:text-medical-400 hover:text-medical-500 dark:hover:text-medical-300 font-semibold transition-colors duration-200">
                    Terms and Conditions
                  </Link>{' '}
                  and{' '}
                  <Link to="/privacy" className="text-medical-600 dark:text-medical-400 hover:text-medical-500 dark:hover:text-medical-300 font-semibold transition-colors duration-200">
                    Privacy Policy
                  </Link>
                </label>
                {validationErrors.agreedToTerms && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{validationErrors.agreedToTerms}</p>
                )}
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-to-r from-medical-600 to-medical-700 hover:from-medical-700 hover:to-medical-800 dark:from-medical-500 dark:to-medical-600 dark:hover:from-medical-600 dark:hover:to-medical-700 text-white font-semibold py-3 px-4 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-200"
              loading={loading}
              disabled={loading}
            >
              {loading ? 'Creating account...' : 'Create account'}
            </Button>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300 dark:border-gray-600" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-3 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-medium">
                  Already have an account?
                </span>
              </div>
            </div>

            <div className="mt-6">
              <Link
                to="/login"
                className="w-full flex justify-center py-3 px-4 border border-medical-300 dark:border-medical-600 rounded-xl shadow-sm text-sm font-semibold text-medical-700 dark:text-medical-300 bg-white dark:bg-gray-700 hover:bg-medical-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-medical-500 dark:focus:ring-medical-400 transition-all duration-200 transform hover:scale-[1.02]"
              >
                Sign in to existing account
              </Link>
            </div>
          </div>
        </Card>

        {/* Footer */}
        <div className="text-center">
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto leading-relaxed">
            By creating an account, you agree to our{' '}
            <Link to="/terms" className="text-medical-600 dark:text-medical-400 hover:text-medical-500 dark:hover:text-medical-300 font-medium transition-colors duration-200">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link to="/privacy" className="text-medical-600 dark:text-medical-400 hover:text-medical-500 dark:hover:text-medical-300 font-medium transition-colors duration-200">
              Privacy Policy
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
