// Memory management utilities
const mongoose = require('mongoose');

class MemoryManager {
  constructor() {
    this.gc = global.gc || (() => {
      console.warn('Garbage collection not enabled. Start with --expose-gc flag.');
    });
    this.memoryWarningThreshold = 1024 * 1024 * 1024; // 1GB
    this.gcInterval = null;
  }

  // Get current memory usage
  getMemoryUsage() {
    const usage = process.memoryUsage();
    return {
      rss: Math.round(usage.rss / 1024 / 1024 * 100) / 100, // MB
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024 * 100) / 100, // MB
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024 * 100) / 100, // MB
      external: Math.round(usage.external / 1024 / 1024 * 100) / 100, // MB
      arrayBuffers: Math.round(usage.arrayBuffers / 1024 / 1024 * 100) / 100 // MB
    };
  }

  // Log memory usage with label
  logMemoryUsage(label = '') {
    const usage = this.getMemoryUsage();
    console.log(`📊 Memory Usage ${label}:`, {
      RSS: `${usage.rss}MB`,
      HeapTotal: `${usage.heapTotal}MB`,
      HeapUsed: `${usage.heapUsed}MB`,
      External: `${usage.external}MB`,
      ArrayBuffers: `${usage.arrayBuffers}MB`
    });
    
    // Warning if memory usage is high
    if (usage.heapUsed > 512) { // 512MB threshold
      console.warn(`⚠️ High memory usage detected: ${usage.heapUsed}MB`);
    }
  }

  // Force garbage collection
  forceGC() {
    try {
      if (global.gc) {
        global.gc();
        console.log('🗑️ Manual garbage collection triggered');
      }
    } catch (error) {
      console.error('Failed to trigger garbage collection:', error);
    }
  }

  // Memory-aware pagination for large queries
  async safePaginate(Model, query = {}, options = {}) {
    const {
      page = 1,
      limit = 100,
      maxLimit = 500, // Safety limit
      sort = { _id: -1 },
      populate = null,
      select = null
    } = options;

    // Enforce maximum limit to prevent memory issues
    const safeLimit = Math.min(limit, maxLimit);
    const skip = (page - 1) * safeLimit;

    try {
      // Log memory before query
      this.logMemoryUsage(`before ${Model.collection.name} query`);

      let queryBuilder = Model.find(query)
        .sort(sort)
        .skip(skip)
        .limit(safeLimit);

      if (select) queryBuilder = queryBuilder.select(select);
      if (populate) queryBuilder = queryBuilder.populate(populate);

      const [results, total] = await Promise.all([
        queryBuilder.lean().exec(), // Use lean() for better memory efficiency
        Model.countDocuments(query)
      ]);

      // Log memory after query
      this.logMemoryUsage(`after ${Model.collection.name} query`);

      // Force GC if memory usage is high
      const usage = this.getMemoryUsage();
      if (usage.heapUsed > 256) { // 256MB threshold
        this.forceGC();
      }

      return {
        results,
        pagination: {
          page: parseInt(page),
          limit: safeLimit,
          total,
          pages: Math.ceil(total / safeLimit),
          hasNext: page * safeLimit < total,
          hasPrev: page > 1
        }
      };
    } catch (error) {
      console.error(`Memory-safe pagination error for ${Model.collection.name}:`, error);
      throw error;
    }
  }

  // Memory-aware aggregation with chunking
  async safeAggregate(Model, pipeline, options = {}) {
    const {
      chunkSize = 1000,
      maxResults = 10000
    } = options;

    try {
      this.logMemoryUsage(`before ${Model.collection.name} aggregation`);

      // Add limit to prevent excessive memory usage
      const safePipeline = [
        ...pipeline,
        { $limit: maxResults }
      ];

      const results = await Model.aggregate(safePipeline)
        .allowDiskUse(true) // Use disk for large operations
        .exec();

      this.logMemoryUsage(`after ${Model.collection.name} aggregation`);

      // Chunk results if they're too large
      if (results.length > chunkSize) {
        console.log(`📦 Chunking ${results.length} results into batches of ${chunkSize}`);
        const chunks = [];
        for (let i = 0; i < results.length; i += chunkSize) {
          chunks.push(results.slice(i, i + chunkSize));
        }
        return chunks;
      }

      return results;
    } catch (error) {
      console.error(`Memory-safe aggregation error for ${Model.collection.name}:`, error);
      throw error;
    }
  }

  // Clean up database connections
  async cleanup() {
    try {
      if (this.gcInterval) {
        clearInterval(this.gcInterval);
      }
      
      // Clear mongoose connection pool
      await mongoose.connection.db.admin().command({ connPoolSync: 1 });
      
      this.forceGC();
      console.log('🧹 Memory cleanup completed');
    } catch (error) {
      console.error('Memory cleanup error:', error);
    }
  }

  // Start periodic memory monitoring
  startMonitoring(intervalMs = 30000) { // 30 seconds
    this.gcInterval = setInterval(() => {
      const usage = this.getMemoryUsage();
      
      // Auto-trigger GC if memory usage is high
      if (usage.heapUsed > 400) { // 400MB threshold
        console.log('🚨 High memory usage detected, triggering garbage collection');
        this.forceGC();
      }
      
      // Log every 5 minutes for debugging
      if (Date.now() % (5 * 60 * 1000) < intervalMs) {
        this.logMemoryUsage('periodic check');
      }
    }, intervalMs);
  }

  // Memory-efficient stream processing
  async processInBatches(items, batchSize, processor) {
    const results = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      
      try {
        const batchResults = await processor(batch);
        results.push(...batchResults);
        
        // Force GC between batches
        if (i % (batchSize * 5) === 0) {
          this.forceGC();
        }
      } catch (error) {
        console.error(`Batch processing error at index ${i}:`, error);
        throw error;
      }
    }
    
    return results;
  }
}

// Export singleton instance
module.exports = new MemoryManager();
