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
    let { url } = req.body;

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
        
        // --- MOTOR DE INSTAGRAM HTML SCRAPER (100% AUTÓNOMO) ---
        if (url.includes('instagram.com')) {
            const matches = url.match(/(?:reel|p|tv)\/([A-Za-z0-9_-]+)/);
            if (!matches) {
                throw new Error('La URL no tiene un formato válido de Instagram.');
            }
            
            const shortcode = matches[1];
            // Usamos la versión de inserción pública oficial que no requiere sesión iniciada
            const embedUrl = `https://www.instagram.com/p/${shortcode}/embed/captioned/`;

            const response = await axios.get(embedUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'es-ES,es;q=0.9'
                }
            });

            const html = response.data;

            // Intentar capturar la URL del video en sus dos variantes de empaquetado comunes de Meta
            let videoUrl = null;
            const videoMatchJson = html.match(/"video_url"\s*:\s*"([^"]+)"/);
            const videoMatchHtml = html.match(/<video[^>]*src="([^"]+)"/);

            if (videoMatchJson) {
                videoUrl = videoMatchJson[1].replace(/\\u0026/g, '&');
            } else if (videoMatchHtml) {
                videoUrl = videoMatchHtml[1].replace(/&amp;/g, '&');
            }

            // Intentar capturar la miniatura (thumbnail) de respaldo
            let thumbnailUrl = 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=500';
            const thumbMatch = html.match(/"display_url"\s*:\s*"([^"]+)"/);
            if (thumbMatch) {
                thumbnailUrl = thumbMatch[1].replace(/\\u0026/g, '&');
            }

            if (videoUrl) {
                return res.json({
                    success: true,
                    title: 'Video de Instagram',
                    thumbnail: thumbnailUrl,
                    platform: 'instagram',
                    downloadUrl: videoUrl
                });
            } else {
                throw new Error('Meta restringió temporalmente el flujo de reproducción de este contenido. Reintenta en unos segundos.');
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
        res.status(500).send('Error al procesar la descarga.');
    }
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});
