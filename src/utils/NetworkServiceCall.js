// networkServiceCall.js
const networkServiceCall = async (method, url, extraHeaders = {}, body = {}) => {
  try {
    const dataset = {
      method: method.toUpperCase(),
      headers: {
        'Content-Type': 'application/json',
        ...extraHeaders,
      },
    };

    if (method.toUpperCase() !== 'GET') {
      dataset.body = JSON.stringify(body);
    }

    const response = await fetch(url, dataset);
    const result = await response.json();
    return result;

  } catch (error) {
    console.error("🚨 NetworkServiceCall Error:", error.message);
    throw error;
  }
};

// GET API Call helper
export const getApiCall = (url, extraHeaders = {}) => {
  return networkServiceCall('GET', url, extraHeaders);
};

// POST API Call helper
export const postApiCall = (url, body = {}, extraHeaders = {}) => {
  return networkServiceCall('POST', url, extraHeaders, body);
};

export default networkServiceCall;
