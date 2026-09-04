(() => {
  const clipsContainer = document.getElementById('clips-container');
  const emptyState = document.getElementById('empty-state');
  const searchInput = document.getElementById('search');
  const clipCount = document.getElementById('clip-count');
  const clearAllBtn = document.getElementById('clear-all');
  const toastEl = document.getElementById('toast');

  let allClips = [];
  let filteredClips = [];
  let selectedIndex = -1;
  let debounceTimer = null;

  function relativeTime(dateString) {
    const now = Date.now();
    const then = new Date(dateString).getTime();
    const diff = Math.max(0, now - then);
    const seconds = Math.floor(diff / 1000);
    if (seconds < 10) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return 'Yesterday';
    return new Date(dateString).toLocaleDateString();
  }

  function truncate(text, len) {
    if (text.length <= len) return text;
    return text.slice(0, len) + '…';
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function showToast(message, type = 'success') {
    toastEl.textContent = message;
    toastEl.className = 'visible' + (type === 'error' ? ' toast-error' : '');
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => {
      toastEl.className = '';
    }, 1200);
  }

  function filterClips() {
    const query = searchInput.value.trim().toLowerCase();
    if (!query) {
      filteredClips = [...allClips];
    } else {
      filteredClips = allClips.filter(c => c.content.toLowerCase().includes(query));
    }
    selectedIndex = -1;
  }

  function updateEmptyState() {
    const hasClips = filteredClips.length > 0;
    emptyState.classList.toggle('visible', !hasClips);
    clipsContainer.style.display = hasClips ? 'block' : 'none';

    if (allClips.length === 0) {
      emptyState.querySelector('p').textContent = 'No clips yet';
      emptyState.querySelector('span').textContent = 'Copy something and it will appear here';
    } else if (filteredClips.length === 0) {
      emptyState.querySelector('p').textContent = 'No matches';
      emptyState.querySelector('span').textContent = 'Try a different search';
    }
  }

  function updateFooterCount() {
    const count = allClips.length;
    clipCount.textContent = `${count} clip${count !== 1 ? 's' : ''}`;
  }

  function render() {
    filterClips();
    clipsContainer.innerHTML = '';

    filteredClips.forEach((clip, index) => {
      const el = document.createElement('div');
      el.className = 'clip-item';
      el.dataset.id = clip.id;
      el.dataset.index = index;

      el.innerHTML = `
        <div class="clip-content">${escapeHtml(truncate(clip.content, 60))}</div>
        <div class="clip-timestamp">${relativeTime(clip.createdAt)}</div>
        <button class="clip-delete" title="Delete">&times;</button>
      `;

      el.addEventListener('click', (e) => {
        if (e.target.closest('.clip-delete')) return;
        copyClip(clip.id);
      });

      el.querySelector('.clip-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteClip(clip.id);
      });

      clipsContainer.appendChild(el);
    });

    updateEmptyState();
    updateFooterCount();
  }

  function setSelectedVisual(index) {
    const items = clipsContainer.querySelectorAll('.clip-item');
    items.forEach((item, i) => {
      item.classList.toggle('selected', i === index);
    });
    if (index >= 0 && items[index]) {
      items[index].scrollIntoView({ block: 'nearest' });
    }
  }

  async function copyClip(id) {
    try {
      await window.clipclop.copyItem(id);
      showToast('Copied!');
    } catch (_) {
      showToast('Copy failed', 'error');
    }
  }

  async function deleteClip(id) {
    try {
      await window.clipclop.deleteClip(id);
    } catch (_) {
      showToast('Delete failed', 'error');
    }
  }

  async function loadClips() {
    try {
      allClips = await window.clipclop.getClips();
    } catch (_) {
      allClips = [];
    }
    render();
  }

  searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      render();
    }, 200);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      clearTimeout(debounceTimer);
      if (searchInput.value) {
        searchInput.value = '';
        render();
      }
      return;
    }

    const items = clipsContainer.querySelectorAll('.clip-item');
    const count = items.length;
    if (count === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = Math.min(selectedIndex + 1, count - 1);
      setSelectedVisual(selectedIndex);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = Math.max(selectedIndex - 1, 0);
      setSelectedVisual(selectedIndex);
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      const clip = filteredClips[selectedIndex];
      if (clip) {
        copyClip(clip.id);
      }
    }
  });

  clearAllBtn.addEventListener('click', async () => {
    clearTimeout(debounceTimer);
    if (window.confirm('Clear all clips?')) {
      try {
        await window.clipclop.clearAll();
        searchInput.value = '';
      } catch (_) {
        showToast('Clear failed', 'error');
      }
    }
  });

  window.clipclop.onClipsUpdated((clips) => {
    allClips = clips;
    render();
  });

  window.clipclop.onCopied(({ id }) => {
    const el = clipsContainer.querySelector(`[data-id="${id}"]`);
    if (el) {
      el.classList.add('copied');
      setTimeout(() => el.classList.remove('copied'), 500);
    }
  });

  loadClips();
})();
