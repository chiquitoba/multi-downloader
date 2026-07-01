const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/extract', async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ success: false, error: 'Falta la URL' });
    }

    try {
        // --- MOTOR DE TIKTOK (Estable) ---
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
        
        // --- MOTOR DE INSTAGRAM PREMIUM AUTOMÁTICO ---
        if (url.includes('instagram.com')) {
            // Extraer el identificador único del Reel / Post
            const matches = url.match(/(?:reel|p|tv)\/([A-Za-z0-9_-]+)/);
            if (!matches) {
                throw new Error('La URL no tiene un formato válido de Reel de Instagram.');
            }
            const shortcode = matches[1];

            // Consultamos un motor API de respaldo público de alta rotación (FastIG API)
            const options = {
                method: 'GET',
                url: `https://instagram-downloader-download-instagram-videos-stories.p.rapidapi.com/index`,
                params: { url: `https://www.instagram.com/p/${shortcode}/` },
                headers: {
                    'x-rapidapi-key': '2b9cfba298msh2f36f98ef479f6cp156cfajsn85cbe047fa55',
                    'x-rapidapi-host': 'instagram-downloader-download-instagram-videos-stories.p.rapidapi.com'
                }
            };

            const response = await axios.request(options);
            const data = response.data;

            // Mapeamos las respuestas del motor de la API pública
            if (data && data.media) {
                return res.json({
                    success: true,
                    title: 'Video de Instagram',
                    thumbnail: data.thumbnail || 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=500',
                    platform: 'instagram',
                    downloadUrl: data.media
                });
            } else if (data && data.Type === 'Post-Video' && data.Download) {
                return res.json({
                    success: true,
                    title: 'Video de Instagram',
                    thumbnail: data.Thumbnail || 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=500',
                    platform: 'instagram',
                    downloadUrl: data.Download
                });
            } else {
                throw new Error('El sistema de extracción externa está saturado. Inténtalo de nuevo en unos segundos.');
            }
        }

        return res.status(400).json({ success: false, error: 'Plataforma no soportada.' });

    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/download-file', async (req, res) => {
    const videoUrl = req.query.url;
    let title = req.query.title || 'video';
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
        res.status(500).send('Error al procesar la descarga del archivo.');
    }
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});
