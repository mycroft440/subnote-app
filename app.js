/* ========================================
   SubNote App - Core Logic
   ======================================== */

// State Management
const AppState = {
    notes: [],
    currentNoteId: null,
    currentView: 'notes-list',
    editingSubnoteId: null,
    deleteCallback: null,
    sortMode: 'alpha'
};

// DOM References
const DOM = {
    viewNotesList: document.getElementById('view-notes-list'),
    viewNoteEditor: document.getElementById('view-note-editor'),
    viewAllSubnotes: document.getElementById('view-all-subnotes'),
    notesList: document.getElementById('notes-list'),
    emptyState: document.getElementById('empty-state'),
    noteTitleInput: document.getElementById('note-title-input'),
    noteContentArea: document.getElementById('note-content-area'),
    headerTitle: document.getElementById('header-title'),
    btnBack: document.getElementById('btn-back'),
    btnNewNote: document.getElementById('btn-new-note'),
    btnAddSubnote: document.getElementById('btn-add-subnote'),
    btnViewAllSubnotes: document.getElementById('btn-view-all-subnotes'),
    subnoteModal: document.getElementById('subnote-modal'),
    subnoteTitleInput: document.getElementById('subnote-title-input'),
    subnoteContentInput: document.getElementById('subnote-content-input'),
    deleteModal: document.getElementById('delete-modal'),
    deleteModalText: document.getElementById('delete-modal-text'),
    subnotesList: document.getElementById('subnotes-list'),
    emptySubnotes: document.getElementById('empty-subnotes'),
    splash: document.getElementById('splash-screen')
};

// ========================================
// Utility Functions
// ========================================

function generateId() {
    return 'sn_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
}

