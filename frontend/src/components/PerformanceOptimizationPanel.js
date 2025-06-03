import React, { useState } from 'react';
import RewardService from '../services/rewardService';
import Card from './Card';
import Button from './Button';

const PerformanceOptimizationPanel = () => {
  const [testResults, setTestResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const runPerformanceTest = async () => {
    setLoading(true);
    setError('');
    setTestResults(null);

    try {
      const results = await RewardService.testPerformance();
      setTestResults(results);
    } catch (err) {
      setError(err.message || 'Performance test failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          🚀 Rewards System Performance
        </h3>
        <Button
          onClick={runPerformanceTest}
          disabled={loading}
          className="px-4 py-2"
        >
          {loading ? '🔄 Testing...' : '🔬 Run Performance Test'}
        </Button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
          ❌ {error}
        </div>
      )}

      {testResults && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Legacy Performance */}
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <h4 className="font-medium text-red-800 mb-2">🐌 Legacy Approach</h4>
              <div className="text-sm text-red-700 space-y-1">
                <div>Time: {testResults.performanceTest.legacy.timeMs}ms</div>
                <div>Doses: {testResults.performanceTest.legacy.dosesFound}</div>
                <div>Points: {testResults.performanceTest.legacy.userPoints}</div>
              </div>
            </div>

            {/* Optimized Performance */}
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <h4 className="font-medium text-green-800 mb-2">⚡ Optimized Approach</h4>
              <div className="text-sm text-green-700 space-y-1">
                <div>Time: {testResults.performanceTest.optimized.timeMs}ms</div>
                <div>Doses: {testResults.performanceTest.optimized.dosesFound}</div>
                <div>Points: {testResults.performanceTest.optimized.userPoints}</div>
              </div>
            </div>
          </div>

          {/* Performance Improvement */}
          <div className={`p-4 rounded-lg border ${
            testResults.performanceTest.improvement.percentFaster > 0 
              ? 'bg-green-50 border-green-200' 
              : 'bg-yellow-50 border-yellow-200'
          }`}>
            <h4 className={`font-medium mb-2 ${
              testResults.performanceTest.improvement.percentFaster > 0 
                ? 'text-green-800' 
                : 'text-yellow-800'
            }`}>
              📈 Performance Results
            </h4>
            <div className={`text-sm space-y-1 ${
              testResults.performanceTest.improvement.percentFaster > 0 
                ? 'text-green-700' 
                : 'text-yellow-700'
            }`}>
              <div>
                Speed Improvement: {testResults.performanceTest.improvement.percentFaster}% faster
              </div>
              <div>
                Time Saved: {testResults.performanceTest.improvement.timeSavedMs}ms per request
              </div>
              <div>
                Status: {testResults.performanceTest.improvement.status === 'improved' 
                  ? '✅ Optimized!' 
                  : '⚠️ Minimal change'}
              </div>
            </div>
          </div>

          {/* Memory Usage */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-medium text-blue-800 mb-2">🧠 Memory Usage</h4>
            <div className="text-sm text-blue-700 space-y-1">
              <div>Heap Used: {testResults.performanceTest.memory.heapUsedMB} MB</div>
              <div>Heap Total: {testResults.performanceTest.memory.heapTotalMB} MB</div>
              <div>RSS: {testResults.performanceTest.memory.rssMB} MB</div>
            </div>
          </div>

          {/* Optimization Features */}
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <h4 className="font-medium text-gray-800 mb-2">🔧 Optimizations Applied</h4>
            <div className="text-sm text-gray-700 space-y-1">
              <div>✅ Consolidated API endpoint (single request instead of multiple)</div>
              <div>✅ Parallel data fetching with Promise.all()</div>
              <div>✅ Database indexes for rewards queries</div>
              <div>✅ Response compression middleware</div>
              <div>✅ 5-minute client-side caching</div>
              <div>✅ Memory management and garbage collection</div>
              <div>✅ Optimized MongoDB aggregation pipelines</div>
            </div>
          </div>

          <div className="text-xs text-gray-500 text-center">
            Test completed at: {new Date(testResults.timestamp).toLocaleString()}
          </div>
        </div>
      )}

      {!testResults && !loading && (
        <div className="text-center text-gray-500 py-8">
          Click "Run Performance Test" to validate the rewards system optimizations
        </div>
      )}
    </Card>
  );
};

export default PerformanceOptimizationPanel;
