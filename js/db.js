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
    },

    /**
     * Fetches settings from the server.
     */
    fetchSettings: async () => {
        if (!DB.apiUrl) throw new Error("API URL not configured");
        const response = await fetch(`${DB.apiUrl}?action=getSettings`);
        if (!response.ok) throw new Error("Failed to fetch settings");
        return await response.json();
    },

    /**
     * Saves settings to the server.
     * @param {Object} settings - Settings object.
     */
    saveSettings: async (settings) => {
        if (!DB.apiUrl) throw new Error("API URL not configured");
        await fetch(DB.apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                action: 'saveSettings',
                data: settings
            })
        });
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
