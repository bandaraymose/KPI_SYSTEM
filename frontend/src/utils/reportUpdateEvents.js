// Real-time Report Update Events Utility
// Use these functions throughout the application to notify the Reports component of evaluation changes

/**
 * Notify all listening components that an evaluation has been created
 * @param {Object} evaluationData - The evaluation data that was created
 */
export const notifyEvaluationCreated = (evaluationData) => {
  console.log('📢 Broadcasting evaluation created event:', evaluationData);
  
  // Dispatch custom event
  const event = new CustomEvent('evaluationCreated', {
    detail: { evaluation: evaluationData, timestamp: new Date() }
  });
  window.dispatchEvent(event);
  
  // Also set localStorage signal for cross-tab communication
  localStorage.setItem('evaluationUpdated', JSON.stringify({
    type: 'created',
    evaluation: evaluationData,
    timestamp: new Date().toISOString()
  }));
  
  // Remove the signal after a short delay to trigger storage event
  setTimeout(() => {
    localStorage.removeItem('evaluationUpdated');
  }, 100);
};

/**
 * Notify all listening components that an evaluation has been updated
 * @param {Object} evaluationData - The evaluation data that was updated
 */
export const notifyEvaluationUpdated = (evaluationData) => {
  console.log('📢 Broadcasting evaluation updated event:', evaluationData);
  
  // Dispatch custom event
  const event = new CustomEvent('evaluationUpdated', {
    detail: { evaluation: evaluationData, timestamp: new Date() }
  });
  window.dispatchEvent(event);
  
  // Also set localStorage signal for cross-tab communication
  localStorage.setItem('evaluationUpdated', JSON.stringify({
    type: 'updated',
    evaluation: evaluationData,
    timestamp: new Date().toISOString()
  }));
  
  // Remove the signal after a short delay to trigger storage event
  setTimeout(() => {
    localStorage.removeItem('evaluationUpdated');
  }, 100);
};

/**
 * Request all report components to refresh their data
 * Use this when multiple evaluations have been updated or when you want to force a refresh
 */
export const requestReportRefresh = (reason = 'manual') => {
  console.log(`📢 Broadcasting report refresh request: ${reason}`);
  
  // Dispatch custom event
  const event = new CustomEvent('reportRefreshRequested', {
    detail: { reason, timestamp: new Date() }
  });
  window.dispatchEvent(event);
  
  // Also set localStorage signal for cross-tab communication
  localStorage.setItem('reportRefreshNeeded', JSON.stringify({
    reason,
    timestamp: new Date().toISOString()
  }));
  
  // Remove the signal after a short delay to trigger storage event
  setTimeout(() => {
    localStorage.removeItem('reportRefreshNeeded');
  }, 100);
};

/**
 * Helper function to add to API service methods
 * Call this after successful evaluation API calls
 */
export const triggerEvaluationUpdateIfNeeded = (response, operation) => {
  if (response && response.id) {
    if (operation === 'create') {
      notifyEvaluationCreated(response);
    } else if (operation === 'update') {
      notifyEvaluationUpdated(response);
    }
  }
};

/**
 * Enhanced API wrapper that automatically triggers real-time updates
 * Use this to wrap evaluation-related API calls
 */
export const withRealTimeUpdates = (apiCall, operation) => {
  return async (...args) => {
    try {
      const response = await apiCall(...args);
      triggerEvaluationUpdateIfNeeded(response, operation);
      return response;
    } catch (error) {
      // Still throw the error, but log that the update failed
      console.error(`API call failed for ${operation}:`, error);
      throw error;
    }
  };
};

export default {
  notifyEvaluationCreated,
  notifyEvaluationUpdated,
  requestReportRefresh,
  triggerEvaluationUpdateIfNeeded,
  withRealTimeUpdates
};