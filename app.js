/* ========================================
   SubNote App - Core Logic v2
   Auto-numbered subnotes, Minimize/Expandir buttons
   ======================================== */
 
const AppState = {
    notes: [],
    currentNoteId: null,
    currentView: 'notes-list',
    editingSubnoteId: null,   // subnote being edited in full editor
    deleteCallback: null,
    sortMode: 'alpha',
    subnoteCounter: 0         // global counter for auto-numbering within a note
};

// DOM References
const DOM = {
    viewNotesList: document.getElementById('view-notes-list'),
    viewNoteEditor: document.getElementById('view-note-editor'),
    viewAllSubnotes: document.getElementById('view-all-subnotes'),
    viewSubnoteEditor: document.getElementById('view-subnote-editor'),
    notesList: document.getElementById('notes-list'),
    emptyState: document.getElementById('empty-state'),
    noteTitleInput: document.getElementById('header-title-input'),
    noteContentArea: document.getElementById('note-content-area'),
    headerTitle: document.getElementById('header-title'),
    btnBack: document.getElementById('btn-back'),
    btnNewNote: document.getElementById('btn-new-note'),
    // Subnote full editor
    subnoteEditorBadge: document.getElementById('subnote-editor-badge'),
    subnoteEditorTitle: document.getElementById('subnote-editor-title'),
    subnoteEditorContent: document.getElementById('subnote-editor-content'),
    // Other
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
    tmp.querySelectorAll('.subnote-inline').forEach(el => el.remove());
    return tmp.textContent || tmp.innerText || '';
}

function escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.replace(/[&<>"']/g, c => map[c]);
}

/**
 * Get the display label for a subnote (Subnota N).
 * The number is based on its position order in the content area.
 */
function getSubnoteNumber(subnoteId) {
    const allSubnotes = DOM.noteContentArea.querySelectorAll('.subnote-inline');
    let idx = 1;
    for (const el of allSubnotes) {
        if (el.dataset.subnoteId === subnoteId) return idx;
        idx++;
    }
    return idx;
}

function getSubnoteLabel(subnoteId) {
    return 'Subnota ' + getSubnoteNumber(subnoteId);
}

/**
 * Count existing subnotes in content area and return next number.
 */
function getNextSubnoteNumber() {
    const count = DOM.noteContentArea.querySelectorAll('.subnote-inline').length;
    return count + 1;
}

// ========================================
// Persistence
// ========================================

function saveToStorage() {
    if (AppState.currentNoteId && AppState.currentView === 'note-editor') {
        const note = getNoteById(AppState.currentNoteId);
        if (note) {
            note.title = DOM.noteTitleInput.value.trim() || generateAutoTitle(note);
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
    note.htmlContent = area.innerHTML;
    note.textContent = stripHtml(note.htmlContent);
    
    note.subnotes = [];
    area.querySelectorAll('.subnote-inline').forEach(el => {
        const id = el.dataset.subnoteId;
        const title = el.dataset.subnoteTitle || '';
        const content = el.dataset.subnoteContent || '';
        note.subnotes.push({ id, title, content });
    });
}

function restoreContentFromNote(note) {
    DOM.noteContentArea.innerHTML = note.htmlContent || '';
    
    DOM.noteContentArea.querySelectorAll('.subnote-inline').forEach(el => {
        attachSubnoteListeners(el);
    });
}

// ========================================
// Navigation
// ========================================

function switchView(viewName) {
    // Save current note before switching away from editor
    if (AppState.currentView === 'note-editor' && AppState.currentNoteId) {
        const note = getNoteById(AppState.currentNoteId);
        if (note) {
            const titleVal = DOM.noteTitleInput.value.trim();
            note.title = titleVal || generateAutoTitle(note);
            syncContentToNote(note);
            note.updatedAt = Date.now();
            saveToStorage();
        }
        // Restore header to h1 mode
        DOM.noteTitleInput.classList.add('hidden');
        DOM.headerTitle.classList.remove('hidden');
    }

    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));

    switch (viewName) {
        case 'notes-list':
            DOM.viewNotesList.classList.add('active');
            DOM.headerTitle.textContent = 'SubNote';
            DOM.headerTitle.style.display = '';
            DOM.headerTitle.classList.remove('hidden');
            DOM.noteTitleInput.classList.add('hidden');
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
                const isAutoTitle = /^\d{2}-\d{2}-\d{2} nota \d+$/.test(note.title);
                const displayTitle = (!note.title || note.title === 'Sem título' || isAutoTitle) ? '' : note.title;
                DOM.noteTitleInput.value = displayTitle;
                DOM.noteTitleInput.placeholder = generateAutoTitle(note);
                restoreContentFromNote(note);
            }
            // Show ONLY the input, hide h1 completely
            DOM.headerTitle.style.display = 'none';
            DOM.headerTitle.classList.add('hidden');
            DOM.noteTitleInput.classList.remove('hidden');
            break;

        case 'all-subnotes':
            DOM.viewAllSubnotes.classList.add('active');
            DOM.btnBack.classList.remove('hidden');
            DOM.btnNewNote.classList.add('hidden');
            DOM.headerTitle.style.display = '';
            DOM.headerTitle.classList.remove('hidden');
            DOM.noteTitleInput.classList.add('hidden');
            DOM.headerTitle.textContent = 'Subnotas';
            renderAllSubnotes();
            break;

        case 'subnote-editor':
            DOM.viewSubnoteEditor.classList.add('active');
            DOM.btnBack.classList.remove('hidden');
            DOM.btnNewNote.classList.add('hidden');
            DOM.headerTitle.style.display = '';
            DOM.headerTitle.classList.remove('hidden');
            DOM.noteTitleInput.classList.add('hidden');
            DOM.headerTitle.textContent = 'Editar Subnota';
            break;
    }

    AppState.currentView = viewName;
}

