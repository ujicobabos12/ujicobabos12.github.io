    // ===== GLOBAL VARIABLES =====
    let previewDebounceTimer;
    let lastPreviewContent = '';
    let currentZoom = 100;
    let currentTheme = 'light';
    let autoSaveInterval;
    let currentSearchHighlights = [];
    let currentErrorHighlights = [];
    let githubSettings = {
      repoUrl: '',
      gasWebAppUrl: ''
    };

    // ===== THEME FUNCTIONS =====
    function toggleTheme() {
      currentTheme = currentTheme === 'light' ? 'dark' : 'light';
      document.body.classList.toggle('dark-theme');
      localStorage.setItem('editorTheme', currentTheme);
      console.log(`Switched to ${currentTheme} theme`);
      
      // Force update all panels to apply theme changes
      updateAllPanelsTheme();
    }

    function updateAllPanelsTheme() {
      // This will force all panels to re-render with the correct theme
      const html = document.getElementById('htmlContent').innerText;
      const css = document.getElementById('cssContent').innerText;
      const js = document.getElementById('jsContent').innerText;
      lastPreviewContent = ''; // Force preview update
      updatePreview(true);
    }

    // ===== ZOOM FUNCTIONS =====
    function adjustZoom(amount) {
      currentZoom = Math.min(Math.max(currentZoom + amount, 50), 150);
      document.getElementById('previewFrame').style.transform = `scale(${currentZoom / 100})`;
      document.getElementById('zoomValue').textContent = `${currentZoom}%`;
    }

    // ===== SEARCH FUNCTIONS =====
    function searchInEditor(type) {
      const searchTerm = document.getElementById(`${type}Search`).value;
      if (!searchTerm) return;

      const editor = document.getElementById(`${type}Content`);
      const content = editor.textContent;
      const index = content.indexOf(searchTerm);

      // Remove previous highlights
      removeSearchHighlights(type);

      if (index >= 0) {
        // Highlight all occurrences
        const regex = new RegExp(escapeRegExp(searchTerm), 'gi');
        const htmlContent = editor.innerHTML;
        const highlightedContent = htmlContent.replace(regex, match => 
          `<span class="search-highlight">${match}</span>`
        );
        editor.innerHTML = highlightedContent;
        
        // Store references to highlighted elements
        currentSearchHighlights = Array.from(editor.querySelectorAll('.search-highlight'));
        
        // Focus and scroll to the first occurrence
        const firstHighlight = currentSearchHighlights[0];
        if (firstHighlight) {
          const range = document.createRange();
          range.selectNodeContents(firstHighlight);
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
          
          editor.scrollTop = firstHighlight.offsetTop - editor.offsetTop - 20;
        }
      } else {
        console.log(`"${searchTerm}" not found in ${type}`);
      }
    }

    function removeSearchHighlights(type) {
      const editor = document.getElementById(`${type}Content`);
      currentSearchHighlights.forEach(highlight => {
        const parent = highlight.parentNode;
        while (highlight.firstChild) {
          parent.insertBefore(highlight.firstChild, highlight);
        }
        parent.removeChild(highlight);
      });
      currentSearchHighlights = [];
    }

    function escapeRegExp(string) {
      return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    // ===== HTML SYNTAX CHECK =====
    function checkHtmlSyntax() {
      const editor = document.getElementById('htmlContent');
      const content = editor.textContent;
      
      // Remove previous error highlights
      removeErrorHighlights();
      
      // Basic HTML tag validation
      const tagRegex = /<(\/?)([a-zA-Z][^\s/>]*)([^>]*?)>/g;
      let match;
      let errors = [];
      let htmlContent = editor.innerHTML;
      
      while ((match = tagRegex.exec(content)) !== null) {
        const fullTag = match[0];
        const isClosing = match[1];
        const tagName = match[2];
        const attributes = match[3];
        
        // Check for unclosed tags (simple check)
        if (!isClosing && !fullTag.endsWith('/>') && !fullTag.includes('</')) {
          const closingTag = `</${tagName}>`;
          if (content.indexOf(closingTag, match.index + fullTag.length) === -1) {
            errors.push({
              index: match.index,
              length: fullTag.length,
              message: `Unclosed ${tagName} tag`
            });
          }
        }
        
        // Check for invalid attributes (simple check)
        if (attributes.includes('="') && !attributes.match(/="[^"]*"/)) {
          errors.push({
            index: match.index,
            length: fullTag.length,
            message: `Invalid attribute in ${tagName} tag`
          });
        }
      }
      
      // Highlight errors in editor
      if (errors.length > 0) {
        let offset = 0;
        errors.forEach(error => {
          const start = error.index + offset;
          const end = start + error.length;
          const before = htmlContent.substring(0, start);
          const errorText = htmlContent.substring(start, end);
          const after = htmlContent.substring(end);
          
          htmlContent = before + 
            `<span class="error-highlight" title="${error.message}">${errorText}</span>` + 
            after;
          
          offset += 53; // Length of the added span
        });
        
        editor.innerHTML = htmlContent;
        currentErrorHighlights = Array.from(editor.querySelectorAll('.error-highlight'));
        
        // Focus on first error
        const firstError = currentErrorHighlights[0];
        if (firstError) {
          const range = document.createRange();
          range.selectNodeContents(firstError);
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
          
          editor.scrollTop = firstError.offsetTop - editor.offsetTop - 20;
        }
        
        console.error(`Found ${errors.length} HTML syntax errors`);
      } else {
        console.log('No HTML syntax errors found');
      }
    }

    function removeErrorHighlights() {
      const editor = document.getElementById('htmlContent');
      currentErrorHighlights.forEach(highlight => {
        const parent = highlight.parentNode;
        while (highlight.firstChild) {
          parent.insertBefore(highlight.firstChild, highlight);
        }
        parent.removeChild(highlight);
      });
      currentErrorHighlights = [];
    }

    // ===== MOBILE FILE MENU =====
    function toggleMobileFileMenu() {
      const fileMenu = document.querySelector('.header-file-content');
      if (window.innerWidth <= 768) {
        if (fileMenu.style.display === 'flex') {
          fileMenu.style.display = 'none';
        } else {
          fileMenu.style.display = 'flex';
          fileMenu.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
      }
    }

    // ===== DEBOUNCE FUNCTION =====
    function debounce(func, wait, immediate) {
      let timeout;
      return function() {
        const context = this, args = arguments;
        const later = function() {
          timeout = null;
          if (!immediate) func.apply(context, args);
        };
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func.apply(context, args);
      };
    }

    // ===== CONSOLE FUNCTIONS =====
    function toggleConsole() {
      const consolePanel = document.getElementById('consolePanel');
      const mainContainer = document.getElementById('mainContainer');
      const consoleToggle = document.getElementById('consoleToggle');
      
      consolePanel.classList.toggle('active');
      mainContainer.classList.toggle('shifted');
      
      if (consolePanel.classList.contains('active')) {
        consoleToggle.textContent = 'Hide Console';
        adjustPanelPositions(230);
        setTimeout(() => document.getElementById('consoleInput').focus(), 100);
      } else {
        consoleToggle.textContent = 'Console';
        adjustPanelPositions(50);
      }
    }

    function adjustPanelPositions(topPosition) {
      document.getElementById('cssPanel').style.top = `${topPosition}px`;
      document.getElementById('jsPanel').style.top = `${topPosition}px`;
      document.getElementById('runPanel').style.top = `${topPosition}px`;
    }

    function clearConsole() {
      document.getElementById('consoleOutput').innerHTML = 
        '<div class="log-message">Console cleared</div>';
    }

    function handleConsoleInput(e) {
      if (e.key === 'Enter') {
        const input = document.getElementById('consoleInput');
        const output = document.getElementById('consoleOutput');
        const command = input.value.trim();
        
        if (!command) return;
        
        // Display command
        const commandElement = document.createElement('div');
        commandElement.className = 'command-message';
        commandElement.innerHTML = `<pre>> ${escapeHtml(command)}</pre>`;
        output.appendChild(commandElement);
        
        try {
          // Execute command
          const result = new Function(command)();
          
          // Display result
          if (result !== undefined) {
            const resultElement = document.createElement('div');
            resultElement.className = 'log-message';
            resultElement.innerHTML = `<pre>${formatOutput(result)}</pre>`;
            output.appendChild(resultElement);
          }
        } catch (err) {
          // Display error with red shadow effect
          const errorElement = document.createElement('div');
          errorElement.className = 'error-message';
          errorElement.innerHTML = `<pre>${escapeHtml(err.stack || err.message)}</pre>`;
          output.appendChild(errorElement);
        }
        
        // Clear input and scroll to bottom
        input.value = '';
        output.scrollTop = output.scrollHeight;
      }
    }

    function formatOutput(value) {
      if (value === null) return 'null';
      if (value === undefined) return 'undefined';
      if (typeof value === 'object') {
        try {
          return JSON.stringify(value, null, 2);
        } catch {
          return value.toString();
        }
      }
      return escapeHtml(value.toString());
    }

    function escapeHtml(unsafe) {
      return unsafe
        .toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    }

    // Override console methods to capture output
    (function() {
      const originalConsole = {
        log: console.log,
        error: console.error,
        warn: console.warn,
        info: console.info
      };
      
      console.log = function() {
        originalConsole.log.apply(console, arguments);
        logToEditorConsole('log', Array.from(arguments));
      };
      
      console.error = function() {
        originalConsole.error.apply(console, arguments);
        logToEditorConsole('error', Array.from(arguments));
      };
      
      console.warn = function() {
        originalConsole.warn.apply(console, arguments);
        logToEditorConsole('warn', Array.from(arguments));
      };
      
      console.info = function() {
        originalConsole.info.apply(console, arguments);
        logToEditorConsole('info', Array.from(arguments));
      };
    })();

    function logToEditorConsole(type, args) {
      const output = document.getElementById('consoleOutput');
      const messageElement = document.createElement('div');
      messageElement.className = `${type}-message`;
      
      const formattedArgs = args.map(arg => {
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg, null, 2);
          } catch {
            return arg.toString();
          }
        }
        return arg;
      }).join(' ');
      
      messageElement.innerHTML = `<pre>${escapeHtml(formattedArgs)}</pre>`;
      output.appendChild(messageElement);
      output.scrollTop = output.scrollHeight;
    }

    // ===== PANEL WIDTH TOGGLE =====
    function togglePanelWidth(panelId) {
      const panel = document.getElementById(panelId);
      const btn = panel.querySelector('.panel-width-toggle');
      
      panel.classList.toggle('full-width');
      
      if (panel.classList.contains('full-width')) {
        btn.textContent = '50%';
        btn.classList.add('full');
      } else {
        btn.textContent = '100%';
        btn.classList.remove('full');
      }
      
      // Save preference
      localStorage.setItem(`${panelId}_width`, 
        panel.classList.contains('full-width') ? 'full' : 'half');
    }

    function loadPanelWidthPreference() {
      ['cssPanel', 'jsPanel'].forEach(panelId => {
        const pref = localStorage.getItem(`${panelId}_width`);
        if (pref === 'full') {
          document.getElementById(panelId).classList.add('full-width');
          const btn = document.querySelector(`#${panelId} .panel-width-toggle`);
          btn.textContent = '50%';
          btn.classList.add('full');
        }
      });
    }

    // ===== RUN PANEL FUNCTIONS =====
    function toggleRunPanel() {
      const runPanel = document.getElementById('runPanel');
      runPanel.classList.toggle('active');
      if (runPanel.classList.contains('active')) {
        updatePreview();
      }
    }

    function toggleRunPanelWidth() {
      const runPanel = document.getElementById('runPanel');
      const btn = runPanel.querySelector('.panel-width-toggle');
      runPanel.classList.toggle('small');
      if (runPanel.classList.contains('small')) {
        btn.textContent = '50%';
      } else {
        btn.textContent = '100%';
      }
    }

    function refreshPreview() {
      updatePreview(true);
    }

    // Device Preview & Rotate
    const devices = {
      desktop: { width: 1280, height: 800, name: 'Desktop' },
      laptop: { width: 1024, height: 768, name: 'Laptop' },
      tablet: { width: 768, height: 1024, name: 'Tablet' },
      mobile: { width: 375, height: 667, name: 'Mobile' }
    };
    let currentDevice = 'desktop';
    let isRotated = false;

    function setDevice(device) {
      currentDevice = device;
      const dims = devices[device];
      const iframe = document.getElementById('previewFrame');
      const toolbarHeight = 60;
      
      // Reset to default orientation
      iframe.style.width = dims.width + 'px';
      iframe.style.height = (dims.height - toolbarHeight) + 'px';
      iframe.style.marginTop = '0';
      isRotated = false;
      
      console.log(`Switched to ${dims.name} view (${dims.width}x${dims.height})`);
      updatePreview();
    }

    function rotateDevice() {
      isRotated = !isRotated;
      const iframe = document.getElementById('previewFrame');
      const dims = devices[currentDevice];
      const toolbarHeight = 60;
      
      if (isRotated) {
        iframe.style.width = dims.height + 'px';
        iframe.style.height = (dims.width - toolbarHeight) + 'px';
      } else {
        iframe.style.width = dims.width + 'px';
        iframe.style.height = (dims.height - toolbarHeight) + 'px';
      }
      
      console.log(`Device rotated to ${isRotated ? 'landscape' : 'portrait'} mode`);
      updatePreview();
    }

    // Auto compile HTML + CSS + JS into preview iframe
    function updatePreview(force = false) {
      const html = document.getElementById('htmlContent').innerText;
      const css = document.getElementById('cssContent').innerText;
      const js = document.getElementById('jsContent').innerText;
      const currentContent = html + css + js;
      
      // Only update if content changed or forced
      if (!force && currentContent === lastPreviewContent) return;
      lastPreviewContent = currentContent;
      
      // Clear previous timeout if exists
      if (previewDebounceTimer) {
        clearTimeout(previewDebounceTimer);
      }
      
      // Update preview immediately with very short debounce for typing
      previewDebounceTimer = setTimeout(() => {
        const previewFrame = document.getElementById('previewFrame');
        const previewDoc = previewFrame.contentDocument || previewFrame.contentWindow.document;
        
        try {
          previewDoc.open();
          previewDoc.write(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Preview</title>
<style>
  body {
    padding-top: 20px;
  }
  ${css}
</style>
</head>
<body>
${html}
<script>
// Override console to communicate with parent
const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info
};

function sendToParent(type, args) {
  window.parent.postMessage({
    type: 'console',
    method: type,
    args: Array.from(args).map(arg => {
      if (typeof arg === 'object') {
        try { return JSON.stringify(arg); } 
        catch { return String(arg); }
      }
      return arg;
    })
  }, '*');
}

console.log = function() {
  originalConsole.log.apply(console, arguments);
  sendToParent('log', arguments);
};

console.error = function() {
  originalConsole.error.apply(console, arguments);
  sendToParent('error', arguments);
};

console.warn = function() {
  originalConsole.warn.apply(console, arguments);
  sendToParent('warn', arguments);
};

console.info = function() {
  originalConsole.info.apply(console, arguments);
  sendToParent('info', arguments);
};

// Error handling
window.addEventListener('error', function(e) {
  sendToParent('error', [e.message + ' at ' + e.filename + ':' + e.lineno + ':' + e.colno]);
});

// Start of user code
${js}
// End of user code
<\/script>
</body>
</html>`);
          previewDoc.close();
          console.log('Preview updated successfully');
        } catch (err) {
          console.error('Error updating preview:', err);
        }
      }, 50); // Very short debounce for responsive typing
    }

    // Listen for console messages from iframe
    window.addEventListener('message', function(e) {
      if (e.data && e.data.type === 'console') {
        const method = e.data.method;
        const args = e.data.args || [];
        
        // Create a formatted message
        const message = args.map(arg => {
          try {
            const parsed = JSON.parse(arg);
            return typeof parsed === 'object' ? JSON.stringify(parsed, null, 2) : arg;
          } catch {
            return arg;
          }
        }).join(' ');
        
        // Log to our editor console
        const output = document.getElementById('consoleOutput');
        const messageElement = document.createElement('div');
        messageElement.className = `${method}-message`;
        messageElement.innerHTML = `<pre>[Preview] ${escapeHtml(message)}</pre>`;
        output.appendChild(messageElement);
        output.scrollTop = output.scrollHeight;
      }
    });

    // ===== SLIDE MANAGEMENT =====
    const slides = {
      css: {},
      js: {}
    };
    const totalSlides = 10;
    let currentSlide = {
      css: 1,
      js: 1
    };

    // Initialize slides with default content
    for (let i = 1; i <= totalSlides; i++) {
      slides.css[i] = {
        content: localStorage.getItem(`cssSlide_${i}`) || `/* CSS ${i} - Default styles */
body {
  font-family: Arial, sans-serif;
  margin: 0;
  padding: 20px;
  background-color: #f5f5f5;
}

h1 {
  color: #333;
}`,
        name: localStorage.getItem(`cssSlideName_${i}`) || `styles${i}`
      };
      slides.js[i] = {
        content: localStorage.getItem(`jsSlide_${i}`) || `// JS ${i} - Default script
console.log('Hello from JS ${i}');

// Simple click handler example
document.addEventListener('DOMContentLoaded', function() {
  document.querySelector('button')?.addEventListener('click', function() {
    alert('Button clicked!');
  });
});`,
        name: localStorage.getItem(`jsSlideName_${i}`) || `script${i}`
      };
    }

    function initializeSlideTabs() {
      const cssTabs = document.getElementById('cssTabs');
      const jsTabs = document.getElementById('jsTabs');
      
      // Clear existing tabs
      cssTabs.innerHTML = '';
      jsTabs.innerHTML = '';
      
      // Create tabs for each slide
      for (let i = 1; i <= totalSlides; i++) {
        // CSS Tab
        const cssTab = document.createElement('button');
        cssTab.className = 'slide-tab' + (i === 1 ? ' active' : '');
        cssTab.textContent = `CSS ${i}`;
        cssTab.onclick = () => switchSlide('css', i);
        cssTabs.appendChild(cssTab);
        
        // JS Tab
        const jsTab = document.createElement('button');
        jsTab.className = 'slide-tab' + (i === 1 ? ' active' : '');
        jsTab.textContent = `JS ${i}`;
        jsTab.onclick = () => switchSlide('js', i);
        jsTabs.appendChild(jsTab);
      }
    }

    function switchSlide(type, slideNum) {
      // Save current slide before switching
      saveCurrentSlide(type);
      
      // Update current slide
      currentSlide[type] = slideNum;
      
      // Load new slide
      loadSlide(type, slideNum);
      
      // Update active tab
      updateActiveTab(type, slideNum);
      
      console.log(`Switched to ${type.toUpperCase()} Slide ${slideNum}`);
    }

    function saveCurrentSlide(type) {
      const slideNum = currentSlide[type];
      const fileName = document.getElementById(`${type}FileName`).value.trim();
      const content = document.getElementById(`${type}Content`).innerText;
      
      // Don't save if content is empty
      if (!content.trim()) return;
      
      slides[type][slideNum] = {
        content: content,
        name: fileName || `unnamed-${type}-${slideNum}`
      };
      
      // Save to localStorage
      localStorage.setItem(`${type}Slide_${slideNum}`, content);
      localStorage.setItem(`${type}SlideName_${slideNum}`, slides[type][slideNum].name);
    }

    function loadSlide(type, slideNum) {
      const slide = slides[type][slideNum];
      if (!slide) return;
      
      document.getElementById(`${type}Content`).textContent = slide.content;
      document.getElementById(`${type}FileName`).value = slide.name;
      updateLineNumbers(type);
    }

    function updateActiveTab(type, slideNum) {
      // Remove active class from all tabs
      document.querySelectorAll(`#${type}Tabs .slide-tab`).forEach(tab => {
        tab.classList.remove('active');
      });
      
      // Add active class to current tab
      const tabs = document.querySelectorAll(`#${type}Tabs .slide-tab`);
      if (tabs[slideNum - 1]) {
        tabs[slideNum - 1].classList.add('active');
      }
    }

    function clearCurrentFile(type) {
      if (confirm(`Are you sure you want to clear the current ${type.toUpperCase()} file?`)) {
        document.getElementById(`${type}Content`).textContent = type === 'css' ? '/* New CSS File */' : '// New JS File';
        document.getElementById(`${type}FileName`).value = `new-${type}-${currentSlide[type]}`;
        updateLineNumbers(type);
        console.log(`Cleared ${type.toUpperCase()} Slide ${currentSlide[type]}`);
        updatePreview();
      }
    }

    function formatCurrentFile(type) {
      const contentElement = document.getElementById(`${type}Content`);
      let content = contentElement.textContent;
      
      try {
        if (type === 'html') {
          // Simple HTML formatting
          content = content
            .replace(/<([a-zA-Z][a-zA-Z0-9]*)([^>]*)>/g, '\n<$1$2>')
            .replace(/<\/([a-zA-Z][a-zA-Z0-9]*)>/g, '</$1>\n')
            .replace(/>\s+</g, '>\n<');
        } else if (type === 'css') {
          // Simple CSS formatting
          content = content
            .replace(/\s*{\s*/g, ' {\n  ')
            .replace(/\s*}\s*/g, '\n}\n\n')
            .replace(/\s*;\s*/g, ';\n  ')
            .replace(/\s*,\s*/g, ', ')
            .replace(/;\s*}/g, ';\n}');
        } else if (type === 'js') {
          // Simple JS formatting (basic indentation)
          content = content
            .replace(/\s*{\s*/g, ' {\n  ')
            .replace(/\s*}\s*/g, '\n}\n\n')
            .replace(/\s*;\s*/g, ';\n')
            .replace(/\s*,\s*/g, ', ')
            .replace(/;\s*}/g, ';\n}');
        }
        
        contentElement.textContent = content.trim();
        updateLineNumbers(type);
        console.log(`Formatted ${type.toUpperCase()} content`);
      } catch (err) {
        console.error(`Error formatting ${type} code:`, err);
      }
    }

    // ===== EDITOR FUNCTIONS =====
    function updateLineNumbers(type) {
      const content = document.getElementById(`${type}Content`).innerText;
      const lines = content.split('\n').length;
      let numbers = '';
      for (let i = 1; i <= lines; i++) {
        numbers += i + '\n';
      }
      document.getElementById(`${type}LineNumbers`).innerHTML = numbers;
    }

    function updateHtmlLineNumbers() {
      const content = document.getElementById('htmlContent').innerText;
      const lines = content.split('\n').length;
      let numbers = '';
      for (let i = 1; i <= lines; i++) {
        numbers += i + '\n';
      }
      document.getElementById('htmlLineNumbers').innerHTML = numbers;
    }

    function syncHtmlScroll() {
      const content = document.getElementById('htmlContent');
      document.getElementById('htmlLineNumbers').scrollTop = content.scrollTop;
    }

    // ===== PANEL VISIBILITY =====
    function showPanel(id) {
      document.getElementById(id).classList.add('active');
      document.getElementById('panelOverlay').style.display = 'block';
      updateLineNumbers(id.replace('Panel', ''));
    }

    function closePanel(id) {
      document.getElementById(id).classList.remove('active');
      document.getElementById('panelOverlay').style.display = 'none';
    }

    function closeAllPanels() {
      closePanel('cssPanel');
      closePanel('jsPanel');
      document.getElementById('typeSelect').value = '';
    }

    function handleClose(panelId) {
      closePanel(panelId);
      document.getElementById('typeSelect').value = '';
    }

    // ===== FILE MANAGEMENT =====
    function toggleFileManagement(type) {
      const dropdown = document.getElementById(`${type}FileManagement`);
      dropdown.classList.toggle('show');
      
      // Close other dropdowns
      const otherType = type === 'css' ? 'js' : 'css';
      const otherDropdown = document.getElementById(`${otherType}FileManagement`);
      if (otherDropdown.classList.contains('show')) {
        otherDropdown.classList.remove('show');
      }
    }

    // Close dropdowns when clicking outside
    window.onclick = function(event) {
      if (!event.target.matches('.file-management-btn') && 
          !event.target.matches('.header-file-btn button') &&
          !event.target.matches('.run-file-btn button')) {
        const dropdowns = document.getElementsByClassName('file-management-content');
        for (let i = 0; i < dropdowns.length; i++) {
          const openDropdown = dropdowns[i];
          if (openDropdown.classList.contains('show')) {
            openDropdown.classList.remove('show');
          }
        }
        
        const headerFileContent = document.querySelector('.header-file-content');
        if (headerFileContent.style.display === 'flex') {
          headerFileContent.style.display = 'none';
        }
        
        const runFileContent = document.querySelector('.run-file-content');
        if (runFileContent.style.display === 'block') {
          runFileContent.style.display = 'none';
        }
      }
    }

    // ===== MODAL FUNCTIONS =====
    function showImportModal(type) {
      const modal = document.getElementById('importModal');
      modal.dataset.type = type;
      document.getElementById('modalTitle').textContent = `Import ${type.toUpperCase()}`;
      modal.style.display = 'block';
      document.getElementById('fileInput').value = '';
      document.getElementById('importOptions').style.display = 'none';
      
      // Set accept attribute based on file type
      const fileInput = document.getElementById('fileInput');
      if (type === 'css') {
        fileInput.setAttribute('accept', '.css');
      } else if (type === 'js') {
        fileInput.setAttribute('accept', '.js');
      } else if (type === 'html') {
        fileInput.setAttribute('accept', '.html,.htm');
      }
    }

    function closeModal() {
      document.getElementById('importModal').style.display = 'none';
    }

    // Handle file selection
    document.getElementById('fileInput').addEventListener('change', function() {
      const file = this.files[0];
      if (file) {
        const type = document.getElementById('importModal').dataset.type;
        const fileName = file.name.toLowerCase();
        
        // Validate file extension
        if (type === 'css' && !fileName.endsWith('.css')) {
          alert('Please select a CSS file (.css)');
          this.value = '';
          return;
        } else if (type === 'js' && !fileName.endsWith('.js')) {
          alert('Please select a JavaScript file (.js)');
          this.value = '';
          return;
        } else if (type === 'html' && !fileName.endsWith('.html') && !fileName.endsWith('.htm')) {
          alert('Please select an HTML file (.html or .htm)');
          this.value = '';
          return;
        }
        
        document.getElementById('importOptions').style.display = 'block';
      }
    });

    function importFile() {
      const modal = document.getElementById('importModal');
      const type = modal.dataset.type;
      const fileInput = document.getElementById('fileInput');
      const importType = document.getElementById('importType').value;
      
      if (fileInput.files.length === 0) {
        alert('Please select a file to import');
        return;
      }
      
      const file = fileInput.files[0];
      const fileName = file.name;
      
      // Additional validation (just in case)
      if (type === 'css' && !fileName.toLowerCase().endsWith('.css')) {
        alert('Invalid file type. Please select a CSS file (.css)');
        return;
      } else if (type === 'js' && !fileName.toLowerCase().endsWith('.js')) {
        alert('Invalid file type. Please select a JavaScript file (.js)');
        return;
      } else if (type === 'html' && !fileName.toLowerCase().endsWith('.html') && !fileName.toLowerCase().endsWith('.htm')) {
        alert('Invalid file type. Please select an HTML file (.html or .htm)');
        return;
      }
      
      const reader = new FileReader();
      
      reader.onload = function(e) {
        let content = e.target.result;
        let displayName = fileName.replace(/\.[^/.]+$/, "");
        
        if (type === 'html') {
          // Handle HTML import
          document.getElementById('htmlContent').textContent = content;
          updateHtmlLineNumbers();
          console.log(`Imported HTML file: ${fileName}`);
        } else if (importType === 'replace') {
          // Replace current file
          document.getElementById(`${type}Content`).textContent = content;
          document.getElementById(`${type}FileName`).value = displayName;
          updateLineNumbers(type);
          console.log(`Imported ${fileName} into current ${type.toUpperCase()} file`);
        } else {
          // Create new file
          const nextSlide = findNextAvailableSlide(type);
          if (nextSlide) {
            slides[type][nextSlide] = {
              content: content,
              name: displayName
            };
            switchSlide(type, nextSlide);
            console.log(`Imported ${fileName} as new ${type.toUpperCase()} file (Slide ${nextSlide})`);
          } else {
            alert('No available slots for new files. Maximum reached.');
          }
        }
        
        closeModal();
        updatePreview();
      };
      
      reader.readAsText(file);
    }

    function findNextAvailableSlide(type) {
      for (let i = 1; i <= totalSlides; i++) {
        if (!slides[type][i] || slides[type][i].content.trim() === '') {
          return i;
        }
      }
      return null;
    }

    function createNewFile(type) {
      const nextSlide = findNextAvailableSlide(type);
      if (nextSlide) {
        slides[type][nextSlide] = {
          content: type === 'css' ? '/* New CSS File */' : '// New JS File',
          name: `new-${type}-${nextSlide}`
        };
        switchSlide(type, nextSlide);
        console.log(`Created new ${type.toUpperCase()} file (Slide ${nextSlide})`);
      } else {
        alert('No available slots for new files. Maximum reached.');
      }
    }

    // ===== EXPORT FUNCTIONS =====
    function exportProjectAsZip() {
      const zip = new JSZip();
      const html = document.getElementById('htmlContent').innerText;
      
      // Add HTML file
      zip.file("index.html", html);
      
      // Add CSS files
      const cssFolder = zip.folder("css");
      for (let i = 1; i <= totalSlides; i++) {
        if (slides.css[i] && slides.css[i].content.trim()) {
          const fileName = slides.css[i].name || `styles${i}`;
          cssFolder.file(`${fileName}.css`, slides.css[i].content);
        }
      }
      
      // Add JS files
      const jsFolder = zip.folder("js");
      for (let i = 1; i <= totalSlides; i++) {
        if (slides.js[i] && slides.js[i].content.trim()) {
          const fileName = slides.js[i].name || `script${i}`;
          jsFolder.file(`${fileName}.js`, slides.js[i].content);
        }
      }
      
      // Generate the zip file
      zip.generateAsync({type:"blob"}).then(function(content) {
        saveAs(content, "web-project.zip");
        console.log('Project exported as web-project.zip');
      });
    }

    function exportHTML() {
      const html = document.getElementById('htmlContent').innerText;
      const blob = new Blob([html], {type: "text/html"});
      saveAs(blob, "index.html");
      console.log('HTML exported as index.html');
    }

    function clearAllData() {
      if (confirm('Are you sure you want to clear ALL data? This cannot be undone.')) {
        localStorage.clear();
        location.reload();
      }
    }

    // ===== GITHUB MONITOR FUNCTIONS =====
    function showGitHubMonitor() {
      // Load saved settings
      const savedSettings = localStorage.getItem('githubSettings');
      if (savedSettings) {
        githubSettings = JSON.parse(savedSettings);
        document.getElementById('githubRepoUrl').value = githubSettings.repoUrl || '';
        document.getElementById('gasWebAppUrl').value = githubSettings.gasWebAppUrl || '';
      }
      
      document.getElementById('githubMonitorModal').style.display = 'block';
      updateGitHubStatus('Not connected');
    }

    function closeGitHubMonitor() {
      document.getElementById('githubMonitorModal').style.display = 'none';
    }

    function updateGitHubStatus(message) {
      const statusElement = document.getElementById('githubStatus');
      statusElement.textContent = `Status: ${message}`;
      
      if (message.includes('Connected')) {
        statusElement.style.color = 'var(--success)';
      } else if (message.includes('Error')) {
        statusElement.style.color = 'var(--error)';
      } else {
        statusElement.style.color = '';
      }
    }

    function testGitHubConnection() {
      const repoUrl = document.getElementById('githubRepoUrl').value.trim();
      const gasWebAppUrl = document.getElementById('gasWebAppUrl').value.trim();
      
      if (!repoUrl || !gasWebAppUrl) {
        updateGitHubStatus('Error: Please enter both URLs');
        return;
      }
      
      updateGitHubStatus('Testing connection...');
      
      // Send a test request to the GAS web app
      fetch(`${gasWebAppUrl}?action=test&repoUrl=${encodeURIComponent(repoUrl)}`)
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            updateGitHubStatus(`Connected to ${repoUrl}`);
            console.log('GitHub connection successful:', data);
          } else {
            updateGitHubStatus(`Error: ${data.message || 'Connection failed'}`);
            console.error('GitHub connection failed:', data);
          }
        })
        .catch(error => {
          updateGitHubStatus(`Error: ${error.message}`);
          console.error('GitHub connection error:', error);
        });
    }

    function saveGitHubSettings() {
      githubSettings = {
        repoUrl: document.getElementById('githubRepoUrl').value.trim(),
        gasWebAppUrl: document.getElementById('gasWebAppUrl').value.trim()
      };
      
      localStorage.setItem('githubSettings', JSON.stringify(githubSettings));
      updateGitHubStatus('Settings saved');
      console.log('GitHub settings saved:', githubSettings);
      
      // Close the modal after a short delay
      setTimeout(closeGitHubMonitor, 1000);
    }

    function pushToGitHub() {
      if (!githubSettings.repoUrl || !githubSettings.gasWebAppUrl) {
        alert('Please configure GitHub settings first');
        showGitHubMonitor();
        return;
      }
      
      const html = document.getElementById('htmlContent').innerText;
      const cssFiles = {};
      const jsFiles = {};
      
      // Collect all CSS and JS files
      for (let i = 1; i <= totalSlides; i++) {
        if (slides.css[i] && slides.css[i].content.trim()) {
          const fileName = slides.css[i].name || `styles${i}`;
          cssFiles[`${fileName}.css`] = slides.css[i].content;
        }
        if (slides.js[i] && slides.js[i].content.trim()) {
          const fileName = slides.js[i].name || `script${i}`;
          jsFiles[`${fileName}.js`] = slides.js[i].content;
        }
      }
      
      const payload = {
        action: 'push',
        repoUrl: githubSettings.repoUrl,
        files: {
          'index.html': html,
          ...cssFiles,
          ...jsFiles
        }
      };
      
      console.log('Pushing to GitHub:', payload);
      updateGitHubStatus('Pushing to GitHub...');
      
      fetch(githubSettings.gasWebAppUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          updateGitHubStatus('Successfully pushed to GitHub');
          console.log('GitHub push successful:', data);
        } else {
          updateGitHubStatus(`Error: ${data.message || 'Push failed'}`);
          console.error('GitHub push failed:', data);
        }
      })
      .catch(error => {
        updateGitHubStatus(`Error: ${error.message}`);
        console.error('GitHub push error:', error);
      });
    }

    // ===== AUTO-SAVE =====
    function setupAutoSave() {
      // Save every 30 seconds
      autoSaveInterval = setInterval(() => {
        // Save current slide
        const activePanel = document.querySelector('.slide-panel.active');
        if (activePanel) {
          const type = activePanel.id.replace('Panel', '');
          saveCurrentSlide(type);
        }
        // Save HTML content
        localStorage.setItem('htmlContent', document.getElementById('htmlContent').innerText);
        console.log('Auto-saved project');
      }, 30000);
    }

    // ===== EVENT LISTENERS =====
    function setupEventListeners() {
      document.getElementById('typeSelect').addEventListener('change', function() {
        const value = this.value;
        closeAllPanels();
        if (value === 'css') showPanel('cssPanel');
        if (value === 'js') showPanel('jsPanel');
      });

      const htmlContent = document.getElementById('htmlContent');
      htmlContent.addEventListener('input', function() {
        updateHtmlLineNumbers();
        debouncedUpdatePreview();
      });
      htmlContent.addEventListener('scroll', syncHtmlScroll);

      document.getElementById('panelOverlay').addEventListener('click', closeAllPanels);

      // Auto-save and update preview when content changes with debounce
      const debouncedUpdatePreview = debounce(function() {
        // Auto-save current slide
        const activePanel = document.querySelector('.slide-panel.active');
        if (activePanel) {
          const type = activePanel.id.replace('Panel', '');
          saveCurrentSlide(type);
        }
        updatePreview();
      }, 100); // Short debounce for responsive typing
      
      document.getElementById('cssContent').addEventListener('input', debouncedUpdatePreview);
      document.getElementById('jsContent').addEventListener('input', debouncedUpdatePreview);

      // Handle mobile orientation change
      window.addEventListener('orientationchange', function() {
        if (window.innerWidth <= 768) {
          closeAllPanels();
        }
      });
      
      // Initialize with some default HTML if empty
      if (!htmlContent.innerText.trim()) {
        const savedHtml = localStorage.getItem('htmlContent');
        if (savedHtml) {
          htmlContent.innerText = savedHtml;
        } else {
          htmlContent.innerText = `<!DOCTYPE html>
<html>
<head>
  <title>My Page</title>
</head>
<body>
  <h1>Hello World!</h1>
  <p>Start editing to see changes in the preview panel.</p>
  <button>Click Me</button>
</body>
</html>`;
        }
        updateHtmlLineNumbers();
      }
    }

    // ===== INITIALIZATION =====
    document.addEventListener('DOMContentLoaded', function() {
      // Load theme preference
      const savedTheme = localStorage.getItem('editorTheme');
      if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
        currentTheme = 'dark';
      }

      initializeSlideTabs();
      setupEventListeners();
      setupAutoSave();
      loadPanelWidthPreference();
      loadSlide('css', 1);
      loadSlide('js', 1);
      updateHtmlLineNumbers();
      setDevice('desktop');
      
      console.log('Editor initialized with 10 CSS and 10 JS slides!');
      console.log('Try typing in the HTML, CSS or JS editors to see live updates in the preview panel.');
    });