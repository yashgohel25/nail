// ─────────────────────────────────────────────────────────────
//  GitHub Storage API  –  Janki Nail Art
//  Token is hardcoded here (not in admin panel).
//  To regenerate: GitHub → Settings → Developer Settings →
//  Personal Access Tokens → Fine-grained tokens → New token
//  Required permissions: Contents (read & write)
// ─────────────────────────────────────────────────────────────

const GITHUB_CONFIG = {
    // ⚠️ WARNING: If this repository is public, GitHub will automatically revoke this token.
    token: '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',
    owner: 'yashgohel25',
    repo: 'nail',
    branch: 'main',
    path: 'data.json'
};

// ── Base fetch wrapper ────────────────────────────────────────
async function ghFetch(url, options = {}) {
    const headers = {
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        ...options.headers
    };

    if (GITHUB_CONFIG.token && GITHUB_CONFIG.token.length > 10) {
        headers['Authorization'] = `token ${GITHUB_CONFIG.token}`;
    }
    
    const res = await fetch(url, { ...options, headers });
    
    if (!res.ok) {
        let errMsg = `GitHub API Error ${res.status}`;
        try { const e = await res.json(); errMsg = e.message || errMsg; } catch { }
        throw new Error(errMsg);
    }
    return res.json();
}

// ── Main storage object ───────────────────────────────────────
const GithubStorage = {

    // Check if token is configured
    hasToken() {
        return GITHUB_CONFIG.token && GITHUB_CONFIG.token.length > 10;
    },

    // Read data.json from GitHub (returns { json, sha })
    async getData() {
        try {
            const url = `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${GITHUB_CONFIG.path}?ref=${GITHUB_CONFIG.branch}&t=${Date.now()}`;
            const data = await ghFetch(url);
            const clean = data.content.replace(/\n/g, '');
            const content = decodeURIComponent(escape(atob(clean)));
            return { json: JSON.parse(content), sha: data.sha };
        } catch (e) {
            console.warn('GitHub getData fallback:', e.message);
            // Fallback: read local data.json
            const r = await fetch('data.json?t=' + Date.now());
            if (!r.ok) throw new Error('Cannot load data.json');
            const localData = await r.json();
            return { json: localData, sha: null };
        }
    },

    // Write data.json to GitHub
    async saveData(newData, sha) {
        const url = `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${GITHUB_CONFIG.path}`;
        const content = btoa(unescape(encodeURIComponent(JSON.stringify(newData, null, 2))));
        const body = {
            message: `Update data.json via Admin Panel [${new Date().toLocaleString('en-IN')}]`,
            content,
            branch: GITHUB_CONFIG.branch
        };
        if (sha) body.sha = sha;
        const res = await ghFetch(url, {
            method: 'PUT',
            body: JSON.stringify(body)
        });
        return res;
    },

    // Upload an image file → saves to images/ folder in repo → returns CDN URL
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
        const filePath = `${folder}/${fileName}`;
        const url = `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${filePath}`;

        await ghFetch(url, {
            method: 'PUT',
            body: JSON.stringify({
                message: `Upload image: ${fileName}`,
                content: base64Content,
                branch: GITHUB_CONFIG.branch
            })
        });

        return `https://cdn.jsdelivr.net/gh/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}@${GITHUB_CONFIG.branch}/${filePath}`;
    },

    // Delete an image from the repo
    async deleteImage(filePath) {
        const url = `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${filePath}`;
        const fileInfo = await ghFetch(url + `?ref=${GITHUB_CONFIG.branch}`);
        await ghFetch(url, {
            method: 'DELETE',
            body: JSON.stringify({
                message: `Delete image: ${filePath}`,
                sha: fileInfo.sha,
                branch: GITHUB_CONFIG.branch
            })
        });
    },

    // List all images in a folder
    async listImages(folder = 'images') {
        try {
            const url = `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${folder}?ref=${GITHUB_CONFIG.branch}&t=${Date.now()}`;
            const files = await ghFetch(url);
            return files
                .filter(f => /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(f.name))
                .map(f => ({
                    name: f.name,
                    path: f.path,
                    url: `https://cdn.jsdelivr.net/gh/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}@${GITHUB_CONFIG.branch}/${f.path}`,
                    sha: f.sha
                }));
        } catch {
            return [];
        }
    },

    // Test connection
    async testConnection() {
        const url = `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}`;
        return await ghFetch(url);
    }
};

window.GithubStorage = GithubStorage;
window.GITHUB_CONFIG = GITHUB_CONFIG;
