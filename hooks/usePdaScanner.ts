'use client';

import { useEffect, useRef, useCallback } from 'react';

interface UsePdaScannerOptions {
  onScan: (barcode: string) => void;
  onError?: (error: string) => void;
  minBarcodeLength?: number;
  maxKeystrokeIntervalMs?: number;
  enabled?: boolean;
  playSound?: boolean;
}

/**
 * Web Audio API Sound Synthesizer (100% Zero-cost & Local)
 */
export function playScannerAudio(type: 'success' | 'error') {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    if (type === 'success') {
      // High pitch double beep (1760Hz -> 2000Hz)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1760, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } else {
      // Low error buzz (220Hz)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    }
  } catch (e) {
    // Ignore audio context autoplay restriction if user hasn't interacted yet
  }
}

/**
 * Global PDA Scanner Keystroke Listener (Keyboard Wedge / Laser mode)
 *
 * Detects rapid sequence of keystrokes (< 45ms per character) followed by Enter.
 */
export function usePdaScanner({
  onScan,
  onError,
  minBarcodeLength = 3,
  maxKeystrokeIntervalMs = 50,
  enabled = true,
  playSound = true,
}: UsePdaScannerOptions) {
  const bufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      // Ignore modifiers
      if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(e.key)) {
        return;
      }

      const now = Date.now();
      const interval = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      // Check for scan terminator (Enter key)
      if (e.key === 'Enter') {
        if (bufferRef.current.length >= minBarcodeLength) {
          const barcode = bufferRef.current.trim();
          bufferRef.current = '';

          if (playSound) playScannerAudio('success');
          onScan(barcode);
        } else {
          bufferRef.current = '';
        }
        return;
      }

      // If interval between characters is too long, reset buffer (user is typing manually on keyboard)
      // Exception: first character has no prior interval
      if (bufferRef.current.length > 0 && interval > maxKeystrokeIntervalMs) {
        // Reset if typed slowly
        bufferRef.current = e.key.length === 1 ? e.key : '';
      } else {
        if (e.key.length === 1) {
          bufferRef.current += e.key;
        }
      }
    },
    [enabled, maxKeystrokeIntervalMs, minBarcodeLength, onScan, playSound]
  );

  useEffect(() => {
    if (!enabled) return;
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, handleKeyDown]);

  return {
    playBeep: () => playScannerAudio('success'),
    playError: () => playScannerAudio('error'),
  };
}
