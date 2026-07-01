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
        
        // --- MOTOR DE INSTAGRAM CON TRIPLE REDUNDANCIA ---
        if (url.includes('instagram.com')) {
            const matches = url.match(/(?:reel|p|tv)\/([A-Za-z0-9_-]+)/);
            if (!matches) throw new Error('La URL no tiene un formato válido de Instagram.');
            
            const shortcode = matches[1];
            const cleanUrl = `https://www.instagram.com/reel/${shortcode}/`;

            // --- MÉTODO 1: API Espejo Avanzada (Servidor de contingencia dedicado) ---
            try {
                const resM1 = await axios.post('https://cobalt.api.smooth.gg/', {
                    url: cleanUrl,
                    videoQuality: '720',
                    audioFormat: 'mp3',
                    downloadMode: 'auto'
                }, {
                    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
                    timeout: 5000
                });

                if (resM1.data && resM1.data.url) {
                    return res.json({
                        success: true,
                        title: 'Video de Instagram',
                        thumbnail: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=500',
                        platform: 'instagram',
                        downloadUrl: resM1.data.url
                    });
                }
            } catch (e1) {
                console.log("Método 1 falló, intentando Método 2...");
            }

            // --- MÉTODO 2: API Espejo Secundaria ---
            try {
                const resM2 = await axios.post('https://co.wuk.sh/api/json', {
                    url: cleanUrl,
                    vQuality: '720'
                }, {
                    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
                    timeout: 5000
                });

                if (resM2.data && resM2.data.url) {
                    return res.json({
                        success: true,
                        title: 'Video de Instagram',
                        thumbnail: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=500',
                        platform: 'instagram',
                        downloadUrl: resM2.data.url
                    });
                }
            } catch (e2) {
                console.log("Método 2 falló, intentando Scraper Local de respaldo...");
            }

            // --- MÉTODO 3: Scraper HTML Local Dinámico (Último recurso) ---
            try {
                const embedUrl = `https://www.instagram.com/p/${shortcode}/embed/captioned/`;
                const response = await axios.get(embedUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1'
                    },
                    timeout: 4000
                });

                const html = response.data;
                let videoUrl = null;
                const videoMatchJson = html.match(/"video_url"\s*:\s*"([^"]+)"/);
                const videoMatchHtml = html.match(/<video[^>]*src="([^"]+)"/);

                if (videoMatchJson) videoUrl = videoMatchJson[1].replace(/\\u0026/g, '&');
                else if (videoMatchHtml) videoUrl = videoMatchHtml[1].replace(/&amp;/g, '&');

                if (videoUrl) {
                    return res.json({
                        success: true,
                        title: 'Video de Instagram',
                        thumbnail: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=500',
                        platform: 'instagram',
                        downloadUrl: videoUrl
                    });
                }
            } catch (e3) {
                console.log("Método 3 falló.");
            }

            // Si todos los métodos de contingencia fallan
            throw new Error('Todos los servidores espejo de Instagram están saturados en este momento. Por favor, reintenta el análisis.');
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
