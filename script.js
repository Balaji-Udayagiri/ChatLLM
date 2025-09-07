class ChatApp {
    constructor() {
        this.apiKey = '';
        this.model = 'gpt-3.5-turbo';
        this.conversations = [];
        this.currentConversationId = null;
        this.isConfigVisible = true;
        this.isSidebarVisible = true;
        this.attachments = [];
        this.init();
        this.setupMarkdownRenderer();
    }

    async init() {
        console.log('Initializing ChatApp...');
        
        // Set welcome time
        document.getElementById('welcomeTime').textContent = this.getCurrentTime();
        
        // Load saved data
        await this.loadSavedData();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Create initial conversation if none exist
        if (this.conversations.length === 0) {
            console.log('No conversations found, creating new chat');
            this.createNewChat();
        } else {
            console.log(`Found ${this.conversations.length} conversations, loading the most recent one`);
            this.renderConversations();
            // Load the most recent conversation
            this.loadConversation(this.conversations[0].id);
        }
        
        // Update model display
        this.updateModelDisplay();
        
        // Auto-hide config if API key exists
        if (this.apiKey) {
            this.toggleConfig();
        }
        
        // Focus on input
        document.getElementById('chatInput').focus();
        
        console.log('ChatApp initialized successfully');
    }

    async loadSavedData() {
        // First try to load from config.js via API
        try {
            const response = await fetch('http://localhost:3001/api/get-config');
            if (response.ok) {
                const config = await response.json();
                if (config.apiKey && config.model) {
                    this.apiKey = config.apiKey;
                    this.model = config.model;
                    document.getElementById('apiKeyInput').value = config.apiKey;
                    document.getElementById('modelInput').value = config.model;
                    console.log('Loaded configuration from config.js');
                }
            }
        } catch (error) {
            console.log('Could not load from config.js, falling back to localStorage');
        }
        
        // Always load from localStorage as fallback or if config.js didn't have values
        const savedApiKey = localStorage.getItem('openai_api_key');
        const savedModel = localStorage.getItem('openai_model');
        
        if (savedApiKey && !this.apiKey) {
            this.apiKey = savedApiKey;
            document.getElementById('apiKeyInput').value = savedApiKey;
        }
        
        if (savedModel && !this.model) {
            this.model = savedModel;
            document.getElementById('modelInput').value = savedModel;
        }

        // Load conversations from localStorage (always)
        const savedConversations = localStorage.getItem('chat_conversations');
        if (savedConversations) {
            try {
                this.conversations = JSON.parse(savedConversations);
                console.log(`Loaded ${this.conversations.length} conversations from localStorage`);
            } catch (error) {
                console.error('Error parsing saved conversations:', error);
                this.conversations = [];
            }
        } else {
            console.log('No saved conversations found');
        }

        // Load UI state
        const sidebarState = localStorage.getItem('sidebar_visible');
        if (sidebarState !== null) {
            this.isSidebarVisible = JSON.parse(sidebarState);
            const sidebar = document.getElementById('sidebar');
            const toggleButton = document.querySelector('.sidebar-toggle');
            
            if (!this.isSidebarVisible) {
                sidebar.classList.add('hidden');
            }
            
            // Update toggle button state
            if (toggleButton) {
                toggleButton.title = this.isSidebarVisible ? 'Hide sidebar' : 'Show sidebar';
            }
        }
    }

    setupEventListeners() {
        const chatInput = document.getElementById('chatInput');
        
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        chatInput.addEventListener('input', this.autoResize);
        
        // Handle window resize for mobile
        window.addEventListener('resize', () => {
            if (window.innerWidth <= 768) {
                this.isSidebarVisible = false;
                document.getElementById('sidebar').classList.add('hidden');
            }
        });
        
        // Close attachment menu when clicking outside
        document.addEventListener('click', (e) => {
            const menu = document.getElementById('attachmentMenu');
            const button = document.querySelector('.attachment-button');
            
            if (!menu.contains(e.target) && !button.contains(e.target)) {
                menu.classList.remove('show');
            }
        });
        
        // Keyboard shortcut for sidebar toggle (Ctrl/Cmd + B)
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
                e.preventDefault();
                this.toggleSidebar();
            }
        });
    }

    autoResize(e) {
        e.target.style.height = 'auto';
        e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
    }

    getCurrentTime() {
        return new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    setupMarkdownRenderer() {
        // Configure marked for markdown rendering
        if (typeof marked !== 'undefined') {
            marked.setOptions({
                highlight: function(code, lang) {
                    if (typeof hljs !== 'undefined' && lang && hljs.getLanguage(lang)) {
                        try {
                            return hljs.highlight(code, { language: lang }).value;
                        } catch (err) {
                            console.warn('Error highlighting code:', err);
                        }
                    }
                    return code;
                },
                breaks: true,
                gfm: true
            });
        }

        // Configure MathJax
        if (typeof MathJax !== 'undefined') {
            window.MathJax = {
                tex: {
                    inlineMath: [['$', '$'], ['\\(', '\\)']],
                    displayMath: [['$$', '$$'], ['\\[', '\\]'], ['[', ']']],
                    processEscapes: true,
                    processEnvironments: true,
                    macros: {
                        "\\ldots": "\\cdots"
                    }
                },
                options: {
                    skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre'],
                    ignoreHtmlClass: 'tex2jax_ignore',
                    processHtmlClass: 'tex2jax_process'
                },
                startup: {
                    ready: function () {
                        MathJax.startup.defaultReady();
                        console.log('MathJax is ready');
                    }
                }
            };
        }
    }

    renderMarkdown(text) {
        if (typeof marked === 'undefined') {
            // Fallback to plain text if marked is not available
            return text.replace(/\n/g, '<br>');
        }

        try {
            // Pre-process math equations to ensure proper formatting
            let processedText = text;
            
            // First, protect code blocks from math conversion
            const codeBlocks = [];
            processedText = processedText.replace(/```[\s\S]*?```/g, (match) => {
                const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`;
                codeBlocks.push(match);
                return placeholder;
            });
            
            // Also protect inline code
            processedText = processedText.replace(/`[^`]+`/g, (match) => {
                const placeholder = `__INLINE_CODE_${codeBlocks.length}__`;
                codeBlocks.push(match);
                return placeholder;
            });
            
            // Convert [ ... ] to \[ ... \] for display math
            processedText = processedText.replace(/\[([^\]]*)\]/g, (match, content) => {
                // Only convert if it looks like math (contains LaTeX commands)
                if (content.includes('\\') || content.includes('frac') || content.includes('sum') || 
                    content.includes('int') || content.includes('ldots') || content.includes('=') ||
                    content.includes('^') || content.includes('_') || content.includes('(') && content.includes(')')) {
                    return `\\[${content}\\]`;
                }
                return match;
            });
            
            // Convert ( ... ) to \( ... \) for inline math (only for clear math expressions)
            processedText = processedText.replace(/\(([^)]*)\)/g, (match, content) => {
                // Only convert if it contains clear math indicators (LaTeX commands)
                const hasLaTeXCommands = content.includes('\\') && (
                    content.includes('frac') || content.includes('sum') || content.includes('int') ||
                    content.includes('omega') || content.includes('alpha') || content.includes('beta') ||
                    content.includes('gamma') || content.includes('delta') || content.includes('theta') ||
                    content.includes('lambda') || content.includes('pi') || content.includes('sigma') ||
                    content.includes('sqrt') || content.includes('sin') || content.includes('cos') ||
                    content.includes('tan') || content.includes('log') || content.includes('exp') ||
                    content.includes('lim') || content.includes('infty') || content.includes('partial') ||
                    content.includes('nabla') || content.includes('cdot') || content.includes('times')
                );
                
                // Only convert if it's clearly a math expression
                if (hasLaTeXCommands) {
                    return `\\(${content}\\)`;
                }
                return match;
            });
            
            // Restore code blocks
            codeBlocks.forEach((codeBlock, index) => {
                processedText = processedText.replace(`__CODE_BLOCK_${index}__`, codeBlock);
                processedText = processedText.replace(`__INLINE_CODE_${index}__`, codeBlock);
            });
            
            // Render markdown
            const html = marked.parse(processedText);
            
            return html;
        } catch (error) {
            console.error('Error rendering markdown:', error);
            return text.replace(/\n/g, '<br>');
        }
    }

    async saveConfig() {
        const apiKey = document.getElementById('apiKeyInput').value.trim();
        const model = document.getElementById('modelInput').value.trim();
        
        if (!apiKey) {
            alert('Please enter your OpenAI API key');
            return;
        }
        
        if (!model) {
            alert('Please enter a model name');
            return;
        }
        
        this.apiKey = apiKey;
        this.model = model;
        
        // Save to localStorage (for immediate use)
        localStorage.setItem('openai_api_key', apiKey);
        localStorage.setItem('openai_model', model);
        
        // Try to update config.js file via API
        try {
            const response = await fetch('http://localhost:3001/api/update-config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ apiKey, model })
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log('Configuration updated in config.js:', result.message);
            } else {
                console.warn('Could not update config.js file, but saved to localStorage');
            }
        } catch (error) {
            console.warn('Could not connect to backend, but saved to localStorage:', error.message);
        }
        
        this.updateModelDisplay();
        document.getElementById('status').textContent = `Ready with ${model}`;
        alert('Configuration saved to both localStorage and config.js!');
    }

    setModel(modelName) {
        document.getElementById('modelInput').value = modelName;
        this.model = modelName;
        localStorage.setItem('openai_model', modelName);
        this.updateModelDisplay();
        
        // Show brief confirmation
        const oldStatus = document.getElementById('status').textContent;
        document.getElementById('status').textContent = `Switched to ${modelName}`;
        setTimeout(() => {
            document.getElementById('status').textContent = oldStatus;
        }, 2000);
    }

    updateModelDisplay() {
        const modelElement = document.getElementById('currentModel');
        if (modelElement) {
            if (this.model) {
                modelElement.textContent = `Model: ${this.model}`;
            } else {
                modelElement.textContent = 'Model: Not configured';
            }
        }
    }

    toggleConfig() {
        const panel = document.getElementById('configPanel');
        this.isConfigVisible = !this.isConfigVisible;
        if (this.isConfigVisible) {
            panel.classList.remove('hidden');
        } else {
            panel.classList.add('hidden');
        }
    }

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        const toggleButton = document.querySelector('.sidebar-toggle');
        
        if (!sidebar) {
            console.error('Sidebar element not found');
            return;
        }
        
        this.isSidebarVisible = !this.isSidebarVisible;
        
        if (this.isSidebarVisible) {
            sidebar.classList.remove('hidden');
            if (toggleButton) {
                toggleButton.textContent = '☰';
                toggleButton.title = 'Hide sidebar';
            }
        } else {
            sidebar.classList.add('hidden');
            if (toggleButton) {
                toggleButton.textContent = '☰';
                toggleButton.title = 'Show sidebar';
            }
        }
        
        // Save state to localStorage
        localStorage.setItem('sidebar_visible', this.isSidebarVisible);
        console.log(`Sidebar ${this.isSidebarVisible ? 'shown' : 'hidden'}`);
    }

    createNewChat() {
        const conversation = {
            id: this.generateId(),
            title: 'New Chat',
            messages: [],
            createdAt: new Date().toISOString(),
            lastMessageAt: new Date().toISOString()
        };

        this.conversations.unshift(conversation);
        this.saveConversations();
        this.renderConversations();
        this.loadConversation(conversation.id);
        
        console.log('Created new chat:', conversation.id);
    }

    loadConversation(conversationId) {
        console.log('Loading conversation:', conversationId);
        
        const conversation = this.conversations.find(c => c.id === conversationId);
        if (!conversation) {
            console.error('Conversation not found:', conversationId);
            return;
        }

        this.currentConversationId = conversationId;
        
        // Update UI
        document.getElementById('chatTitle').textContent = conversation.title;
        this.renderMessages(conversation.messages);
        
        // Update active conversation in sidebar
        document.querySelectorAll('.conversation-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-conversation-id="${conversationId}"]`)?.classList.add('active');
        
        // Focus input
        document.getElementById('chatInput').focus();
    }

    renderMessages(messages) {
        const messagesContainer = document.getElementById('chatMessages');
        messagesContainer.innerHTML = '';

        if (messages.length === 0) {
            // Show welcome message
            messagesContainer.innerHTML = `
                <div class="message ai">
                    <div class="message-content">
                        <div class="markdown-content">Hello! I'm your AI assistant. How can I help you today?</div>
                        <div class="message-time">${this.getCurrentTime()}</div>
                    </div>
                </div>
            `;
        } else {
            messages.forEach(message => {
                this.addMessageToDOM(message.content, message.role === 'user', message.timestamp);
            });
        }

        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    renderConversations() {
        const container = document.getElementById('conversationsList');
        container.innerHTML = '';

        this.conversations.forEach(conversation => {
            const conversationEl = document.createElement('div');
            conversationEl.className = 'conversation-item';
            conversationEl.setAttribute('data-conversation-id', conversation.id);
            
            const lastMessage = conversation.messages[conversation.messages.length - 1];
            const preview = lastMessage ? 
                (lastMessage.role === 'user' ? 'You: ' : 'AI: ') + lastMessage.content.substring(0, 50) + '...' :
                'No messages yet';

            conversationEl.innerHTML = `
                <div class="conversation-title">${conversation.title}</div>
                <div class="conversation-preview">${preview}</div>
                <div class="conversation-time">${new Date(conversation.lastMessageAt).toLocaleDateString()}</div>
                <div class="conversation-actions">
                    <button class="action-btn delete-btn" onclick="event.stopPropagation(); chatApp.deleteConversation('${conversation.id}')">Delete</button>
                </div>
            `;

            conversationEl.addEventListener('click', () => {
                this.loadConversation(conversation.id);
            });

            container.appendChild(conversationEl);
        });
    }

    deleteConversation(conversationId) {
        if (!confirm('Are you sure you want to delete this conversation?')) {
            return;
        }

        this.conversations = this.conversations.filter(c => c.id !== conversationId);
        this.saveConversations();
        this.renderConversations();

        // If we deleted the current conversation, create a new one
        if (this.currentConversationId === conversationId) {
            if (this.conversations.length > 0) {
                this.loadConversation(this.conversations[0].id);
            } else {
                this.createNewChat();
            }
        }
    }

    updateConversationTitle(conversationId, newTitle) {
        const conversation = this.conversations.find(c => c.id === conversationId);
        if (conversation) {
            conversation.title = newTitle;
            this.saveConversations();
            this.renderConversations();
        }
    }

    saveConversations() {
        localStorage.setItem('chat_conversations', JSON.stringify(this.conversations));
    }

    addMessage(content, isUser = false) {
        if (!this.currentConversationId) {
            console.error('No active conversation');
            return;
        }

        const conversation = this.conversations.find(c => c.id === this.currentConversationId);
        if (!conversation) {
            console.error('Current conversation not found');
            return;
        }

        const message = {
            role: isUser ? 'user' : 'assistant',
            content: content,
            timestamp: new Date().toISOString()
        };

        conversation.messages.push(message);
        conversation.lastMessageAt = message.timestamp;

        // Update title based on first user message
        if (isUser && conversation.messages.filter(m => m.role === 'user').length === 1) {
            const displayContent = typeof content === 'string' ? content : 
                content.find(c => c.type === 'text')?.text || 'Image message';
            const newTitle = displayContent.length > 30 ? displayContent.substring(0, 30) + '...' : displayContent;
            this.updateConversationTitle(conversation.id, newTitle);
        }

        // Always save conversations after adding a message
        this.saveConversations();
        console.log(`Saved conversation with ${conversation.messages.length} messages`);
        
        this.addMessageToDOM(content, isUser);
        this.renderConversations(); // Update sidebar
    }

    addMessageToDOM(content, isUser = false, timestamp = null) {
        const messagesContainer = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isUser ? 'user' : 'ai'}`;
        
        const timeText = timestamp ? 
            new Date(timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) :
            this.getCurrentTime();
        
        let displayContent = '';
        
        // Handle different content types
        if (typeof content === 'string') {
            // Simple string content
            displayContent = isUser ? content : this.renderMarkdown(content);
        } else if (Array.isArray(content)) {
            // Content array (for messages with images)
            const textContent = content.find(c => c.type === 'text')?.text || '';
            const imageContent = content.filter(c => c.type === 'image_url');
            
            if (textContent) {
                displayContent = isUser ? textContent : this.renderMarkdown(textContent);
            }
            
            // Add image previews for user messages
            if (isUser && imageContent.length > 0) {
                displayContent += '<div class="image-attachments">';
                imageContent.forEach(img => {
                    displayContent += `<img src="${img.image_url.url}" style="max-width: 200px; max-height: 200px; border-radius: 8px; margin: 8px 0; border: 1px solid #e0e0e0;">`;
                });
                displayContent += '</div>';
            }
        }
        
        messageDiv.innerHTML = `
            <div class="message-content">
                ${isUser ? displayContent : `<div class="markdown-content">${displayContent}</div>`}
                <div class="message-time">${timeText}</div>
            </div>
        `;
        
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        // Trigger MathJax rendering for AI messages
        if (!isUser && typeof MathJax !== 'undefined') {
            setTimeout(() => {
                try {
                    MathJax.typesetPromise([messageDiv]).then(() => {
                        console.log('MathJax rendering completed');
                    }).catch((err) => {
                        console.error('MathJax rendering error:', err);
                    });
                } catch (error) {
                    console.error('MathJax error:', error);
                }
            }, 200);
        }
        
        // Add copy buttons to code blocks
        this.addCopyButtonsToCodeBlocks(messageDiv);
        
        return messageDiv;
    }

    showTyping() {
        document.getElementById('typingIndicator').classList.add('show');
        document.getElementById('chatMessages').scrollTop = document.getElementById('chatMessages').scrollHeight;
    }

    hideTyping() {
        document.getElementById('typingIndicator').classList.remove('show');
    }

    showError(message) {
        const messagesContainer = document.getElementById('chatMessages');
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = `Error: ${message}`;
        messagesContainer.appendChild(errorDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    showLoading() {
        document.getElementById('loadingOverlay').classList.add('show');
    }

    hideLoading() {
        document.getElementById('loadingOverlay').classList.remove('show');
    }

    toggleAttachmentMenu() {
        const menu = document.getElementById('attachmentMenu');
        const isVisible = menu.classList.contains('show');
        
        if (isVisible) {
            menu.classList.remove('show');
        } else {
            menu.classList.add('show');
        }
    }

    selectFiles(type) {
        const fileInput = document.getElementById('fileInput');
        
        // Set accept attribute based on file type
        switch(type) {
            case 'image':
                fileInput.accept = 'image/*';
                break;
            case 'document':
                fileInput.accept = '.pdf,.txt,.doc,.docx,.json,.csv,.md';
                break;
            case 'any':
                fileInput.accept = '*/*';
                break;
        }
        
        // Trigger file selection
        fileInput.click();
        
        // Hide menu after selection
        document.getElementById('attachmentMenu').classList.remove('show');
        
        // Handle file selection
        fileInput.onchange = (e) => {
            const files = Array.from(e.target.files);
            this.handleFileSelection(files);
        };
    }

    handleFileSelection(files) {
        files.forEach(file => {
            // Check file size (10MB limit)
            if (file.size > 10 * 1024 * 1024) {
                alert(`File ${file.name} is too large. Maximum size is 10MB.`);
                return;
            }
            
            // Add to attachments
            this.attachments.push(file);
        });
        
        this.renderAttachments();
    }

    renderAttachments() {
        const container = document.getElementById('attachmentsPreview');
        
        if (this.attachments.length === 0) {
            container.classList.remove('show');
            return;
        }
        
        container.classList.add('show');
        container.innerHTML = '';
        
        this.attachments.forEach((file, index) => {
            const attachmentDiv = document.createElement('div');
            attachmentDiv.className = 'attachment-item';
            
            // Create preview based on file type
            let preview = '';
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    attachmentDiv.querySelector('.attachment-preview').innerHTML = 
                        `<img src="${e.target.result}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 4px;">`;
                };
                reader.readAsDataURL(file);
                preview = '🖼️';
            } else if (file.type.includes('pdf')) {
                preview = '📄';
            } else if (file.type.includes('text')) {
                preview = '📝';
            } else if (file.type.includes('json')) {
                preview = '📋';
            } else if (file.type.includes('csv')) {
                preview = '📊';
            } else {
                preview = '📁';
            }
            
            attachmentDiv.innerHTML = `
                <div class="attachment-preview">${preview}</div>
                <div class="attachment-info">
                    <div class="attachment-name">${file.name}</div>
                    <div class="attachment-size">${this.formatFileSize(file.size)}</div>
                </div>
                <button class="attachment-remove" onclick="chatApp.removeAttachment(${index})">×</button>
            `;
            
            container.appendChild(attachmentDiv);
        });
    }

    removeAttachment(index) {
        this.attachments.splice(index, 1);
        this.renderAttachments();
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    async sendMessage() {
        if (!this.apiKey) {
            alert('Please configure your OpenAI API key first');
            this.toggleConfig();
            return;
        }

        if (!this.currentConversationId) {
            console.error('No active conversation');
            return;
        }

        const input = document.getElementById('chatInput');
        const message = input.value.trim();
        
        if (!message && this.attachments.length === 0) {
            return;
        }

        // Clear input and add user message
        input.value = '';
        input.style.height = 'auto';
        
        // Prepare message content
        let messageContent = message || '';
        if (this.attachments.length > 0) {
            const attachmentNames = this.attachments.map(f => f.name).join(', ');
            messageContent += (messageContent ? '\n\n' : '') + `[Attachments: ${attachmentNames}]`;
        }
        
        this.addMessage(messageContent, true);
        
        // Show typing indicator
        this.showTyping();
        
        try {
            // Prepare messages for API
            const conversation = this.conversations.find(c => c.id === this.currentConversationId);
            const apiMessages = [...conversation.messages];
            
            // Add current message with attachments
            const currentMessage = {
                role: 'user',
                content: []
            };
            
            // Add text content if any
            if (message) {
                currentMessage.content.push({
                    type: 'text',
                    text: message
                });
            }
            
            // Add image attachments
            for (const file of this.attachments) {
                if (file.type.startsWith('image/')) {
                    const base64 = await this.fileToBase64(file);
                    currentMessage.content.push({
                        type: 'image_url',
                        image_url: {
                            url: `data:${file.type};base64,${base64}`
                        }
                    });
                }
            }
            
            // If no text content, add a default message
            if (currentMessage.content.length === 0) {
                currentMessage.content.push({
                    type: 'text',
                    text: 'Please analyze these images.'
                });
            }
            
            apiMessages.push(currentMessage);
            
            // Model-specific parameter handling
            const requestBody = {
                model: this.model,
                messages: apiMessages
            };

            // Add model-specific parameters
            if (this.model.startsWith('o1') || this.model.startsWith('o3')) {
                // o1 and o3 models don't support temperature or max_tokens
                requestBody.max_completion_tokens = 1000;
            } else {
                // Standard models
                requestBody.max_tokens = 1000;
                requestBody.temperature = 0.7;
            }

            console.log(`Making API request with model: ${this.model}`);
            console.log('Request body:', JSON.stringify(requestBody, null, 2));

            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                let errorMessage = `API Error: ${response.status} ${response.statusText}`;
                try {
                    const errorData = await response.json();
                    console.error('API Error Response:', errorData);
                    if (errorData.error) {
                        errorMessage += ` - ${errorData.error.message}`;
                    }
                } catch (e) {
                    console.error('Could not parse error response');
                }
                throw new Error(errorMessage);
            }

            const data = await response.json();
            const aiMessage = data.choices[0].message.content;
            
            // Add the current message to conversation
            conversation.messages.push(currentMessage);
            
            this.hideTyping();
            this.addMessage(aiMessage, false);
            
        } catch (error) {
            console.error('Error sending message:', error);
            this.hideTyping();
            this.showError(error.message);
        } finally {
            // Clear attachments after sending
            this.attachments = [];
            this.renderAttachments();
        }
    }

    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                const base64 = reader.result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = error => reject(error);
        });
    }

    addCopyButtonsToCodeBlocks(container) {
        const codeBlocks = container.querySelectorAll('pre code');
        
        codeBlocks.forEach((codeElement, index) => {
            const preElement = codeElement.parentElement;
            
            // Skip if already has copy button
            if (preElement.querySelector('.copy-button')) {
                return;
            }
            
            // Wrap in container
            const wrapper = document.createElement('div');
            wrapper.className = 'code-block-container';
            preElement.parentNode.insertBefore(wrapper, preElement);
            wrapper.appendChild(preElement);
            
            // Add language label if available
            const language = this.detectLanguage(codeElement.textContent);
            if (language) {
                const langLabel = document.createElement('div');
                langLabel.className = 'code-language';
                langLabel.textContent = language;
                wrapper.appendChild(langLabel);
            }
            
            // Add copy button
            const copyButton = document.createElement('button');
            copyButton.className = 'copy-button';
            copyButton.textContent = 'Copy';
            copyButton.onclick = () => this.copyCodeToClipboard(codeElement.textContent, copyButton);
            wrapper.appendChild(copyButton);
        });
    }

    detectLanguage(code) {
        // Simple language detection based on common patterns
        if (code.includes('function') || code.includes('const') || code.includes('let') || code.includes('var') || code.includes('=>')) {
            return 'javascript';
        }
        if (code.includes('def ') || code.includes('import ') || code.includes('from ') || code.includes('print(') || code.includes('if __name__')) {
            return 'python';
        }
        if (code.includes('public class') || code.includes('public static void main') || code.includes('System.out.print')) {
            return 'java';
        }
        if (code.includes('#include') || code.includes('using namespace') || code.includes('std::') || code.includes('cout') || code.includes('cin')) {
            return 'cpp';
        }
        if (code.includes('#include') && code.includes('printf') && code.includes('scanf')) {
            return 'c';
        }
        if (code.includes('<html') || code.includes('<head') || code.includes('<body') || code.includes('<div')) {
            return 'html';
        }
        if (code.includes('.') && code.includes('{') && code.includes('}') && code.includes('margin')) {
            return 'css';
        }
        if (code.includes('SELECT') || code.includes('INSERT') || code.includes('UPDATE') || code.includes('DELETE')) {
            return 'sql';
        }
        if (code.includes('#!/bin/') || code.includes('echo ') || code.includes('cd ') || code.includes('ls ')) {
            return 'bash';
        }
        if (code.includes('{') && code.includes('}') && code.includes('"') && code.includes(':')) {
            return 'json';
        }
        
        return null;
    }

    async copyCodeToClipboard(code, button) {
        try {
            await navigator.clipboard.writeText(code);
            button.textContent = 'Copied!';
            button.classList.add('copied');
            
            setTimeout(() => {
                button.textContent = 'Copy';
                button.classList.remove('copied');
            }, 2000);
        } catch (err) {
            console.error('Failed to copy code:', err);
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = code;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            
            button.textContent = 'Copied!';
            button.classList.add('copied');
            
            setTimeout(() => {
                button.textContent = 'Copy';
                button.classList.remove('copied');
            }, 2000);
        }
    }
}

// Initialize the app when the page loads
const chatApp = new ChatApp();
