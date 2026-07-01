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
        
        // --- MOTOR DE INSTAGRAM CON LIMPIEZA DE URLS (MÉTODO ULTRA-ESTABLE) ---
        if (url.includes('instagram.com')) {
            // Extraer estrictamente el identificador base (ejemplo: reel/DYrseYbjkNK/) para eliminar el rastro de ?utm_source=...
            const matches = url.match(/(?:reel|p|tv)\/([A-Za-z0-9_-]+)/);
            if (!matches) {
                throw new Error('La URL no tiene un formato válido de Reel o Publicación de Instagram.');
            }
            
            // Construimos la URL perfectamente limpia que exige la API externa
            const cleanUrl = `https://www.instagram.com/reel/${matches[1]}/`;

            const response = await axios.post('https://www.tikwm.com/api/', new URLSearchParams({ url: cleanUrl }));
            const data = response.data;

            if (data && data.code === 0 && data.data) {
                return res.json({
                    success: true,
                    title: data.data.title || 'Video de Instagram',
                    thumbnail: data.data.cover.startsWith('http') ? data.data.cover : 'https://www.tikwm.com' + data.data.cover,
                    platform: 'instagram',
                    downloadUrl: data.data.play || (data.data.images && data.data.images[0])
                });
            } else {
                throw new Error(data.msg || 'No se pudo extraer el Reel. Asegúrate de que sea un enlace válido.');
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
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36'
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
