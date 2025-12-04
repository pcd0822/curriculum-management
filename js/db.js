/**
 * Database Module
 * Handles communication with Google Apps Script.
 */

const DB = {
    apiUrl: null,

    init: (url) => {
        DB.apiUrl = url;
    },

    /**
     * Checks if API URL is set.
     */
    isConfigured: () => {
        return !!DB.apiUrl;
    },

    /**
     * Fetches course configuration from the server.
     */
    fetchConfig: async () => {
        if (!DB.apiUrl) throw new Error("API URL not configured");
        const response = await fetch(`${DB.apiUrl}?action=getConfig`);
        if (!response.ok) throw new Error("Failed to fetch config");
        return await response.json();
    },

    /**
     * Saves course configuration to the server.
     * @param {Array} courses - List of course objects.
     */
    saveConfig: async (courses) => {
        if (!DB.apiUrl) throw new Error("API URL not configured");
        const response = await fetch(DB.apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain;charset=utf-8',
            },
            body: JSON.stringify({
                action: 'saveConfig',
                data: courses
            })
        });
        // With no-cors, we can't read response status or body.
        // But if we use redirect in GAS, we might get a response.
        // For now, let's assume success if no network error.
        // To get actual response, we need to handle CORS properly in GAS (return ContentService with headers).
        // Let's assume the GAS script handles CORS.

        // If we want to read response, we must NOT use no-cors.
        // We will try standard fetch. If CORS fails, user needs to fix GAS script.
        // But standard GAS deployment allows CORS if we return correct headers.

        // Re-implementation for standard GAS pattern:
        // POST requests to GAS are tricky.
        // Usually: Send as stringified JSON in body.
        return await response.json();
    },

    /**
     * Submits student response.
     * @param {Object} responseData 
     */
    submitResponse: async (responseData) => {
        if (!DB.apiUrl) throw new Error("API URL not configured");
        const response = await fetch(DB.apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                action: 'submitResponse',
                data: responseData
            })
        });
        return await response.json();
    },

    /**
     * Fetches all student responses.
     */
    fetchResponses: async () => {
        if (!DB.apiUrl) throw new Error("API URL not configured");
        const response = await fetch(`${DB.apiUrl}?action=getResponses`);
        if (!response.ok) throw new Error("Failed to fetch responses");
        return await response.json();
    }
};

window.DB = DB;
