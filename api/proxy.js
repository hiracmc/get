// Vercel Serverless Functionとして動作させるためのデフォルトエクスポート
export default async function handler(req, res) {
  // --- CORSヘッダーの設定 ---
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // --- ユーティリティ関数 ---
  async function getInvidiousInstances() {
    try {
      const response = await fetch('https://hiracmc.github.io/pt/assets/inv.json');
      if (!response.ok) throw new Error(`Failed to fetch instance list: ${response.statusText}`);
      const instances = await response.json();
      if (!Array.isArray(instances)) throw new Error('Fetched data is not an array of instances.');
      return instances;
    } catch (error) {
      console.error("Error in getInvidiousInstances:", error);
      return [];
    }
  }

  async function findFastestInstance(instances) {
    const checkPromises = instances.map(instanceUrl => {
      return new Promise(async (resolve) => {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000);
          const startTime = Date.now();
          const response = await fetch(`${instanceUrl}/api/v1/stats`, { signal: controller.signal });
          clearTimeout(timeoutId);
          if (response.ok) {
            const duration = Date.now() - startTime;
            resolve({ url: instanceUrl, duration, status: 'fulfilled' });
          } else {
            resolve({ url: instanceUrl, status: 'rejected', reason: 'Not OK' });
          }
        } catch (error) {
          resolve({ url: instanceUrl, status: 'rejected', reason: error.name });
        }
      });
    });

    const results = await Promise.all(checkPromises);
    const successfulInstances = results
      .filter(result => result.status === 'fulfilled')
      .sort((a, b) => a.duration - b.duration);

    if (successfulInstances.length > 0) {
      console.log(`Fastest instance: ${successfulInstances[0].url} (${successfulInstances[0].duration}ms)`);
      return successfulInstances[0].url;
    }
    return null;
  }

  // --- メインロジック ---
  try {
    const { type, id } = req.query;
    if (!type || !id) return res.status(400).json({ error: 'Missing required query parameters: "type" and "id"' });

    const instances = await getInvidiousInstances();
    if (instances.length === 0) return res.status(503).json({ error: 'Could not retrieve Invidious instance list.' });

    const fastestInstance = await findFastestInstance(instances);
    if (!fastestInstance) return res.status(503).json({ error: 'No available Invidious instances found.' });

    let apiUrl;
    const encodedId = encodeURIComponent(id);
    switch (type) {
      case 'video': apiUrl = `${fastestInstance}/api/v1/videos/${encodedId}`; break;
      case 'search': apiUrl = `${fastestInstance}/api/v1/search/?q=${encodedId}`; break;
      case 'comment': apiUrl = `${fastestInstance}/api/v1/comments/${encodedId}`; break;
      case 'channel': apiUrl = `${fastestInstance}/api/v1/channels/${encodedId}`; break;
      default: return res.status(400).json({ error: 'Invalid "type" parameter.' });
    }

    console.log(`Forwarding request to: ${apiUrl}`);
    const apiResponse = await fetch(apiUrl);

    if (!apiResponse.ok) {
        const errorData = await apiResponse.json().catch(() => ({ error: 'API returned non-JSON error' }));
        return res.status(apiResponse.status).json(errorData);
    }
    
    const data = await apiResponse.json();
    return res.status(200).json(data);

  } catch (error) {
    console.error('An unexpected error occurred:', error);
    return res.status(500).json({ error: 'An internal server error occurred.' });
  }
}