function formatDate(timestamp) {
    const d = new Date(timestamp);
    const now = new Date();
    const diff = now - d;
    
    if (diff < 60000) return 'Agora';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'min atrás';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h atrás';
    
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function stripHtml(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    // Remove subnote elements before extracting text
    tmp.querySelectorAll('.subnote-inline').forEach(el => el.remove());
    return tmp.textContent || tmp.innerText || '';
}

function escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.replace(/[&<>"']/g, c => map[c]);
}

// ========================================
// Persistence
// ========================================

function saveToStorage() {
    // Before saving, sync current note content
    if (AppState.currentNoteId && AppState.currentView === 'note-editor') {
        const note = getNoteById(AppState.currentNoteId);
        if (note) {
            note.title = DOM.noteTitleInput.value.trim() || 'Sem título';
            syncContentToNote(note);
            note.updatedAt = Date.now();
        }
    }
    localStorage.setItem('subnote_data', JSON.stringify(AppState.notes));
}

function loadFromStorage() {
    try {
        const data = localStorage.getItem('subnote_data');
        if (data) {
            AppState.notes = JSON.parse(data);
        }
    } catch (e) {
        console.error('Error loading data:', e);
        AppState.notes = [];
    }
}

function getNoteById(id) {
    return AppState.notes.find(n => n.id === id);
}

// ========================================
// Sync content between DOM and note data
// ========================================

function syncContentToNote(note) {
    const area = DOM.noteContentArea;
    // Serialize HTML content
    note.htmlContent = area.innerHTML;
    note.textContent = stripHtml(note.htmlContent);
    
    // Extract subnote data from DOM elements
    note.subnotes = [];
    area.querySelectorAll('.subnote-inline').forEach(el => {
        const id = el.dataset.subnoteId;
        const title = el.dataset.subnoteTitle || '';
        const content = el.dataset.subnoteContent || '';
        note.subnotes.push({ id, title, content });
    });
}

function restoreContentFromNote(note) {
    DOM.noteTitleInput.value = note.title === 'Sem título' ? '' : note.title;
    DOM.noteContentArea.innerHTML = note.htmlContent || '';
    
    // Re-attach event listeners to subnote elements
    DOM.noteContentArea.querySelectorAll('.subnote-inline').forEach(el => {
        attachSubnoteListeners(el);
    });
}

// ========================================
// Navigation
// ========================================

function switchView(viewName) {
    // Save current note before switching
    if (AppState.currentView === 'note-editor' && AppState.currentNoteId) {
        const note = getNoteById(AppState.currentNoteId);
        if (note) {
            note.title = DOM.noteTitleInput.value.trim() || 'Sem título';
            syncContentToNote(note);
            note.updatedAt = Date.now();
            saveToStorage();
        }
    }

    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    
    switch (viewName) {
        case 'notes-list':
            DOM.viewNotesList.classList.add('active');
            DOM.headerTitle.textContent = 'SubNote';
            DOM.btnBack.classList.add('hidden');
            DOM.btnNewNote.classList.remove('hidden');
            AppState.currentNoteId = null;
            renderNotesList();
            break;
            
        case 'note-editor':
            DOM.viewNoteEditor.classList.add('active');
            DOM.btnBack.classList.remove('hidden');
            DOM.btnNewNote.classList.add('hidden');
            const note = getNoteById(AppState.currentNoteId);
            if (note) {
                DOM.headerTitle.textContent = note.title || 'Sem título';
                restoreContentFromNote(note);
            }
            break;
            
        case 'all-subnotes':
            DOM.viewAllSubnotes.classList.add('active');
            DOM.btnBack.classList.remove('hidden');
            DOM.btnNewNote.classList.add('hidden');
            DOM.headerTitle.textContent = 'Subnotas';
            renderAllSubnotes();
            break;
    }
    
    AppState.currentView = viewName;
}

function goBack() {
    if (AppState.currentView === 'all-subnotes') {
        switchView('note-editor');
    } else {
        switchView('notes-list');
    }
}

// ========================================
// Notes CRUD
// ========================================

function createNewNote() {
    const note = {
        id: generateId(),
        title: '',
        htmlContent: '',
        textContent: '',
        subnotes: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
    };
    
    AppState.notes.unshift(note);
    AppState.currentNoteId = note.id;
    saveToStorage();
    switchView('note-editor');
    DOM.noteTitleInput.focus();
}

function openNote(noteId) {
    AppState.currentNoteId = noteId;
    switchView('note-editor');
}

function deleteNote(noteId) {
    AppState.deleteCallback = () => {
        AppState.notes = AppState.notes.filter(n => n.id !== noteId);
        saveToStorage();
        if (AppState.currentNoteId === noteId) {
            switchView('notes-list');
        } else {
            renderNotesList();
        }
    };
    DOM.deleteModalText.textContent = 'Tem certeza que deseja excluir esta nota?';
    DOM.deleteModal.classList.remove('hidden');
}

// ========================================
// Render Notes List
// ========================================

function renderNotesList() {
    const list = DOM.notesList;
    list.innerHTML = '';
    
    if (AppState.notes.length === 0) {
        DOM.emptyState.style.display = 'flex';
        return;
    }
    
    DOM.emptyState.style.display = 'none';
    
    AppState.notes.forEach((note, idx) => {
        const card = document.createElement('div');
        card.className = 'note-card animate-in';
        card.style.animationDelay = `${idx * 0.05}s`;
        card.onclick = (e) => {
            if (!e.target.closest('.note-card-delete')) {
                openNote(note.id);
            }
        };
        
        const subnoteCount = note.subnotes ? note.subnotes.length : 0;
        const preview = note.textContent ? note.textContent.substring(0, 100) : 'Nota vazia...';
        
        card.innerHTML = `
            <div class="note-card-title">${escapeHtml(note.title || 'Sem título')}</div>
            <div class="note-card-preview">${escapeHtml(preview)}</div>
            <div class="note-card-meta">
                <span>${formatDate(note.updatedAt)}</span>
                ${subnoteCount > 0 ? `
                    <span class="note-card-subnotes">
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                            <rect x="2" y="2" width="12" height="12" rx="3" stroke="currentColor" stroke-width="1.5"/>
                        </svg>
                        ${subnoteCount} subnota${subnoteCount > 1 ? 's' : ''}
                    </span>
                ` : ''}
                <button class="note-card-delete" onclick="event.stopPropagation(); deleteNote('${note.id}')" title="Excluir nota">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                        <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                </button>
            </div>
        `;
        
        list.appendChild(card);
    });
}

// ========================================
// Subnote Inline Logic
// ========================================

function insertSubnote() {
    AppState.editingSubnoteId = null;
    DOM.subnoteTitleInput.value = '';
    DOM.subnoteContentInput.value = '';
    DOM.subnoteModal.classList.remove('hidden');
    DOM.subnoteTitleInput.focus();
}

function saveSubnoteFromModal() {
    const title = DOM.subnoteTitleInput.value.trim();
    const content = DOM.subnoteContentInput.value.trim();
    
    if (!title && !content) {
        closeSubnoteModal();
        return;
    }
    
    if (AppState.editingSubnoteId) {
        // Edit existing subnote
        const el = DOM.noteContentArea.querySelector(
            `.subnote-inline[data-subnote-id="${AppState.editingSubnoteId}"]`
        );
        if (el) {
            el.dataset.subnoteTitle = title || 'Subnota';
            el.dataset.subnoteContent = content;
            
            // Update button text if collapsed
            const btn = el.querySelector('.subnote-btn');
            if (btn) {
                btn.innerHTML = `<svg class="subnote-btn-icon" width="12" height="12" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="3" stroke="currentColor" stroke-width="1.5"/></svg> ${escapeHtml(title || 'Subnota')}`;
            }
            
            // Update expanded view if expanded
            const expandedTitle = el.querySelector('.subnote-expanded-title');
            if (expandedTitle) expandedTitle.textContent = title || 'Subnota';
            
            const expandedContent = el.querySelector('.subnote-expanded-content');
            if (expandedContent) expandedContent.textContent = content;
        }
    } else {
        // Create new subnote inline element
        const subnoteId = generateId();
        const subnoteEl = createSubnoteElement(subnoteId, title || 'Subnota', content);
        
        // Insert at cursor position in content area
        const selection = window.getSelection();
        if (selection.rangeCount > 0 && DOM.noteContentArea.contains(selection.anchorNode)) {
            const range = selection.getRangeAt(0);
            range.deleteContents();
            range.insertNode(subnoteEl);
            // Move cursor after the subnote
            range.setStartAfter(subnoteEl);
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
        } else {
            // Append at end if no cursor in content area
            DOM.noteContentArea.appendChild(document.createTextNode(' '));
            DOM.noteContentArea.appendChild(subnoteEl);
            DOM.noteContentArea.appendChild(document.createTextNode(' '));
        }
    }
    
    closeSubnoteModal();
    autoSave();
}

function createSubnoteElement(id, title, content) {
    const wrapper = document.createElement('span');
    wrapper.className = 'subnote-inline';
    wrapper.dataset.subnoteId = id;
    wrapper.dataset.subnoteTitle = title;
    wrapper.dataset.subnoteContent = content;
    wrapper.contentEditable = 'false';
    
    // Create collapsed button
    const btn = document.createElement('button');
    btn.className = 'subnote-btn';
    btn.innerHTML = `<svg class="subnote-btn-icon" width="12" height="12" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="3" stroke="currentColor" stroke-width="1.5"/></svg> ${escapeHtml(title)}`;
    
    wrapper.appendChild(btn);
    attachSubnoteListeners(wrapper);
    
    return wrapper;
}

function attachSubnoteListeners(wrapper) {
    const btn = wrapper.querySelector('.subnote-btn');
    if (btn) {
        btn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            expandSubnote(wrapper);
        };
    }
    
    // Re-attach expanded action buttons if present
    const minimizeBtn = wrapper.querySelector('.subnote-action-btn.minimize');
    if (minimizeBtn) {
        minimizeBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            collapseSubnote(wrapper);
        };
    }
    
    const editBtn = wrapper.querySelector('.subnote-action-btn.edit');
    if (editBtn) {
        editBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            editSubnote(wrapper);
        };
    }
    
    const deleteBtn = wrapper.querySelector('.subnote-action-btn.delete');
    if (deleteBtn) {
        deleteBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            deleteSubnoteInline(wrapper);
        };
    }
}

