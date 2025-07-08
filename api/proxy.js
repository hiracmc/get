  async function fetchInstances() {
  try {
    const response = await fetch('https://hiracmc.github.io/pt/assets/inv.json');
    return await response.json();
  } catch (error) {
    console.error('インスタンスリストの取得に失敗しました:', error);
    return [];
  }
}

// 各インスタンスの応答時間をチェックする関数
async function checkInstanceSpeed(instance) {
  const startTime = Date.now();
  try {
    const response = await fetch(`https://${instance}/api/v1/videos/Jn8gHsEuULY`, { method: 'HEAD' });
    if (response.ok) {
      return { instance, time: Date.now() - startTime };
    }
  } catch (error) {
    // エラーの場合は無視
  }
  return { instance, time: Infinity };
}

// 最速のインスタンスを見つける関数
async function findFastestInstance() {
  const instances = await fetchInstances();
  const results = await Promise.all(instances.map(checkInstanceSpeed));
  const fastest = results.reduce((min, current) => (current.time < min.time ? current : min));
  return fastest.instance;
}


export default async function handler(req, res) {
let server = '';
findFastestInstance().then(fastestInstance => {
  server = fastestInstance;
  console.log('最速のインスタンス:', server);
}).catch(error => {
  console.error('エラーが発生しました:', error);
});
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
