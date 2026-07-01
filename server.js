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
        
        // --- MOTOR DE INSTAGRAM AUTÓNOMO (MÉTODO DE CONSULTA DIRECTA POR API ABIERTA DE INSTAGRAM) ---
        if (url.includes('instagram.com')) {
            // Limpiar URL base del reel o post
            const matches = url.match(/(?:reel|p)\/([A-Za-z0-9_-]+)/);
            if (!matches) {
                throw new Error('URL de Instagram no válida o no soportada. Asegúrate de que sea un Reel o Publicación pública.');
            }
            
            const shortcode = matches[1];
            // Consultamos mediante una API puente global de renderizado alternativo estático (Instatools Mirror)
            const proxyUrl = `https://www.instagram.com/p/${shortcode}/embed/captioned/`;
            
            const response = await axios.get(proxyUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Mobile Safari/537.36'
                }
            });

            const html = response.data;
            
            // Extraer el enlace del video directo codificado en el árbol del reproductor nativo embebido
            const videoMatch = html.match(/"video_url":"([^"]+)"/);
            const thumbMatch = html.match(/"display_url":"([^"]+)"/);
            
            if (!videoMatch) {
                // Alternativa secundaria si es un carrusel o imagen estática
                throw new Error('No se pudo localizar el flujo de video directo. Verifica que el Reel pertenezca a una cuenta pública.');
            }

            // Decodificar caracteres Unicode devueltos por el JSON interno de Meta (\u0025 -> %, \u0026 -> &)
            const rawVideoUrl = videoMatch[1].replace(/\\u0026/g, '&');
            const rawThumbUrl = thumbMatch ? thumbMatch[1].replace(/\\u0026/g, '&') : 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=500';

            return res.json({
                success: true,
                title: 'Video de Instagram',
                thumbnail: rawThumbUrl,
                platform: 'instagram',
                downloadUrl: rawVideoUrl
            });
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
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36',
                'Accept': '*/*'
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
