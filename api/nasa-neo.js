export default async function handler(req, res) {
  const { start_date, end_date } = req.query;

  if (!start_date || !end_date) {
    return res.status(400).json({ error: 'start_date e end_date sono obbligatori' });
  }

  const params = new URLSearchParams({
    start_date,
    end_date,
    api_key: process.env.NASA_API_KEY
  });

  const upstream = await fetch(
    `https://api.nasa.gov/neo/rest/v1/feed?${params}`
  );

  const data = await upstream.json();
  res.status(upstream.status).json(data);
}
