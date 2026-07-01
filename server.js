const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/download-file', async (req, res) => {
    const { url, title } = req.query;
    if (!url) return res.status(400).send('URL requerida');
    
    try {
        const response = await axios({
            method: 'get',
            url: url,
            responseType: 'stream',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
            }
        });
        
        const safeTitle = (title || 'video').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
        
        res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}.mp4"`);
        res.setHeader('Content-Type', 'video/mp4');
        
        response.data.pipe(res);
    } catch (error) {
        res.status(500).send('Error en la descarga directa: ' + error.message);
    }
});

app.post('/api/extract', async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ success: false, error: 'URL requerida' });

    try {
        if (url.includes('tiktok.com')) {
            const response = await axios.post('https://www.tikwm.com/api/', new URLSearchParams({ url: url, hd: '1' }));
            const data = response.data;
            if (!data || data.code !== 0) throw new Error('Error en TikTok');
            
            return res.json({ 
                success: true, 
                title: data.data.title || 'Video de TikTok',
                thumbnail: 'https://www.tikwm.com' + data.data.cover,
                platform: 'tiktok',
                downloadUrl: data.data.play 
            });
        }
        return res.json({ success: false, error: 'Prueba con un link de TikTok' });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, () => {
    console.log('Servidor de descarga corriendo perfectamente en el puerto 5001');
});
