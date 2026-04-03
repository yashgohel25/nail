// ─────────────────────────────────────────────────────────────
//  GitHub Storage API  –  Janki Nail Art
//  Token is stored securely in GITHUB_TOKEN environment variable
//  on the server. This file calls the backend proxy (/api/github-proxy)
//  so the token is NEVER exposed in the browser.
// ─────────────────────────────────────────────────────────────

const GithubStorage = {

    hasToken() {
        return true; // Token is on the server side
    },

    // Read data.json from GitHub via backend proxy
    async getData() {
        const res = await fetch('/api/github-proxy/data', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || 'Failed to load data');
        }
        return await res.json(); // returns { json, sha }
    },

    // Write data.json to GitHub via backend proxy
    async saveData(newData, sha) {
        const res = await fetch('/api/github-proxy/data', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: newData, sha })
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || 'Failed to save data');
        }
        return await res.json(); // returns { content: { sha } }
    },

    // Upload image via backend proxy
    async uploadImage(file, folder = 'images') {
        const base64Content = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.onerror = () => reject(new Error('File read failed'));
            reader.readAsDataURL(file);
        });

        const ext = file.name.split('.').pop().toLowerCase() || 'jpg';
        const safeName = file.name
            .replace(/\.[^/.]+$/, '')
            .replace(/[^a-zA-Z0-9]/g, '_')
            .toLowerCase()
            .substring(0, 40);
        const fileName = `${Date.now()}_${safeName}.${ext}`;

        const res = await fetch('/api/github-proxy/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileName, folder, base64Content, mimeType: file.type })
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || 'Upload failed');
        }
        const result = await res.json();
        return result.url;
    },

    // Delete image via backend proxy
    async deleteImage(filePath) {
        const res = await fetch('/api/github-proxy/delete-image', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filePath })
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.message || 'Delete failed');
        }
    },

    // List images via backend proxy
    async listImages(folder = 'images') {
        const res = await fetch(`/api/github-proxy/images?folder=${encodeURIComponent(folder)}`);
        if (!res.ok) return [];
        return await res.json();
    },

    // Test connection via backend proxy
    async testConnection() {
        const res = await fetch('/api/github-proxy/test');
        if (!res.ok) throw new Error('Connection test failed');
        return await res.json();
    }
};

window.GithubStorage = GithubStorage;