function goBack() {
    if (AppState.currentView === 'all-subnotes') {
        switchView('note-editor');
    } else if (AppState.currentView === 'subnote-editor') {
        // Cancel without saving
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
    // Focus on title input for new notes
    setTimeout(() => DOM.noteTitleInput.focus(), 100);
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
            <div class="note-card-title">${escapeHtml(getDisplayTitle(note))}</div>
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

/**
 * Insert a new subnote. Opens the full editor directly.
 * The subnote is created immediately in the DOM with empty content,
 * then the editor opens to fill in title/content.
 */
function insertSubnote() {
    const subnoteId = generateId();
    const nextNum = getNextSubnoteNumber();
    const subnoteEl = createSubnoteElement(subnoteId, '', '');
    
    // Insert at cursor position in content area
    const selection = window.getSelection();
    if (selection.rangeCount > 0 && DOM.noteContentArea.contains(selection.anchorNode)) {
        const range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(subnoteEl);
        range.setStartAfter(subnoteEl);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
    } else {
        DOM.noteContentArea.appendChild(document.createTextNode(' '));
        DOM.noteContentArea.appendChild(subnoteEl);
        DOM.noteContentArea.appendChild(document.createTextNode(' '));
    }
    
    autoSave();
    
    // Open full editor for this new subnote
    openSubnoteEditor(subnoteId);
}

function createSubnoteElement(id, title, content) {
    const wrapper = document.createElement('span');
    wrapper.className = 'subnote-inline';
    wrapper.dataset.subnoteId = id;
    wrapper.dataset.subnoteTitle = title;
    wrapper.dataset.subnoteContent = content;
    wrapper.contentEditable = 'false';
    
    // Collapsed button - always shows "Subnota N" (never the title)
    const btn = document.createElement('button');
    btn.className = 'subnote-btn';
    // Number will be set dynamically
    btn.innerHTML = `<svg class="subnote-btn-icon" width="12" height="12" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="3" stroke="currentColor" stroke-width="1.5"/></svg> <span class="subnote-btn-label">Subnota</span>`;
    
    wrapper.appendChild(btn);
    attachSubnoteListeners(wrapper);
    
    // Update label after insertion
    requestAnimationFrame(() => updateAllSubnoteLabels());
    
    return wrapper;
}

/**
 * Update all subnote buttons/labels to reflect their current position number.
 * Called after insert, delete, or reorder.
 */
function updateAllSubnoteLabels() {
    const allSubnotes = DOM.noteContentArea.querySelectorAll('.subnote-inline');
    let num = 1;
    allSubnotes.forEach(el => {
        // Update collapsed button label
        const label = el.querySelector('.subnote-btn-label');
        if (label) {
            label.textContent = `Subnota ${num}`;
        }
        // Update expanded title label
        const expandedTitle = el.querySelector('.subnote-expanded-title');
        if (expandedTitle) {
            expandedTitle.textContent = `Subnota ${num}`;
        }
        el.dataset.subnoteNum = num;
        num++;
    });
}

function attachSubnoteListeners(wrapper) {
    // Collapsed button -> expand (show content box)
    const btn = wrapper.querySelector('.subnote-btn');
    if (btn) {
        btn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            expandSubnote(wrapper);
        };
    }
    
    // Minimize button (red) -> collapse back to inline button
    const minimizeBtn = wrapper.querySelector('.subnote-labeled-btn.minimize-btn');
    if (minimizeBtn) {
        minimizeBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            collapseSubnote(wrapper);
        };
    }
    
    // Expandir button (orange) -> open full editor
    const expandBtn = wrapper.querySelector('.subnote-labeled-btn.expand-btn');
    if (expandBtn) {
        expandBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            openSubnoteEditor(wrapper.dataset.subnoteId);
        };
    }
}