function expandSubnote(wrapper) {
    const title = wrapper.dataset.subnoteTitle;
    const content = wrapper.dataset.subnoteContent;
    
    // Replace inline span with a div that can float
    const expandedDiv = document.createElement('div');
    expandedDiv.className = 'subnote-inline';
    expandedDiv.dataset.subnoteId = wrapper.dataset.subnoteId;
    expandedDiv.dataset.subnoteTitle = title;
    expandedDiv.dataset.subnoteContent = content;
    expandedDiv.contentEditable = 'false';
    
    expandedDiv.innerHTML = `
        <div class="subnote-expanded">
            <div class="subnote-expanded-header">
                <span class="subnote-expanded-title">${escapeHtml(title)}</span>
                <div class="subnote-expanded-actions">
                    <button class="subnote-action-btn edit" title="Editar">
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                            <path d="M11.5 2.5L13.5 4.5L5 13H3V11L11.5 2.5Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
                        </svg>
                    </button>
                    <button class="subnote-action-btn minimize" title="Minimizar">
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                            <path d="M4 8H12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                        </svg>
                    </button>
                    <button class="subnote-action-btn delete" title="Excluir">
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                            <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="subnote-expanded-content">${escapeHtml(content)}</div>
        </div>
    `;
    
    wrapper.replaceWith(expandedDiv);
    attachSubnoteListeners(expandedDiv);
    autoSave();
}

