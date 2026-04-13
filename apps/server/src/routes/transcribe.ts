/**
 * Transcription Route — OpenAI Whisper API
 * Accepts audio blob, returns transcript text.
 */

import express from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

/**
 * POST /api/transcribe
 * Body: raw audio (webm/wav) with Content-Type header
 * Returns: { text: string }
 */
router.post('/', authenticate, express.raw({ type: ['audio/*', 'application/octet-stream'], limit: '10mb' }), async (req: AuthRequest, res) => {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    const audioBuffer = req.body as Buffer;
    if (!audioBuffer || audioBuffer.length === 0) {
      return res.status(400).json({ error: 'No audio data received' });
    }

    // Build multipart form data for OpenAI Whisper API
    const boundary = '----WhisperBoundary' + Date.now();
    const contentType = req.headers['content-type'] || 'audio/webm';
    const ext = contentType.includes('wav') ? 'wav' : contentType.includes('mp4') ? 'mp4' : 'webm';

    const parts: Buffer[] = [];

    // File part
    parts.push(Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="audio.${ext}"\r\n` +
      `Content-Type: ${contentType}\r\n\r\n`
    ));
    parts.push(audioBuffer);
    parts.push(Buffer.from('\r\n'));

    // Model part
    parts.push(Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="model"\r\n\r\n` +
      `whisper-1\r\n`
    ));

    // Language hint (English — industrial operators)
    parts.push(Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="language"\r\n\r\n` +
      `en\r\n`
    ));

    // Closing boundary
    parts.push(Buffer.from(`--${boundary}--\r\n`));

    const body = Buffer.concat(parts);

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': String(body.length),
      },
      body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Transcribe] OpenAI error:', response.status, errorText);
      return res.status(502).json({ error: 'Transcription failed', details: errorText });
    }

    const result = await response.json() as { text: string };
    res.json({ text: result.text });
  } catch (err) {
    console.error('[Transcribe] Error:', err);
    res.status(500).json({ error: 'Transcription failed' });
  }
});

export { router as transcribeRoutes };
