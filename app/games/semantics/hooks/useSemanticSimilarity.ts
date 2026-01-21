'use client';

import { useEffect, useRef, useState } from 'react';

export interface SemanticSimilarityHook {
  isReady: boolean;
  isLoading: boolean;
  progress: number;
  error: string | null;
  calculateSimilarity: (text1: string, text2: string) => Promise<number>;
}

export function useSemanticSimilarity(): SemanticSimilarityHook {
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    try {
      const worker = new Worker('/workers/semantic-worker.js', { type: 'module' });
      
      worker.onmessage = (e) => {
        if (!e.data) return;

        if (e.data.type === 'ready') {
          setIsReady(true);
          setIsLoading(false);
        } else if (e.data.type === 'progress') {
          setProgress(e.data.progress);
        } else if (e.data.type === 'error') {
          setError(e.data.error);
          setIsLoading(false);
        }
      };

      worker.onerror = () => {
        setError('Worker initialization failed');
        setIsLoading(false);
      };

      workerRef.current = worker;
      worker.postMessage({ type: 'init' });
    } catch (err) {
      setError('Failed to create worker');
      setIsLoading(false);
    }

    return () => workerRef.current?.terminate();
  }, []);

  const calculateSimilarity = async (text1: string, text2: string): Promise<number> => {
    if (!workerRef.current || !isReady) {
      throw new Error('Worker not ready');
    }

    return new Promise((resolve, reject) => {
      const worker = workerRef.current!;
      const t1 = text1, t2 = text2;
      
      const handler = (e: MessageEvent) => {
        if (!e.data) return;

        if (e.data.type === 'result' && e.data.text1 === t1 && e.data.text2 === t2) {
          worker.removeEventListener('message', handler);
          resolve(e.data.similarity);
        } else if (e.data.type === 'error') {
          worker.removeEventListener('message', handler);
          reject(new Error(e.data.error));
        }
      };

      worker.addEventListener('message', handler);
      worker.postMessage({ type: 'calculate', text1, text2 });
    });
  };

  return { isReady, isLoading, progress, error, calculateSimilarity };
}