function collapseSubnote(wrapper) {
    const id = wrapper.dataset.subnoteId;
    const title = wrapper.dataset.subnoteTitle;
    const content = wrapper.dataset.subnoteContent;
    
    // Replace div back to inline span with button
    const collapsedSpan = document.createElement('span');
    collapsedSpan.className = 'subnote-inline';
    collapsedSpan.dataset.subnoteId = id;
    collapsedSpan.dataset.subnoteTitle = title;
    collapsedSpan.dataset.subnoteContent = content;
    collapsedSpan.contentEditable = 'false';
    
    const btn = document.createElement('button');
    btn.className = 'subnote-btn';
    btn.innerHTML = `<svg class="subnote-btn-icon" width="12" height="12" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="3" stroke="currentColor" stroke-width="1.5"/></svg> ${escapeHtml(title)}`;
    
    collapsedSpan.appendChild(btn);
    wrapper.replaceWith(collapsedSpan);
    attachSubnoteListeners(collapsedSpan);
    autoSave();
}

function editSubnote(wrapper) {
    AppState.editingSubnoteId = wrapper.dataset.subnoteId;
    DOM.subnoteTitleInput.value = wrapper.dataset.subnoteTitle || '';
    DOM.subnoteContentInput.value = wrapper.dataset.subnoteContent || '';
    DOM.subnoteModal.classList.remove('hidden');
    DOM.subnoteTitleInput.focus();
}

function deleteSubnoteInline(wrapper) {
    AppState.deleteCallback = () => {
        wrapper.remove();
        autoSave();
    };
    DOM.deleteModalText.textContent = 'Tem certeza que deseja excluir esta subnota?';
    DOM.deleteModal.classList.remove('hidden');
}

// ========================================
// All Subnotes View
// ========================================

function showAllSubnotes() {
    // Save current state first
    const note = getNoteById(AppState.currentNoteId);
    if (note) {
        note.title = DOM.noteTitleInput.value.trim() || 'Sem título';
        syncContentToNote(note);
    }
    switchView('all-subnotes');
}

function renderAllSubnotes() {
    const note = getNoteById(AppState.currentNoteId);
    const list = DOM.subnotesList;
    list.innerHTML = '';
    
    if (!note || !note.subnotes || note.subnotes.length === 0) {
        DOM.emptySubnotes.style.display = 'flex';
        return;
    }
    
    DOM.emptySubnotes.style.display = 'none';
    
    let sorted = [...note.subnotes];
    if (AppState.sortMode === 'alpha') {
        sorted.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'pt-BR'));
    } else {
        // Numeric sort: extract leading numbers, fallback to alpha
        sorted.sort((a, b) => {
            const numA = parseInt((a.title || '').match(/\d+/)?.[0] || '0');
            const numB = parseInt((b.title || '').match(/\d+/)?.[0] || '0');
            if (numA !== numB) return numA - numB;
            return (a.title || '').localeCompare(b.title || '', 'pt-BR');
        });
    }
    
    sorted.forEach((sub, idx) => {
        const item = document.createElement('div');
        item.className = 'subnote-list-item animate-in';
        item.style.animationDelay = `${idx * 0.05}s`;
        
        item.innerHTML = `
            <div class="subnote-list-item-title">${escapeHtml(sub.title || 'Subnota')}</div>
            <div class="subnote-list-item-preview">${escapeHtml(sub.content || 'Sem conteúdo')}</div>
            <div class="subnote-list-item-actions">
                <button class="subnote-list-action" onclick="editSubnoteFromList('${sub.id}')">Editar</button>
                <button class="subnote-list-action delete" onclick="deleteSubnoteFromList('${sub.id}')">Excluir</button>
            </div>
        `;
        
        list.appendChild(item);
    });
}

