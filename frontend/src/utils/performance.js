import React from 'react';

// Performance monitoring utilities
export const performanceMonitor = {
  // Track component re-renders
  trackRenders: (componentName) => {
    // Development-only logging removed for production
  },

  // Measure function execution time
  measureTime: (label, fn) => {
    return fn();
  },

  // Track expensive operations
  trackExpensiveOperation: async (operationName, asyncFn) => {
    return await asyncFn();
  },

  // Monitor memory usage
  logMemoryUsage: (label) => {
    // Development-only logging removed for production
  },

  // Track React profiler data
  onRender: (id, phase, actualDuration, baseDuration, startTime, commitTime) => {
    // Development-only logging removed for production
  }
};

// Higher-order component to track renders
export const withRenderTracking = (WrappedComponent, componentName) => {
  const TrackedComponent = (props) => {
    performanceMonitor.trackRenders(componentName);
    return <WrappedComponent {...props} />;
  };
  
  TrackedComponent.displayName = `withRenderTracking(${componentName})`;
  return TrackedComponent;
};

// Hook to track component mount/unmount
export const useComponentLifecycle = (componentName) => {
  React.useEffect(() => {
    // Development-only logging removed for production
  }, [componentName]);
};

// Throttle function for performance optimization
export const throttle = (func, limit) => {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

// Debounce function for performance optimization
export const debounce = (func, delay) => {
  let timeoutId;
  return function(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
};
