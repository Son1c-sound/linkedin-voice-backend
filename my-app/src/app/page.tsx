"use client"
import React, { useState, useRef } from 'react';

interface SpeechToTextResponse {
  success: boolean;
  transcriptionId?: string;
  text?: string;
  error?: string;
}

interface OptimizeTextResponse {
  success: boolean;
  optimizedText?: string;
  error?: string;
}

interface EditTextResponse {
  success: boolean;
  error?: string;
}

export default function TestClient() {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [transcriptionId, setTranscriptionId] = useState<string>('');
  const [originalText, setOriginalText] = useState<string>('');
  const [optimizedText, setOptimizedText] = useState<string>('');
  const [editedText, setEditedText] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder.current = new MediaRecorder(stream);
      audioChunks.current = [];

      mediaRecorder.current.ondataavailable = (event) => {
        audioChunks.current.push(event.data);
      };

      mediaRecorder.current.onstop = async () => {
        const audioBlob = new Blob(audioChunks.current, { type: 'audio/wav' });
        await handleSpeechToText(audioBlob);
      };

      mediaRecorder.current.start();
      setIsRecording(true);
      setStatus('Recording...');
    } catch (err: any) {
      setError('Error accessing microphone');
      console.error("Microphone access error:", err.message || err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && isRecording) {
      mediaRecorder.current.stop();
      setIsRecording(false);
      setStatus('Processing audio...');
    }
  };

  const handleSpeechToText = async (audioBlob: Blob) => {
    try {
      const formData = new FormData();
      formData.append('audioData', audioBlob);
      
      const response = await fetch('https://linkedin-voice-backend.vercel.app/api/speech-to-text', {
        method: 'POST',
        body: formData,
        // Add these headers for better error handling
        headers: {
          'Accept': 'application/json',
        },
      });
  
      // Check if response is ok before parsing JSON
      if (!response.ok) {
        const errorText = await response.text(); // Try to get error text
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }
  
      const data: SpeechToTextResponse = await response.json();
      if (data.success) {
        setTranscriptionId(data.transcriptionId || '');
        setOriginalText(data.text || '');
        setStatus('Transcription complete');
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (err: any) {
      // More detailed error logging
      const errorMessage = err.message || 'Unknown error occurred';
      setError(`Error converting speech to text: ${errorMessage}`);
      setStatus('');
      console.error("Speech-to-text error:", {
        message: errorMessage,
        error: err,
        stack: err.stack
      });
    }
  };

  const handleOptimize = async () => {
    try {
      setStatus('Optimizing text...');
      const response = await fetch('https://linkedin-voice-backend.vercel.app/api/optimizeSpeech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcriptionId }),
      });

      const data: OptimizeTextResponse = await response.json();
      if (data.success) {
        setOptimizedText(data.optimizedText || '');
        setEditedText(data.optimizedText || '');
        setStatus('Optimization complete');
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (err: any) {
      setError('Error optimizing text');
      setStatus('');
      console.error("Text optimization error:", err.message || err);
      console.error("Error details:", err);
    }
  };

  const handlePatch = async () => {
    try {
      setStatus('Saving changes...');
      const response = await fetch('https://linkedin-voice-backend.vercel.app/api/editText', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcriptionId,
          updatedText: editedText,
        }),
      });

      const data: EditTextResponse = await response.json();
      if (data.success) {
        setStatus('Changes saved successfully');
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (err: any) {
      setError('Error saving changes');
      setStatus('');
      console.error("Save changes error:", err.message || err);
      console.error("Error details:", err);
    }
  };

  return (
    <div>
      <h1>Speech to LinkedIn Post Converter Test</h1>
      
      {error && <p style={{color: 'red'}}>{error}</p>}
      <p>{status}</p>
      
      <button onClick={isRecording ? stopRecording : startRecording}>
        {isRecording ? 'Stop Recording' : 'Start Recording'}
      </button>

      {originalText && (
        <div>
          <h2>Original Transcription</h2>
          <p>{originalText}</p>
          <button onClick={handleOptimize} disabled={!transcriptionId}>
            Optimize for LinkedIn
          </button>
        </div>
      )}

      {optimizedText && (
        <div>
          <h2>Optimized Post</h2>
          <textarea
            value={editedText}
            onChange={(e) => setEditedText(e.target.value)}
            style={{width: '100%', minHeight: '100px'}}
          />
          <button onClick={handlePatch} disabled={!editedText}>
            Save Changes
          </button>
        </div>
      )}
    </div>
  );
};