function sortSubnotes(mode) {
    AppState.sortMode = mode;
    document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(mode === 'alpha' ? 'btn-sort-alpha' : 'btn-sort-num').classList.add('active');
    renderAllSubnotes();
}

function editSubnoteFromList(subnoteId) {
    // Go back to editor and open the subnote edit modal
    switchView('note-editor');
    
    const el = DOM.noteContentArea.querySelector(`.subnote-inline[data-subnote-id="${subnoteId}"]`);
    if (el) {
        editSubnote(el);
    }
}

function deleteSubnoteFromList(subnoteId) {
    AppState.deleteCallback = () => {
        const note = getNoteById(AppState.currentNoteId);
        if (note) {
            note.subnotes = note.subnotes.filter(s => s.id !== subnoteId);
            // Remove from HTML too
            switchView('note-editor');
            const el = DOM.noteContentArea.querySelector(`.subnote-inline[data-subnote-id="${subnoteId}"]`);
            if (el) el.remove();
            autoSave();
            switchView('all-subnotes');
        }
    };
    DOM.deleteModalText.textContent = 'Tem certeza que deseja excluir esta subnota?';
    DOM.deleteModal.classList.remove('hidden');
}

// ========================================
// Modals
// ========================================

function closeSubnoteModal() {
    DOM.subnoteModal.classList.add('hidden');
    AppState.editingSubnoteId = null;
}

function closeDeleteModal() {
    DOM.deleteModal.classList.add('hidden');
    AppState.deleteCallback = null;
}

function confirmDelete() {
    if (AppState.deleteCallback) {
        AppState.deleteCallback();
    }
    closeDeleteModal();
}

// ========================================
// Auto Save
// ========================================

let saveTimeout = null;

function autoSave() {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        saveToStorage();
    }, 500);
}

// ========================================
// Event Listeners
// ========================================

// Auto-save on title change
DOM.noteTitleInput.addEventListener('input', () => {
    const note = getNoteById(AppState.currentNoteId);
    if (note) {
        DOM.headerTitle.textContent = DOM.noteTitleInput.value.trim() || 'Sem título';
    }
    autoSave();
});

// Auto-save on content change
DOM.noteContentArea.addEventListener('input', () => {
    autoSave();
});

// Handle Enter in subnote modal
DOM.subnoteTitleInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        DOM.subnoteContentInput.focus();
    }
});

DOM.subnoteContentInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
        e.preventDefault();
        saveSubnoteFromModal();
    }
});

// Close modals on overlay click
DOM.subnoteModal.addEventListener('click', (e) => {
    if (e.target === DOM.subnoteModal) closeSubnoteModal();
});

DOM.deleteModal.addEventListener('click', (e) => {
    if (e.target === DOM.deleteModal) closeDeleteModal();
});

// Keyboard shortcut: Escape to go back
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (!DOM.subnoteModal.classList.contains('hidden')) {
            closeSubnoteModal();
        } else if (!DOM.deleteModal.classList.contains('hidden')) {
            closeDeleteModal();
        } else if (AppState.currentView !== 'notes-list') {
            goBack();
        }
    }
});

// Prevent contenteditable from deleting subnote elements with backspace
DOM.noteContentArea.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace' || e.key === 'Delete') {
        const sel = window.getSelection();
        if (sel.rangeCount > 0) {
            const range = sel.getRangeAt(0);
            if (range.collapsed) {
                const prev = e.key === 'Backspace' 
                    ? getPreviousSibling(range) 
                    : getNextSibling(range);
                    
                if (prev && prev.classList && prev.classList.contains('subnote-inline')) {
                    e.preventDefault();
                }
            }
        }
    }
});

function getPreviousSibling(range) {
    const node = range.startContainer;
    if (range.startOffset === 0) {
        return node.previousSibling || (node.parentNode && node.parentNode.previousSibling);
    }
    return null;
}

function getNextSibling(range) {
    const node = range.endContainer;
    if (node.nodeType === 3 && range.endOffset === node.length) {
        return node.nextSibling;
    }
    return null;
}

// Remove splash screen after animation
setTimeout(() => {
    if (DOM.splash) DOM.splash.remove();
}, 2200);

// ========================================
// Init
// ========================================

function init() {
    loadFromStorage();
    renderNotesList();
}

init();
