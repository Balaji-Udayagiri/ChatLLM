const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from the current directory
app.use(express.static('.'));

// API endpoint to update config.js
app.post('/api/update-config', async (req, res) => {
    try {
        const { apiKey, model } = req.body;
        
        if (!apiKey || !model) {
            return res.status(400).json({ error: 'API key and model are required' });
        }

        // Read current config.js
        const configPath = path.join(__dirname, 'config.js');
        let configContent = await fs.readFile(configPath, 'utf8');
        
        // Update the API key and model in the config file
        configContent = configContent.replace(
            /OPENAI_API_KEY:\s*'[^']*'/,
            `OPENAI_API_KEY: '${apiKey}'`
        );
        configContent = configContent.replace(
            /DEFAULT_MODEL:\s*'[^']*'/,
            `DEFAULT_MODEL: '${model}'`
        );
        
        // Write updated config back to file
        await fs.writeFile(configPath, configContent, 'utf8');
        
        res.json({ 
            success: true, 
            message: 'Configuration updated successfully',
            apiKey: apiKey,
            model: model
        });
        
    } catch (error) {
        console.error('Error updating config:', error);
        res.status(500).json({ error: 'Failed to update configuration file' });
    }
});

// API endpoint to get current config
app.get('/api/get-config', async (req, res) => {
    try {
        const configPath = path.join(__dirname, 'config.js');
        const configContent = await fs.readFile(configPath, 'utf8');
        
        // Extract API key and model from config file
        const apiKeyMatch = configContent.match(/OPENAI_API_KEY:\s*'([^']*)'/);
        const modelMatch = configContent.match(/DEFAULT_MODEL:\s*'([^']*)'/);
        
        res.json({
            apiKey: apiKeyMatch ? apiKeyMatch[1] : '',
            model: modelMatch ? modelMatch[1] : ''
        });
        
    } catch (error) {
        console.error('Error reading config:', error);
        res.status(500).json({ error: 'Failed to read configuration file' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Frontend available at http://localhost:${PORT}`);
});