const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Ruta principal para extraer videos (Soporta TikTok e Instagram)
app.post('/api/extract', async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ success: false, error: 'Falta la URL' });
    }

    try {
        // --- MOTOR DE TIKTOK ---
        if (url.includes('tiktok.com')) {
            const response = await axios.post('https://www.tikwm.com/api/', new URLSearchParams({ url: url, hd: '1' }));
            const data = response.data;
            
            if (!data || data.code !== 0) throw new Error('Error al extraer desde TikTok');

            return res.json({
                success: true,
                title: data.data.title || 'Video de TikTok',
                thumbnail: 'https://www.tikwm.com' + data.data.cover,
                platform: 'tiktok',
                downloadUrl: data.data.play
            });
        }
        
        // --- MOTOR DE INSTAGRAM ---
        if (url.includes('instagram.com')) {
            // Usamos una API pública de extracción directa para Reels/Videos
            const response = await axios.get(`https://api.vkrdown.com/api/instagram.php?url=${encodeURIComponent(url)}`);
            const data = response.data;

            if (!data || !data.data || !data.data.download_url) {
                throw new Error('No se encontró un video descargable en este enlace de Instagram. Asegúrate de que la cuenta sea pública.');
            }

            return res.json({
                success: true,
                title: data.data.caption || 'Video de Instagram',
                thumbnail: data.data.thumbnail || 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=500',
                platform: 'instagram',
                downloadUrl: data.data.download_url
            });
        }

        return res.status(400).json({ success: false, error: 'Plataforma no soportada. Introduce un link de TikTok o Instagram.' });

    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});

// Proxy para forzar la descarga del archivo con un nombre limpio
app.get('/api/download-file', async (req, res) => {
    const videoUrl = req.query.url;
    let title = req.query.title || 'video';
    
    // Limpiar caracteres extraños del título
    title = title.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);

    if (!videoUrl) return res.status(400).send('Falta la URL del video');

    try {
        const response = await axios({
            method: 'GET',
            url: videoUrl,
            responseType: 'stream',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        res.setHeader('Content-Disposition', `attachment; filename="${title}.mp4"`);
        res.setHeader('Content-Type', 'video/mp4');
        response.data.pipe(res);
    } catch (error) {
        res.status(500).send('Error al descargar el archivo a través del servidor.');
    }
});

app.listen(PORT, () => {
    console.log(`Servidor de descarga corriendo perfectamente en el puerto ${PORT}`);
});
