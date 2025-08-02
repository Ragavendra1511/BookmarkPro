console.log('Auth.js loaded');

class GoogleAuthManager {
    constructor() {
        this.CLIENT_ID = '732868914338-t6b1fiiio07mnr7smtrdp3rrhm0c7223.apps.googleusercontent.com';
        // UPDATED SCOPE: Allows appDataFolder use!
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

        if (!this.isSignedIn) {
            this.showSignedOutState();
        }
        console.log('Google Identity Services initialized successfully');
    }

    loadGISScript() {
        return new Promise((resolve, reject) => {
            if (window.google && window.google.accounts) {
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = 'https://accounts.google.com/gsi/client';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    // ---- AUTH STATE PERSIST ----
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
    // ----------------------------

    async handleTokenResponse(response) {
        if (response.error) {
            console.error('Token error:', response.error);
            this.showNotification('Google authentication failed.', 'error');
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
        if (!this.currentUser) return;
        const authContainer = document.getElementById('authContainer');
        if (authContainer) {
            authContainer.innerHTML = `
                <div class="user-profile">
                    <img src="${this.currentUser.picture || ''}" alt="${this.currentUser.name || 'User'}" class="user-avatar">
                    <div class="user-info">
                        <span class="user-name">${this.currentUser.name || 'User'}</span>
                        <span class="user-email">${this.currentUser.email || ''}</span>
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
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Sign in with Google
                </button>
            `;
            document.getElementById('signInBtn').onclick = () => this.signIn();
        }
    }

    signIn() {
        if (this.tokenClient) {
            this.tokenClient.requestAccessToken({ prompt: 'consent' });
        } else {
            this.showNotification('Auth not initialized. Try again.', 'error');
        }
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

    async syncBookmarks() {
        if (!this.isSignedIn || !this.accessToken) {
            this.showNotification('Please sign in to sync bookmarks', 'error');
            return;
        }
        try {
            this.showNotification('Syncing bookmarks...', 'info');
            const bookmarkManager = window.bookmarkManager;
            if (!bookmarkManager) throw new Error('Bookmark manager not found');
            const bookmarks = bookmarkManager.bookmarks || [];
            await this.saveBookmarksToGoogleDrive(bookmarks);
            this.showNotification('Bookmarks synced successfully!', 'success');
        } catch (error) {
            console.error('Error syncing bookmarks:', error);
            this.showNotification('Failed to sync bookmarks', 'error');
        }
    }

    async saveBookmarksToGoogleDrive(bookmarks) {
        const fileMetadata = {
            name: 'bookmarkpro-bookmarks.json',
            parents: ['appDataFolder'],
            mimeType: 'application/json'
        };
        // 1. Check if file exists
        const q = encodeURIComponent("name='bookmarkpro-bookmarks.json' and parents in 'appDataFolder'");
        const listResp = await fetch(
            `https://www.googleapis.com/drive/v3/files?q=${q}&spaces=appDataFolder`,
            {
                headers: { 'Authorization': `Bearer ${this.accessToken}` }
            }
        );
        const result = await listResp.json();
        const files = result.files;
        const form = new FormData();
        form.append(
            'metadata',
            new Blob([JSON.stringify(fileMetadata)], { type: 'application/json' })
        );
        form.append(
            'file',
            new Blob([JSON.stringify(bookmarks, null, 2)], { type: 'application/json' })
        );

        let response;
        if (files && files.length > 0) {
            // Update existing: PATCH
            const fileId = files[0].id;
            response = await fetch(
                `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`,
                {
                    method: 'PATCH',
                    headers: { 'Authorization': `Bearer ${this.accessToken}` },
                    body: form
                }
            );
        } else {
            // Create new: POST
            response = await fetch(
                'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
                {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${this.accessToken}` },
                    body: form
                }
            );
        }
        if (!response.ok) {
            const errorText = await response.text();
            console.error("Drive API error (status " + response.status + "):", errorText);
            throw new Error('Failed to save bookmarks to Google Drive');
        }
        return response.json();
    }

    async loadUserBookmarks() {
        if (!this.isSignedIn || !this.accessToken) return;
        try {
            const bookmarks = await this.loadBookmarksFromGoogleDrive();
            if (bookmarks && bookmarks.length > 0) {
                const bookmarkManager = window.bookmarkManager;
                if (bookmarkManager) bookmarkManager.mergeBookmarks(bookmarks);
            }
        } catch (error) {
            console.error('Error loading user bookmarks:', error);
        }
    }

    async loadBookmarksFromGoogleDrive() {
        try {
            const q = encodeURIComponent("name='bookmarkpro-bookmarks.json' and parents in 'appDataFolder'");
            const response = await fetch(
                `https://www.googleapis.com/drive/v3/files?q=${q}&spaces=appDataFolder`,
                {
                    headers: { 'Authorization': `Bearer ${this.accessToken}` }
                }
            );
            const result = await response.json();
            const files = result.files;
            if (files && files.length > 0) {
                const fileId = files[0].id;
                const fileResponse = await fetch(
                    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
                    {
                        headers: { 'Authorization': `Bearer ${this.accessToken}` }
                    }
                );
                if (fileResponse.ok) {
                    return await fileResponse.json();
                }
            }
        } catch (error) {
            console.error('Error loading bookmarks from Google Drive:', error);
        }
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
            background-color: ${type === 'success' ? '#10b981'
                : type === 'error' ? '#ef4444'
                    : '#3b82f6'};
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
    mergeBookmarks(cloudBookmarks) {
        const localBookmarkUrls = new Set(this.bookmarks.map(b => b.url));
        const newBookmarks = cloudBookmarks.filter(bookmark => !localBookmarkUrls.has(bookmark.url));
        if (newBookmarks.length > 0) {
            this.bookmarks = [...newBookmarks, ...this.bookmarks];
            this.saveBookmarksToStorage();
            this.renderBookmarks();
            this.renderTagFilters();
            this.googleAuth.showNotification(`Merged ${newBookmarks.length} bookmarks from cloud`, 'success');
        }
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
