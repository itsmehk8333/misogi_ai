import React from 'react';

// Performance monitoring utilities
export const performanceMonitor = {
  // Track component re-renders
  trackRenders: (componentName) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`🔄 ${componentName} rendered at ${new Date().toISOString()}`);
    }
  },

  // Measure function execution time
  measureTime: (label, fn) => {
    if (process.env.NODE_ENV === 'development') {
      const start = performance.now();
      const result = fn();
      const end = performance.now();
      console.log(`⏱️ ${label}: ${(end - start).toFixed(2)}ms`);
      return result;
    }
    return fn();
  },

  // Track expensive operations
  trackExpensiveOperation: async (operationName, asyncFn) => {
    if (process.env.NODE_ENV === 'development') {
      const start = performance.now();
      console.log(`🚀 Starting ${operationName}...`);
      
      try {
        const result = await asyncFn();
        const end = performance.now();
        console.log(`✅ ${operationName} completed in ${(end - start).toFixed(2)}ms`);
        return result;
      } catch (error) {
        const end = performance.now();
        console.log(`❌ ${operationName} failed after ${(end - start).toFixed(2)}ms:`, error);
        throw error;
      }
    }
    return await asyncFn();
  },

  // Monitor memory usage
  logMemoryUsage: (label) => {
    if (process.env.NODE_ENV === 'development' && 'memory' in performance) {
      const memInfo = performance.memory;
      console.log(`💾 ${label} Memory:`, {
        used: `${(memInfo.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB`,
        total: `${(memInfo.totalJSHeapSize / 1024 / 1024).toFixed(2)}MB`,
        limit: `${(memInfo.jsHeapSizeLimit / 1024 / 1024).toFixed(2)}MB`
      });
    }
  },

  // Track React profiler data
  onRender: (id, phase, actualDuration, baseDuration, startTime, commitTime) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`📊 Profiler [${id}]:`, {
        phase,
        actualDuration: `${actualDuration.toFixed(2)}ms`,
        baseDuration: `${baseDuration.toFixed(2)}ms`,
        startTime: `${startTime.toFixed(2)}ms`,
        commitTime: `${commitTime.toFixed(2)}ms`
      });
    }
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
    if (process.env.NODE_ENV === 'development') {
      console.log(`🟢 ${componentName} mounted`);
      performanceMonitor.logMemoryUsage(`${componentName} mount`);
      
      return () => {
        console.log(`🔴 ${componentName} unmounted`);
        performanceMonitor.logMemoryUsage(`${componentName} unmount`);
      };
    }
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
