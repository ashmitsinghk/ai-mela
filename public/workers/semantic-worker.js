import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';

env.allowLocalModels = false;
env.useBrowserCache = true;

let classifier = null;

self.onmessage = async (e) => {
  const { type, text1, text2 } = e.data;

  try {
    if (!classifier) {
      classifier = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
        progress_callback: (p) => self.postMessage({ type: 'progress', progress: p.progress })
      });
    }

    if (type === 'init') {
      self.postMessage({ type: 'ready' });
      return;
    }

    const output1 = await classifier(text1, { pooling: 'mean', normalize: true });
    const output2 = await classifier(text2, { pooling: 'mean', normalize: true });
    
    // Cosine similarity via dot product (since vectors are normalized)
    const similarity = output1.data.reduce((sum, val, i) => sum + val * output2.data[i], 0);
    self.postMessage({ type: 'result', similarity, text1, text2 });

  } catch (err) {
    self.postMessage({ type: 'error', error: err.message });
  }
};
