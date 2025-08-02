// BookmarkPro - Bookmark Manager Application
class BookmarkManager {
    constructor() {
        this.bookmarks = [];
        this.filteredBookmarks = [];
        this.currentView = 'grid';
        this.activeFilters = {
            search: '',
            tags: []
        };
        this.editingBookmark = null;
        
        this.init();
    }

    init() {
        this.loadBookmarksFromStorage();
        this.initializeElements();
        this.attachEventListeners();
        this.renderBookmarks();
        this.renderTagFilters();
        
        // Show empty state if no bookmarks
        if (this.bookmarks.length === 0) {
            this.initializeSampleData();
        }
    }

    initializeElements() {
        // Main elements
        this.searchInput = document.getElementById('searchInput');
        this.bookmarksContainer = document.getElementById('bookmarksContainer');
        this.emptyState = document.getElementById('emptyState');
        this.noResults = document.getElementById('noResults');
        this.tagFilters = document.getElementById('tagFilters');
        
        // Modal elements
        this.bookmarkModal = document.getElementById('bookmarkModal');
        this.deleteModal = document.getElementById('deleteModal');
        this.bookmarkForm = document.getElementById('bookmarkForm');
        this.modalTitle = document.getElementById('modalTitle');
        
        // Form elements
        this.urlInput = document.getElementById('bookmarkUrl');
        this.titleInput = document.getElementById('bookmarkTitle');
        this.descriptionInput = document.getElementById('bookmarkDescription');
        this.tagsInput = document.getElementById('bookmarkTags');
        
        // Error elements
        this.urlError = document.getElementById('urlError');
        this.titleError = document.getElementById('titleError');
        
        // Buttons
        this.addBookmarkBtn = document.getElementById('addBookmarkBtn');
        this.addFirstBookmarkBtn = document.getElementById('addFirstBookmarkBtn');
        this.saveBookmarkBtn = document.getElementById('saveBookmarkBtn');
        this.cancelBtn = document.getElementById('cancelBtn');
        this.closeModalBtn = document.getElementById('closeModalBtn');
        this.clearFiltersBtn = document.getElementById('clearFiltersBtn');
        this.confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
        this.cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
        this.closeDeleteModalBtn = document.getElementById('closeDeleteModalBtn');
        
        // View buttons
        this.viewButtons = document.querySelectorAll('.view-btn');
    }

