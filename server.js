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
        
        // --- MOTOR DE INSTAGRAM AUTÓNOMO (SIN APIs INTERMEDIAS) ---
        if (url.includes('instagram.com')) {
            const matches = url.match(/(?:reel|p|tv)\/([A-Za-z0-9_-]+)/);
            if (!matches) {
                throw new Error('La URL no tiene un formato válido de Instagram.');
            }
            
            const shortcode = matches[1];
            // Consultamos la variante de datos limpios usando el formato de consulta de consulta nativo de Instagram
            const targetUrl = `https://www.instagram.com/p/${shortcode}/?__a=1&__d=dis`;

            const response = await axios.get(targetUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
                    'Accept': '*/*',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'Sec-Fetch-Mode': 'navigate'
                }
            });

            const data = response.data;

            // Validar la estructura del objeto Graphql nativo de Meta
            if (data && data.items && data.items[0]) {
                const item = data.items[0];
                
                if (item.video_versions && item.video_versions.length > 0) {
                    // Tomamos el flujo de video con mayor resolución disponible
                    const videoUrl = item.video_versions[0].url;
                    const thumbUrl = item.image_versions2 && item.image_versions2.candidates ? item.image_versions2.candidates[0].url : 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=500';

                    return res.json({
                        success: true,
                        title: item.caption && item.caption.text ? item.caption.text : 'Video de Instagram',
                        thumbnail: thumbUrl,
                        platform: 'instagram',
                        downloadUrl: videoUrl
                    });
                } else {
                    throw new Error('Esta publicación no contiene un archivo de video reproducible.');
                }
            } else {
                // Alternativa de contingencia si Meta bloquea el JSON directo: parsear la página incrustada estándar
                const embedUrl = `https://www.instagram.com/p/${shortcode}/embed/captioned/`;
                const embedResponse = await axios.get(embedUrl, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36' }
                });
                
                const html = embedResponse.data;
                const videoMatch = html.match(/"video_url":"([^"]+)"/);
                
                if (videoMatch) {
                    const cleanVideoUrl = videoMatch[1].replace(/\\u0026/g, '&');
                    return res.json({
                        success: true,
                        title: 'Video de Instagram',
                        thumbnail: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=500',
                        platform: 'instagram',
                        downloadUrl: cleanVideoUrl
                    });
                }
                
                throw new Error('El servidor de Instagram denegó el acceso temporalmente. Inténtalo de nuevo.');
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
