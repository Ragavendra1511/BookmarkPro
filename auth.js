console.log('debug1 loaded');

class GoogleAuthManager {
    constructor() {
        this.CLIENT_ID = '732868914338-t6b1fiiio07mnr7smtrdp3rrhm0c7223.apps.googleusercontent.com';
        this.SCOPES = 'https://www.googleapis.com/auth/drive.appdata';
        this.isSignedIn = false;
        this.currentUser = null;
        this.accessToken = null;
        this.tokenClient = null;
        this.initializeGoogleIdentity();
    }

    async initializeGoogleIdentity() {
        await this.loadGISScript();
        this.tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: this.CLIENT_ID,
            scope: this.SCOPES,
            callback: this.handleTokenResponse.bind(this),
            ux_mode: 'popup'
        });
        this.restoreSession();
        if (!this.isSignedIn) this.showSignedOutState();
        console.log('Google Identity Services initialized successfully');
    }
    loadGISScript() {
        return new Promise((resolve, reject) => {
            if (window.google && window.google.accounts) { resolve(); return; }
            const script = document.createElement('script');
            script.src = 'https://accounts.google.com/gsi/client';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }
    persistSession() {
        localStorage.setItem('accessToken', this.accessToken || '');
        localStorage.setItem('currentUser', JSON.stringify(this.currentUser || {}));
    }
    removeSession() {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('currentUser');
    }
    restoreSession() {
        const storedToken = localStorage.getItem('accessToken');
        const storedUser = localStorage.getItem('currentUser');
        if (storedToken && storedUser) {
            this.accessToken = storedToken;
            this.currentUser = JSON.parse(storedUser);
            this.isSignedIn = true;
            this.showSignedInState();
            this.loadUserBookmarks();
        }
    }
    async handleTokenResponse(response) {
        if (response.error) {
            this.showSignedOutState();
            this.removeSession();
            return;
        }
        this.accessToken = response.access_token;
        this.isSignedIn = true;
        try {
            const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: { 'Authorization': `Bearer ${this.accessToken}` }
            });
            if (userResponse.ok) {
                this.currentUser = await userResponse.json();
            } else {
                this.currentUser = { name: 'User', email: '', picture: '' };
            }
        } catch (e) {
            this.currentUser = { name: 'User', email: '', picture: '' };
        }
        this.persistSession();
        this.showSignedInState();
        this.loadUserBookmarks();
    }
    showSignedInState() {
        const authContainer = document.getElementById('authContainer');
        if (authContainer) {
            authContainer.innerHTML = `
                <div class="user-profile">
                    <img src="${this.currentUser && this.currentUser.picture || ''}" alt="${this.currentUser && this.currentUser.name || 'User'}" class="user-avatar">
                    <div class="user-info">
                        <span class="user-name">${this.currentUser && this.currentUser.name || 'User'}</span>
                        <span class="user-email">${this.currentUser && this.currentUser.email || ''}</span>
                    </div>
                    <button class="btn btn--sm btn--outline" id="signOutBtn">Sign Out</button>
                </div>
                <button class="btn btn--sm btn--primary" id="syncBtn">Sync Bookmarks</button>
            `;
            document.getElementById('signOutBtn').onclick = () => this.signOut();
            document.getElementById('syncBtn').onclick = () => this.syncBookmarks();
        }
    }
    showSignedOutState() {
        const authContainer = document.getElementById('authContainer');
        if (authContainer) {
            authContainer.innerHTML = `
                <button class="btn btn--primary" id="signInBtn">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <!-- ...SVG icon... -->
                    </svg>
                    Sign in with Google
                </button>
            `;
            document.getElementById('signInBtn').onclick = () => this.signIn();
        }
    }
    signIn() {
        if (this.tokenClient) this.tokenClient.requestAccessToken({ prompt: 'consent' });
        else this.showNotification('Auth not initialized. Try again.', 'error');
    }
    signOut() {
        this.isSignedIn = false;
        this.currentUser = null;
        this.accessToken = null;
        if (window.google && window.google.accounts && window.google.accounts.id) {
            google.accounts.id.disableAutoSelect();
        }
        this.removeSession();
        this.showSignedOutState();
        this.showNotification('Signed out successfully', 'success');
    }

    // ALWAYS push current bookmarks to Drive after add/update/delete
    async syncBookmarks() {
        if (!this.isSignedIn || !this.accessToken) {
            this.showNotification('Please sign in to sync bookmarks', 'error');
            return;
        }
        try {
            this.showNotification('Syncing bookmarks...', 'info');
            const bm = window.bookmarkManager;
            if (!bm) throw new Error('Bookmark manager not found');
            const bookmarks = bm.bookmarks || [];
            await this.saveBookmarksToGoogleDrive(bookmarks);
            this.showNotification('Bookmarks synced successfully!', 'success');
        } catch (error) {
            this.showNotification('Failed to sync bookmarks', 'error');
        }
    }

    async saveBookmarksToGoogleDrive(bookmarks) {
        const fileMetadata = {
            name: 'bookmarkpro-bookmarks.json',
            parents: ['appDataFolder'],
            mimeType: 'application/json'
        };
        const q = encodeURIComponent("name='bookmarkpro-bookmarks.json' and parents in 'appDataFolder'");
        const listResp = await fetch(
            `https://www.googleapis.com/drive/v3/files?q=${q}&spaces=appDataFolder`,
            { headers: { 'Authorization': `Bearer ${this.accessToken}` } }
        );
        const result = await listResp.json();
        const files = result.files;
        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(fileMetadata)], { type: 'application/json' }));
        form.append('file', new Blob([JSON.stringify(bookmarks, null, 2)], { type: 'application/json' }));
        let response;
        if (files && files.length > 0) {
            const fileId = files[0].id;
            response = await fetch(
                `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`,
                { method: 'PATCH', headers: { 'Authorization': `Bearer ${this.accessToken}` }, body: form }
            );
        } else {
            response = await fetch(
                'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
                { method: 'POST', headers: { 'Authorization': `Bearer ${this.accessToken}` }, body: form }
            );
        }
        if (!response.ok) {
            throw new Error('Failed to save bookmarks to Google Drive');
        }
        return response.json();
    }
    async loadUserBookmarks() {
        if (!this.isSignedIn || !this.accessToken) return;
        try {
            const bookmarks = await this.loadBookmarksFromGoogleDrive();
            if (bookmarks && bookmarks.length > 0) {
                const bm = window.bookmarkManager;
                if (bm) bm.replaceBookmarks(bookmarks);
            }
        } catch (error) { }
    }
    async loadBookmarksFromGoogleDrive() {
        try {
            const q = encodeURIComponent("name='bookmarkpro-bookmarks.json' and parents in 'appDataFolder'");
            const response = await fetch(
                `https://www.googleapis.com/drive/v3/files?q=${q}&spaces=appDataFolder`,
                { headers: { 'Authorization': `Bearer ${this.accessToken}` } }
            );
            const result = await response.json();
            const files = result.files;
            if (files && files.length > 0) {
                const fileId = files[0].id;
                const fileResponse = await fetch(
                    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
                    { headers: { 'Authorization': `Bearer ${this.accessToken}` } }
                );
                if (fileResponse.ok) return await fileResponse.json();
            }
        } catch (error) {}
        return null;
    }
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification--${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 16px;
            border-radius: 8px;
            color: white;
            z-index: 10000;
            background-color: ${
                type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'
            };
        `;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
    }
}
// --- BookmarkManager extension ---
class GoogleIntegratedBookmarkManager extends BookmarkManager {
    constructor() {
        super();
        this.googleAuth = new GoogleAuthManager();
        window.bookmarkManager = this;
    }
    init() {
        super.init();
        this.addGoogleAuthContainer();
    }
    addGoogleAuthContainer() {
        const header = document.querySelector('.header__right');
        if (header) {
            const authContainer = document.createElement('div');
            authContainer.id = 'authContainer';
            authContainer.className = 'auth-container';
            const addBtn = document.getElementById('addBookmarkBtn');
            header.insertBefore(authContainer, addBtn);
        }
    }
}
document.addEventListener('DOMContentLoaded', () => {
    new GoogleIntegratedBookmarkManager();
});

