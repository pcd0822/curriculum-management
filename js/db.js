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

        if (!response.ok) throw new Error("Failed to save config");
        const json = await response.json();
        return json;
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

        if (!response.ok) throw new Error("Failed to save settings");
        return await response.json();
    },


    /**
     * Submits student response.
     * @param {Object} responseData 
     */
    submitResponse: async (responseData) => {
        if (!DB.apiUrl) throw new Error("API URL not configured");

        try {
            const response = await fetch(DB.apiUrl, {
                method: 'POST',
                redirect: 'follow', // Explicitly follow redirects
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({
                    action: 'submitResponse',
                    data: responseData
                })
            });

            const text = await response.text();

            try {
                const json = JSON.parse(text);
                if (json.status === 'error') {
                    throw new Error(json.message || 'Server returned error status');
                }
                return json;
            } catch (e) {
                // If it's not JSON, it might be an HTML error page from Google
                console.error('Server response validation failed:', text);
                if (text.includes('<!DOCTYPE html>')) {
                    throw new Error('서버(Google Apps Script)에서 올바르지 않은 응답(HTML)을 반환했습니다. 스크립트 권한이나 배포 상태를 확인해주세요.');
                }
                throw new Error('서버 응답을 처리할 수 없습니다: ' + text.substring(0, 100));
            }
        } catch (error) {
            console.error('Submission error:', error);
            throw error;
        }
    },

    /**
     * Deletes specific responses.
     * @param {Array} ids - List of student IDs (GradeClassNumber) or timestamps to identify rows.
     */
    deleteResponse: async (ids) => {
        if (!DB.apiUrl) throw new Error("API URL not configured");

        const response = await fetch(DB.apiUrl, {
            method: 'POST',
            redirect: 'follow',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                action: 'deleteResponse',
                data: ids
            })
        });

        if (!response.ok) throw new Error("Failed to delete responses");

        const text = await response.text();
        try {
            const json = JSON.parse(text);
            if (json.status === 'error') throw new Error(json.message);
            return json;
        } catch (e) {
            console.warn("Server response was not JSON:", text);
            return { status: 'unknown', raw: text };
        }
    },

    /**
     * Fetches all student responses.
     */
    /**
     * Saves student registry to the server.
     * @param {Array} registry - List of student entries.
     */
    saveRegistry: async (registry) => {
        if (!DB.apiUrl) throw new Error("API URL not configured");
        const response = await fetch(DB.apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                action: 'saveRegistry',
                data: registry
            })
        });

        if (!response.ok) throw new Error("Failed to save registry");

        const text = await response.text();
        try {
            const json = JSON.parse(text);
            if (json.status === 'error') throw new Error(json.message);
            return json;
        } catch (e) {
            // If response is not JSON, it might be a simple success or error
            console.warn("Server response was not JSON:", text);
            return { status: 'unknown', raw: text };
        }
    },

    /**
     * Fetches all responses (for admin dashboard).
     */
    fetchResponses: async () => {
        if (!DB.apiUrl) throw new Error("API URL not configured");
        const response = await fetch(`${DB.apiUrl}?action=getResponses`);
        if (!response.ok) throw new Error("Failed to fetch responses");
        return await response.json();
    },

    /**
     * Fetches student registry.
     */
    fetchRegistry: async () => {
        if (!DB.apiUrl) throw new Error("API URL not configured");
        const response = await fetch(`${DB.apiUrl}?action=getRegistry`);
        if (!response.ok) throw new Error("Failed to fetch registry");
        return await response.json();
    }
};

window.DB = DB;
