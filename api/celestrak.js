export default async function handler(req, res) {
  const { GROUP } = req.query;

  const ALLOWED = new Set([
    'stations', 'active', 'visual', 'analyst',
    'weather', 'resource', 'sar', 'sarsat', 'dmc', 'tdrss', 'argos', 'planet', 'spire',
    'geo', 'intelsat', 'ses', 'eutelsat', 'telesat',
    'starlink', 'oneweb', 'qianfan', 'hulianwang', 'kuiper',
    'iridium-NEXT', 'orbcomm', 'globalstar', 'amateur', 'satnogs', 'x-comm', 'other-comm',
    'gnss', 'gps-ops', 'glo-ops', 'galileo', 'beidou', 'sbas',
    'science', 'geodetic', 'engineering', 'education',
    'military', 'radar', 'cubesat',
    'last-30-days',
    'fengyun-1c-debris', 'iridium-33-debris', 'cosmos-2251-debris',
  ]);

  if (!GROUP || !ALLOWED.has(GROUP)) {
    return res.status(400).json({ error: 'Invalid or missing GROUP parameter' });
  }

  try {
    const url = `https://celestrak.org/NORAD/elements/gp.php?GROUP=${encodeURIComponent(GROUP)}&FORMAT=json`;
    const upstream = await fetch(url, { headers: { Accept: 'application/json' } });

    if (!upstream.ok) {
      return res.status(502).json({ error: 'CelesTrak upstream error', status: upstream.status });
    }

    const data = await upstream.json();

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json(data);
  } catch (err) {
    return res.status(502).json({ error: 'Failed to fetch CelesTrak data', message: err.message });
  }
}