    attachEventListeners() {
        // Search
        this.searchInput.addEventListener('input', (e) => {
            this.activeFilters.search = e.target.value;
            this.filterBookmarks();
        });
        
        // Add bookmark buttons
        this.addBookmarkBtn.addEventListener('click', () => this.openAddModal());
        this.addFirstBookmarkBtn.addEventListener('click', () => this.openAddModal());
        
        // Modal controls
        this.closeModalBtn.addEventListener('click', () => this.closeModal());
        this.cancelBtn.addEventListener('click', () => this.closeModal());
        this.bookmarkModal.querySelector('.modal__backdrop').addEventListener('click', () => this.closeModal());
        
        // Delete modal controls
        this.closeDeleteModalBtn.addEventListener('click', () => this.closeDeleteModal());
        this.cancelDeleteBtn.addEventListener('click', () => this.closeDeleteModal());
        this.deleteModal.querySelector('.modal__backdrop').addEventListener('click', () => this.closeDeleteModal());
        this.confirmDeleteBtn.addEventListener('click', () => this.confirmDelete());
        
        // Form submission
        this.bookmarkForm.addEventListener('submit', (e) => this.handleFormSubmit(e));
        
        // URL input validation and title fetching
        this.urlInput.addEventListener('blur', () => this.validateUrl());
        this.urlInput.addEventListener('input', () => this.clearUrlError());
        
        // Clear filters
        this.clearFiltersBtn.addEventListener('click', () => this.clearFilters());
        
        // View toggle
        this.viewButtons.forEach(btn => {
            btn.addEventListener('click', (e) => this.switchView(e.target.dataset.view));
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
                this.closeDeleteModal();
            }
        });
    }

    initializeSampleData() {
        const sampleBookmarks = [
            {
                id: this.generateId(),
                title: "Raindrop.io",
                url: "https://raindrop.io",
                description: "All-in-one bookmark manager with tagging and search",
                tags: ["productivity", "bookmarks", "tools"],
                dateAdded: "2025-08-01T12:00:00Z"
            },
            {
                id: this.generateId(),
                title: "GitHub",
                url: "https://github.com",
                description: "Code hosting platform for version control and collaboration",
                tags: ["development", "git", "coding"],
                dateAdded: "2025-08-01T11:30:00Z"
            },
            {
                id: this.generateId(),
                title: "CSS Grid Guide",
                url: "https://css-tricks.com/snippets/css/complete-guide-grid/",
                description: "Complete guide to CSS Grid layout system",
                tags: ["css", "web design", "frontend", "tutorial"],
                dateAdded: "2025-07-31T14:20:00Z"
            }
        ];
        
        this.bookmarks = sampleBookmarks;
        this.saveBookmarksToStorage();
        this.renderBookmarks();
        this.renderTagFilters();
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    loadBookmarksFromStorage() {
        try {
            const stored = localStorage.getItem('bookmarkpro_bookmarks');
            this.bookmarks = stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.error('Error loading bookmarks:', error);
            this.bookmarks = [];
        }
    }

    saveBookmarksToStorage() {
        try {
            localStorage.setItem('bookmarkpro_bookmarks', JSON.stringify(this.bookmarks));
        } catch (error) {
            console.error('Error saving bookmarks:', error);
        }
    }

    openAddModal() {
        this.editingBookmark = null;
        this.modalTitle.textContent = 'Add Bookmark';
        this.saveBookmarkBtn.textContent = 'Save Bookmark';
        this.clearForm();
        this.showModal();
    }

    openEditModal(bookmark) {
        this.editingBookmark = bookmark;
        this.modalTitle.textContent = 'Edit Bookmark';
        this.saveBookmarkBtn.textContent = 'Update Bookmark';
        this.populateForm(bookmark);
        this.showModal();
    }

    showModal() {
        this.bookmarkModal.classList.remove('hidden');
        this.urlInput.focus();
    }

    closeModal() {
        this.bookmarkModal.classList.add('hidden');
        this.clearForm();
        this.editingBookmark = null;
    }

    showDeleteModal(bookmark) {
        this.bookmarkToDelete = bookmark;
        this.deleteModal.classList.remove('hidden');
    }

    closeDeleteModal() {
        this.deleteModal.classList.add('hidden');
        this.bookmarkToDelete = null;
    }

    clearForm() {
        this.bookmarkForm.reset();
        this.clearErrors();
    }

    populateForm(bookmark) {
        this.urlInput.value = bookmark.url;
        this.titleInput.value = bookmark.title;
        this.descriptionInput.value = bookmark.description || '';
        this.tagsInput.value = bookmark.tags.join(', ');
        this.clearErrors();
    }

    clearErrors() {
        this.urlError.textContent = '';
        this.titleError.textContent = '';
    }

    clearUrlError() {
        this.urlError.textContent = '';
    }

    validateUrl() {
        const url = this.urlInput.value.trim();
        if (!url) return false;
        
        try {
            new URL(url);
            this.clearUrlError();
            this.fetchTitle(url);
            return true;
        } catch {
            this.urlError.textContent = 'Please enter a valid URL';
            return false;
        }
    }

    async fetchTitle(url) {
        // Since we can't fetch from external URLs due to CORS,
        // we'll extract a title from the URL or domain
        if (!this.titleInput.value.trim()) {
            try {
                const urlObj = new URL(url);
                const domain = urlObj.hostname.replace('www.', '');
                const pathParts = urlObj.pathname.split('/').filter(p => p);
                
                let title = domain;
                if (pathParts.length > 0) {
                    const lastPart = pathParts[pathParts.length - 1];
                    if (lastPart && !lastPart.includes('.')) {
                        title = lastPart.replace(/-|_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                    }
                } else {
                    title = domain.split('.')[0].replace(/\b\w/g, l => l.toUpperCase());
                }
                
                this.titleInput.value = title;
            } catch (error) {
                // Ignore error
            }
        }
    }

    handleFormSubmit(e) {
        e.preventDefault();
        
        const url = this.urlInput.value.trim();
        const title = this.titleInput.value.trim();
        const description = this.descriptionInput.value.trim();
        const tagsInput = this.tagsInput.value.trim();
        
        let isValid = true;
        
        // Validate URL
        if (!url) {
            this.urlError.textContent = 'URL is required';
            isValid = false;
        } else if (!this.validateUrl()) {
            isValid = false;
        }
        
        // Validate title
        if (!title) {
            this.titleError.textContent = 'Title is required';
            isValid = false;
        }
        
        if (!isValid) return;
        
        // Check for duplicate URL (except when editing)
        const existingBookmark = this.bookmarks.find(b => 
            b.url === url && (!this.editingBookmark || b.id !== this.editingBookmark.id)
        );
        
        if (existingBookmark) {
            this.urlError.textContent = 'This URL is already bookmarked';
            return;
        }
        
        // Parse tags
        const tags = tagsInput ? 
            tagsInput.split(',').map(tag => tag.trim().toLowerCase()).filter(tag => tag) : 
            [];
        
        const bookmarkData = {
            url,
            title,
            description,
            tags
        };
        
        if (this.editingBookmark) {
            this.updateBookmark(this.editingBookmark.id, bookmarkData);
        } else {
            this.addBookmark(bookmarkData);
        }
        
        this.closeModal();
    }

    addBookmark(data) {
        const bookmark = {
            id: this.generateId(),
            ...data,
            dateAdded: new Date().toISOString()
        };
        
        this.bookmarks.unshift(bookmark);
        this.saveBookmarksToStorage();
        this.renderBookmarks();
        this.renderTagFilters();
    }

    updateBookmark(id, data) {
        const index = this.bookmarks.findIndex(b => b.id === id);
        if (index !== -1) {
            this.bookmarks[index] = {
                ...this.bookmarks[index],
                ...data
            };
            this.saveBookmarksToStorage();
            this.renderBookmarks();
            this.renderTagFilters();
        }
    }

    deleteBookmark(id) {
        this.bookmarks = this.bookmarks.filter(b => b.id !== id);
        this.saveBookmarksToStorage();
        this.renderBookmarks();
        this.renderTagFilters();
    }

    confirmDelete() {
        if (this.bookmarkToDelete) {
            this.deleteBookmark(this.bookmarkToDelete.id);
            this.closeDeleteModal();
        }
    }

    filterBookmarks() {
        let filtered = [...this.bookmarks];
        
        // Filter by search
        if (this.activeFilters.search) {
            const search = this.activeFilters.search.toLowerCase();
            filtered = filtered.filter(bookmark => 
                bookmark.title.toLowerCase().includes(search) ||
                bookmark.description.toLowerCase().includes(search) ||
                bookmark.url.toLowerCase().includes(search) ||
                bookmark.tags.some(tag => tag.toLowerCase().includes(search))
            );
        }
        
        // Filter by tags
        if (this.activeFilters.tags.length > 0) {
            filtered = filtered.filter(bookmark =>
                this.activeFilters.tags.every(tag =>
                    bookmark.tags.includes(tag)
                )
            );
        }
        
        this.filteredBookmarks = filtered;
        this.renderBookmarks();
    }

    clearFilters() {
        this.activeFilters.search = '';
        this.activeFilters.tags = [];
        this.searchInput.value = '';
        this.filteredBookmarks = [...this.bookmarks];
        this.renderBookmarks();
        this.renderTagFilters();
    }

    toggleTagFilter(tag) {
        const index = this.activeFilters.tags.indexOf(tag);
        if (index > -1) {
            this.activeFilters.tags.splice(index, 1);
        } else {
            this.activeFilters.tags.push(tag);
        }
        this.filterBookmarks();
        this.renderTagFilters();
    }

    switchView(view) {
        this.currentView = view;
        this.viewButtons.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === view);
        });
        this.renderBookmarks();
    }

    getAllTags() {
        const tags = new Set();
        this.bookmarks.forEach(bookmark => {
            bookmark.tags.forEach(tag => tags.add(tag));
        });
        return Array.from(tags).sort();
    }

    renderTagFilters() {
        const tags = this.getAllTags();
        
        if (tags.length === 0) {
            this.tagFilters.innerHTML = '';
            return;
        }
        
        this.tagFilters.innerHTML = tags.map(tag => `
            <button class="tag-chip ${this.activeFilters.tags.includes(tag) ? 'active' : ''}" 
                    data-tag="${tag}">
                ${tag}
            </button>
        `).join('');
        
        // Attach event listeners to tag chips
        this.tagFilters.querySelectorAll('.tag-chip').forEach(chip => {
            chip.addEventListener('click', (e) => {
                this.toggleTagFilter(e.target.dataset.tag);
            });
        });
    }

    renderBookmarks() {
        const bookmarksToRender = this.activeFilters.search || this.activeFilters.tags.length > 0 
            ? this.filteredBookmarks 
            : this.bookmarks;
        
        // Show/hide states
        const hasBookmarksAtAll = this.bookmarks.length > 0;
        const hasFilteredResults = bookmarksToRender.length > 0;
        const isFiltering = this.activeFilters.search || this.activeFilters.tags.length > 0;
        
        this.emptyState.classList.toggle('hidden', hasBookmarksAtAll);
        this.noResults.classList.toggle('hidden', !isFiltering || hasFilteredResults);
        this.bookmarksContainer.classList.toggle('hidden', !hasFilteredResults);
        
        if (!hasFilteredResults) return;
        
        // Update view class
        this.bookmarksContainer.className = `bookmarks-grid ${this.currentView === 'list' ? 'list-view' : ''}`;
        
        // Render bookmarks
        this.bookmarksContainer.innerHTML = bookmarksToRender.map(bookmark => 
            this.renderBookmarkCard(bookmark)
        ).join('');
        
        // Attach event listeners
        this.attachBookmarkEventListeners();
    }

    renderBookmarkCard(bookmark) {
        const formattedDate = new Date(bookmark.dateAdded).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
        
        const favicon = this.getFaviconUrl(bookmark.url);
        
        return `
            <div class="bookmark-card ${this.currentView === 'list' ? 'list-view' : ''}" data-id="${bookmark.id}">
                <div class="bookmark-card__header">
                    <img class="bookmark-card__favicon" src="${favicon}" alt="" onerror="this.style.display='none'">
                    <div class="bookmark-card__title-container">
                        <h3 class="bookmark-card__title">
                            <a href="${bookmark.url}" target="_blank" rel="noopener noreferrer" class="bookmark-link">
                                ${bookmark.title}
                            </a>
                        </h3>
                        <p class="bookmark-card__url">${bookmark.url}</p>
                        ${bookmark.description ? `<p class="bookmark-card__description">${bookmark.description}</p>` : ''}
                    </div>
                </div>
                ${bookmark.tags.length > 0 ? `
                    <div class="bookmark-card__tags">
                        ${bookmark.tags.map(tag => `
                            <span class="bookmark-card__tag" data-tag="${tag}">${tag}</span>
                        `).join('')}
                    </div>
                ` : ''}
                <div class="bookmark-card__footer">
                    <span class="bookmark-card__date">${formattedDate}</span>
                    <div class="bookmark-card__actions">
                        <button class="bookmark-card__action edit" data-id="${bookmark.id}">Edit</button>
                        <button class="bookmark-card__action delete" data-id="${bookmark.id}">Delete</button>
                    </div>
                </div>
            </div>
        `;
    }

    getFaviconUrl(url) {
        try {
            const domain = new URL(url).hostname;
            return `https://www.google.com/s2/favicons?domain=${domain}&sz=16`;
        } catch {
            return 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" fill="%23ddd"/></svg>';
        }
    }

    attachBookmarkEventListeners() {
        // Bookmark links - ensure they open in new tabs
        this.bookmarksContainer.querySelectorAll('.bookmark-link').forEach(link => {
            link.addEventListener('click', (e) => {
                // Ensure the link opens in a new tab
                e.stopPropagation();
                window.open(link.href, '_blank', 'noopener,noreferrer');
            });
        });
        
        // Edit buttons
        this.bookmarksContainer.querySelectorAll('.edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = e.target.dataset.id;
                const bookmark = this.bookmarks.find(b => b.id === id);
                if (bookmark) this.openEditModal(bookmark);
            });
        });
        
        // Delete buttons
        this.bookmarksContainer.querySelectorAll('.delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = e.target.dataset.id;
                const bookmark = this.bookmarks.find(b => b.id === id);
                if (bookmark) this.showDeleteModal(bookmark);
            });
        });
        
        // Tag filters
        this.bookmarksContainer.querySelectorAll('.bookmark-card__tag').forEach(tag => {
            tag.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleTagFilter(e.target.dataset.tag);
            });
        });
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new BookmarkManager();
});