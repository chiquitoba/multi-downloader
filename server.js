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
        
        // --- MOTOR DE INSTAGRAM PRO (COBALT OPEN-SOURCE API) ---
        if (url.includes('instagram.com')) {
            // Limpieza básica de la URL por si acaso
            const cleanUrl = url.split('?')[0];

            const response = await axios.post('https://api.cobalt.tools/api/json', {
                url: cleanUrl,
                videoQuality: '720', // Calidad óptima asegurada
                filenamePattern: 'classic'
            }, {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            });

            const data = response.data;

            // Cobalt devuelve "stream" si encuentra el enlace directo al video
            if (data && data.status === 'stream' && data.url) {
                return res.json({
                    success: true,
                    title: 'Video de Instagram',
                    thumbnail: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=500', // Miniatura genérica elegante
                    platform: 'instagram',
                    downloadUrl: data.url
                });
            } else if (data && data.status === 'picker' && data.picker && data.picker.length > 0) {
                // En caso de que sea un carrusel, toma el primer elemento válido
                return res.json({
                    success: true,
                    title: 'Video de Instagram',
                    thumbnail: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=500',
                    platform: 'instagram',
                    downloadUrl: data.picker[0].url
                });
            } else {
                throw new Error('No se pudo obtener el flujo de descarga. Intenta con otro Reel.');
            }
        }

        return res.status(400).json({ success: false, error: 'Plataforma no soportada.' });

    } catch (error) {
        // Capturar mensajes de error específicos devueltos por la API de Cobalt si existen
        const errorText = error.response && error.response.data && error.response.data.text 
            ? error.response.data.text 
            : error.message;
        return res.status(500).json({ success: false, error: errorText });
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
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/111.0.0.0 Safari/537.36'
            }
        });

        res.setHeader('Content-Disposition', `attachment; filename="${title}.mp4"`);
        res.setHeader('Content-Type', 'video/mp4');
        response.data.pipe(res);
    } catch (error) {
        res.status(500).send('Error al procesar la descarga del archivo binario.');
    }
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});