function expandSubnote(wrapper) {
    const content = wrapper.dataset.subnoteContent;
    const subnoteId = wrapper.dataset.subnoteId;
    const num = wrapper.dataset.subnoteNum || getSubnoteNumber(subnoteId);
    
    // Replace inline span with a div that can float
    const expandedDiv = document.createElement('div');
    expandedDiv.className = 'subnote-inline';
    expandedDiv.dataset.subnoteId = subnoteId;
    expandedDiv.dataset.subnoteTitle = wrapper.dataset.subnoteTitle;
    expandedDiv.dataset.subnoteContent = content;
    expandedDiv.dataset.subnoteNum = num;
    expandedDiv.contentEditable = 'false';
    
    expandedDiv.innerHTML = `
        <div class="subnote-expanded">
            <div class="subnote-expanded-header">
                <span class="subnote-expanded-title">Subnota ${num}</span>
                <div class="subnote-expanded-actions">
                    <button class="subnote-labeled-btn minimize-btn" title="Minimizar">Minimize</button>
                    <button class="subnote-labeled-btn expand-btn" title="Expandir para edição completa">Expandir</button>
                </div>
            </div>
            <div class="subnote-expanded-content">${escapeHtml(content || 'Sem conteúdo')}</div>
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
    const num = wrapper.dataset.subnoteNum || getSubnoteNumber(id);
    
    // Replace div back to inline span with button
    const collapsedSpan = document.createElement('span');
    collapsedSpan.className = 'subnote-inline';
    collapsedSpan.dataset.subnoteId = id;
    collapsedSpan.dataset.subnoteTitle = title;
    collapsedSpan.dataset.subnoteContent = content;
    collapsedSpan.dataset.subnoteNum = num;
    collapsedSpan.contentEditable = 'false';
    
    const btn = document.createElement('button');
    btn.className = 'subnote-btn';
    btn.innerHTML = `<svg class="subnote-btn-icon" width="12" height="12" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="12" height="12" rx="3" stroke="currentColor" stroke-width="1.5"/></svg> <span class="subnote-btn-label">Subnota ${num}</span>`;
    
    collapsedSpan.appendChild(btn);
    wrapper.replaceWith(collapsedSpan);
    attachSubnoteListeners(collapsedSpan);
    autoSave();
}

// ========================================
// Subnote Full Editor (Expandir)
// ========================================

function openSubnoteEditor(subnoteId) {
    AppState.editingSubnoteId = subnoteId;
    
    const el = DOM.noteContentArea.querySelector(`.subnote-inline[data-subnote-id="${subnoteId}"]`);
    if (!el) return;
    
    const num = el.dataset.subnoteNum || getSubnoteNumber(subnoteId);
    const title = el.dataset.subnoteTitle || '';
    const content = el.dataset.subnoteContent || '';
    
    // Populate editor
    DOM.subnoteEditorBadge.textContent = `Subnota ${num}`;
    DOM.subnoteEditorTitle.value = title;
    DOM.subnoteEditorContent.textContent = content;
    
    switchView('subnote-editor');
    DOM.subnoteEditorTitle.focus();
}

function saveSubnoteEditor() {
    const subnoteId = AppState.editingSubnoteId;
    if (!subnoteId) return;
    
    const title = DOM.subnoteEditorTitle.value.trim();
    const content = DOM.subnoteEditorContent.textContent.trim();
    
    // Go back to note editor first to access the DOM elements
    switchView('note-editor');
    
    // Find the subnote element and update its data
    const el = DOM.noteContentArea.querySelector(`.subnote-inline[data-subnote-id="${subnoteId}"]`);
    if (el) {
        el.dataset.subnoteTitle = title;
        el.dataset.subnoteContent = content;
        
        // If expanded, update the visible content
        const expandedContent = el.querySelector('.subnote-expanded-content');
        if (expandedContent) {
            expandedContent.textContent = content || 'Sem conteúdo';
        }
    }
    
    AppState.editingSubnoteId = null;
    autoSave();
}

function cancelSubnoteEditor() {
    AppState.editingSubnoteId = null;
    switchView('note-editor');
}

// ========================================
// All Subnotes View
// ========================================

function showAllSubnotes() {
    const note = getNoteById(AppState.currentNoteId);
    if (note) {
        const titleVal = DOM.noteTitleInput.value.trim();
        note.title = titleVal || generateAutoTitle(note);
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
    
    // Add position index to each subnote for display
    let subnotesWithIndex = note.subnotes.map((sub, idx) => ({
        ...sub,
        posNum: idx + 1
    }));
    
    if (AppState.sortMode === 'alpha') {
        subnotesWithIndex.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'pt-BR'));
    } else {
        subnotesWithIndex.sort((a, b) => a.posNum - b.posNum);
    }
    
    subnotesWithIndex.forEach((sub, idx) => {
        const item = document.createElement('div');
        item.className = 'subnote-list-item animate-in';
        item.style.animationDelay = `${idx * 0.05}s`;
        
        const displayTitle = sub.title ? escapeHtml(sub.title) : '<em style="color:var(--text-muted)">Sem título</em>';
        
        item.innerHTML = `
            <div class="subnote-list-item-title">Subnota ${sub.posNum} ${sub.title ? '— ' + escapeHtml(sub.title) : ''}</div>
            <div class="subnote-list-item-preview">${escapeHtml(sub.content || 'Sem conteúdo')}</div>
            <div class="subnote-list-item-actions">
                <button class="subnote-list-action" onclick="editSubnoteFromList('${sub.id}')">Expandir</button>
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
    // Go back to editor first to have access to DOM
    switchView('note-editor');
    // Then open the full subnote editor
    openSubnoteEditor(subnoteId);
}

