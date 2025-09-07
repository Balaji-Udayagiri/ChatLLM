# ChatLLM

A simple AI chat interface built with HTML, CSS, JavaScript, and Node.js backend.

## Features

- **AI Chat Interface**: Chat with OpenAI models (GPT-3.5, GPT-4, etc.)
- **Configuration Management**: Update API keys and model settings through UI
- **Persistent Storage**: Conversations and settings are saved locally
- **File Attachments**: Support for images and documents
- **Responsive Design**: Works on desktop and mobile devices

## Quick Start

### Option 1: Easy Start (Windows)
1. Double-click `start.bat`
2. Open your browser to `http://localhost:3001`
3. Enter your OpenAI API key and model name
4. Start chatting!

### Option 2: Manual Start

#### Backend (Required)
```bash
# Install dependencies
npm install

# Start backend server
node server.js
```

#### Frontend
Open `http://localhost:3001` in your browser.

## Configuration

The application now supports two configuration methods:

1. **UI Configuration**: Enter API key and model in the settings panel
2. **File Configuration**: Directly edit `config.js` for default values

When you save configuration through the UI, it updates both:
- Browser localStorage (for immediate use)
- `config.js` file (for persistence and sharing)

## API Endpoints

- `GET /api/get-config` - Get current configuration from config.js
- `POST /api/update-config` - Update configuration in config.js

## Requirements

- Node.js (for backend server)
- Modern web browser
- OpenAI API key
