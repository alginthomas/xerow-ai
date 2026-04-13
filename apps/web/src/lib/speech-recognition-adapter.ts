/**
 * Speech Recognition Adapter — OpenAI Whisper via backend
 * Records audio with MediaRecorder, sends to /api/transcribe,
 * returns transcript. Push-to-talk for noisy industrial environments.
 */

import { API_BASE } from './config';

interface SpeechRecognitionResult {
  transcript: string;
}

type Unsubscribe = () => void;

export interface SpeechRecognitionSession {
  status: { type: 'starting' | 'running' | 'ended'; reason?: string };
  stop: () => Promise<void>;
  cancel: () => void;
  onSpeechStart: (callback: () => void) => Unsubscribe;
  onSpeechEnd: (callback: (result: SpeechRecognitionResult) => void) => Unsubscribe;
  onSpeech: (callback: (result: SpeechRecognitionResult) => void) => Unsubscribe;
}

export interface SpeechRecognitionAdapter {
  listen: () => SpeechRecognitionSession;
}

/** Check if the browser supports audio recording */
export function isSpeechRecognitionSupported(): boolean {
  return !!(
    typeof window !== 'undefined' &&
    navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== 'undefined'
  );
}

function getToken() {
  return localStorage.getItem('auth_token');
}

/**
 * Creates a speech recognition adapter using MediaRecorder + OpenAI Whisper.
 * Records audio when listen() is called, transcribes on stop().
 */
export function createWhisperSpeechAdapter(): SpeechRecognitionAdapter {
  return {
    listen(): SpeechRecognitionSession {
      const speechStartCallbacks: Array<() => void> = [];
      const speechEndCallbacks: Array<(result: SpeechRecognitionResult) => void> = [];
      const speechCallbacks: Array<(result: SpeechRecognitionResult) => void> = [];

      let mediaRecorder: MediaRecorder | null = null;
      let audioChunks: Blob[] = [];
      let stopped = false;
      let stream: MediaStream | null = null;

      const session: SpeechRecognitionSession = {
        status: { type: 'starting' },

        async stop() {
          if (stopped) return;
          stopped = true;

          if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            // Wait for the recorder to finish and collect data
            await new Promise<void>((resolve) => {
              mediaRecorder!.onstop = async () => {
                // Stop all mic tracks
                stream?.getTracks().forEach((t) => t.stop());

                if (audioChunks.length === 0) {
                  session.status = { type: 'ended', reason: 'stopped' };
                  resolve();
                  return;
                }

                // Notify "processing" via interim callback
                speechCallbacks.forEach((cb) => cb({ transcript: 'Transcribing...' }));

                // Build audio blob and send to backend
                const mimeType = mediaRecorder!.mimeType || 'audio/webm';
                const audioBlob = new Blob(audioChunks, { type: mimeType });

                try {
                  const token = getToken();
                  const res = await fetch(`${API_BASE}/api/transcribe`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': mimeType,
                      ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    },
                    body: audioBlob,
                  });

                  if (!res.ok) {
                    const err = await res.json().catch(() => ({ error: 'Transcription failed' }));
                    console.error('[Whisper] Error:', err);
                    session.status = { type: 'ended', reason: 'error' };
                    speechCallbacks.forEach((cb) => cb({ transcript: '' }));
                    resolve();
                    return;
                  }

                  const { text } = await res.json();
                  session.status = { type: 'ended', reason: 'stopped' };

                  if (text) {
                    speechEndCallbacks.forEach((cb) => cb({ transcript: text }));
                  }
                } catch (err) {
                  console.error('[Whisper] Fetch error:', err);
                  session.status = { type: 'ended', reason: 'error' };
                  speechCallbacks.forEach((cb) => cb({ transcript: '' }));
                }

                resolve();
              };

              mediaRecorder!.stop();
            });
          } else {
            stream?.getTracks().forEach((t) => t.stop());
            session.status = { type: 'ended', reason: 'stopped' };
          }
        },

        cancel() {
          if (stopped) return;
          stopped = true;
          if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
          }
          stream?.getTracks().forEach((t) => t.stop());
          session.status = { type: 'ended', reason: 'cancelled' };
        },

        onSpeechStart(callback) {
          speechStartCallbacks.push(callback);
          return () => {
            const idx = speechStartCallbacks.indexOf(callback);
            if (idx >= 0) speechStartCallbacks.splice(idx, 1);
          };
        },

        onSpeechEnd(callback) {
          speechEndCallbacks.push(callback);
          return () => {
            const idx = speechEndCallbacks.indexOf(callback);
            if (idx >= 0) speechEndCallbacks.splice(idx, 1);
          };
        },

        onSpeech(callback) {
          speechCallbacks.push(callback);
          return () => {
            const idx = speechCallbacks.indexOf(callback);
            if (idx >= 0) speechCallbacks.splice(idx, 1);
          };
        },
      };

      // Request microphone access and start recording
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then((mediaStream) => {
          stream = mediaStream;
          audioChunks = [];

          // Prefer webm (Chrome/Edge) or mp4 (Safari)
          const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
            ? 'audio/webm;codecs=opus'
            : MediaRecorder.isTypeSupported('audio/mp4')
              ? 'audio/mp4'
              : '';

          mediaRecorder = mimeType
            ? new MediaRecorder(mediaStream, { mimeType })
            : new MediaRecorder(mediaStream);

          mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
              audioChunks.push(event.data);
            }
          };

          mediaRecorder.start(250); // collect chunks every 250ms
          session.status = { type: 'running' };
          speechStartCallbacks.forEach((cb) => cb());
        })
        .catch((err) => {
          console.error('[Whisper] Mic access denied:', err);
          session.status = { type: 'ended', reason: 'error' };
        });

      return session;
    },
  };
}