function deleteSubnoteFromList(subnoteId) {
    AppState.deleteCallback = () => {
        const note = getNoteById(AppState.currentNoteId);
        if (note) {
            note.subnotes = note.subnotes.filter(s => s.id !== subnoteId);
            switchView('note-editor');
            const el = DOM.noteContentArea.querySelector(`.subnote-inline[data-subnote-id="${subnoteId}"]`);
            if (el) el.remove();
            updateAllSubnoteLabels();
            autoSave();
            switchView('all-subnotes');
        }
    };
    DOM.deleteModalText.textContent = 'Tem certeza que deseja excluir esta subnota?';
    DOM.deleteModal.classList.remove('hidden');
}

// ========================================
// Delete Subnote from inline (expanded box)
// ========================================

function deleteSubnoteInline(wrapper) {
    AppState.deleteCallback = () => {
        wrapper.remove();
        updateAllSubnoteLabels();
        autoSave();
    };
    DOM.deleteModalText.textContent = 'Tem certeza que deseja excluir esta subnota?';
    DOM.deleteModal.classList.remove('hidden');
}

// ========================================
// Modals
// ========================================

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

// Title input is now handled in Header Title Editing section

// Auto-save on content change
DOM.noteContentArea.addEventListener('input', () => {
    autoSave();
});

// Close modal on overlay click
DOM.deleteModal.addEventListener('click', (e) => {
    if (e.target === DOM.deleteModal) closeDeleteModal();
});

// Keyboard shortcut: Escape to go back
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (!DOM.deleteModal.classList.contains('hidden')) {
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
// Auto Title Generation & Title Input
// ========================================

function generateAutoTitle(note) {
    const d = new Date(note.createdAt);
    const yy = String(d.getFullYear()).slice(-2);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const dateStr = `${yy}-${mm}-${dd}`;

    // Count notes created on the same date, sorted by creation time
    const sameDateNotes = AppState.notes.filter(n => {
        const nd = new Date(n.createdAt);
        return nd.getFullYear() === d.getFullYear() &&
               nd.getMonth() === d.getMonth() &&
               nd.getDate() === d.getDate();
    }).sort((a, b) => a.createdAt - b.createdAt);

    const index = sameDateNotes.findIndex(n => n.id === note.id) + 1;
    const num = String(index > 0 ? index : sameDateNotes.length + 1).padStart(2, '0');
    return `${dateStr} nota ${num}`;
}

function getDisplayTitle(note) {
    if (note.title && note.title !== 'Sem título') {
        return note.title;
    }
    return generateAutoTitle(note);
}

// Auto-save when title input changes
DOM.noteTitleInput.addEventListener('input', () => {
    autoSave();
});

// Focus content area on Enter from title
DOM.noteTitleInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        DOM.noteContentArea.focus();
    }
});

// ========================================
// Swipe Gesture: Right-to-Left to view Subnotes
// ========================================

let swipeStartX = 0;
let swipeStartY = 0;
let swipeTracking = false;

DOM.viewNoteEditor.addEventListener('touchstart', (e) => {
    swipeStartX = e.touches[0].clientX;
    swipeStartY = e.touches[0].clientY;
    swipeTracking = true;
}, { passive: true });

DOM.viewNoteEditor.addEventListener('touchmove', (e) => {
    if (!swipeTracking) return;
}, { passive: true });

DOM.viewNoteEditor.addEventListener('touchend', (e) => {
    if (!swipeTracking) return;
    swipeTracking = false;
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const diffX = swipeStartX - endX;
    const diffY = Math.abs(swipeStartY - endY);
    // Swipe left (right-to-left) with min 80px and more horizontal than vertical
    if (diffX > 80 && diffY < diffX * 0.7) {
        showAllSubnotes();
    }
});

// Mouse drag swipe for desktop testing
let mouseSwipeStartX = 0;
let mouseSwipeStartY = 0;
let mouseSwipeTracking = false;

DOM.viewNoteEditor.addEventListener('mousedown', (e) => {
    if (e.target.closest('.subnote-inline') || e.target.closest('.toolbar-btn')) return;
    mouseSwipeStartX = e.clientX;
    mouseSwipeStartY = e.clientY;
    mouseSwipeTracking = true;
});

document.addEventListener('mouseup', (e) => {
    if (!mouseSwipeTracking) return;
    mouseSwipeTracking = false;
    const diffX = mouseSwipeStartX - e.clientX;
    const diffY = Math.abs(mouseSwipeStartY - e.clientY);
    if (diffX > 80 && diffY < diffX * 0.7 && AppState.currentView === 'note-editor') {
        showAllSubnotes();
    }
});

// ========================================
// Init
// ========================================

function init() {
    loadFromStorage();
    renderNotesList();
}

init();