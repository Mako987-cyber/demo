export default async function handler(req, res) {
  const { layer } = req.query;

  const ALLOWED = new Set([
    'chokepoints', 'landing_points', 'airports', 'power_plants', 'submarine_cables',
  ]);

  if (!layer || !ALLOWED.has(layer)) {
    return res.status(400).json({ error: 'Invalid or missing layer parameter' });
  }

  const url  = process.env.STORAGE_SUPABASE_URL;
  const key  = process.env.STORAGE_SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return res.status(500).json({ error: 'Supabase env vars not configured' });
  }

  const limit = layer === 'submarine_cables' ? 300 : 1000;

  try {
    const upstream = await fetch(
      `${url}/rest/v1/${layer}?select=*&limit=${limit}`,
      {
        headers: {
          'apikey':          key,
          'Authorization':   `Bearer ${key}`,
          'Accept-Profile':  'monitoring',
          'Content-Type':    'application/json',
        },
      }
    );

    if (!upstream.ok) {
      const txt = await upstream.text();
      return res.status(502).json({ error: 'Supabase error', status: upstream.status, detail: txt });
    }

    const rows = await upstream.json();

    const features = rows.map(row => {
      const out = {};

      for (const [k, v] of Object.entries(row)) {
        // PostgREST commonly serializes `geometry` columns as GeoJSON objects
        // (not WKB hex) when the postgis extension is present.
        if (v && typeof v === 'object' && typeof v.type === 'string' && Array.isArray(v.coordinates)) {
          if (v.type === 'Point') {
            out.lat = v.coordinates[1];
            out.lon = v.coordinates[0];
          } else if (v.type === 'LineString') {
            out.coords = v.coordinates;
          } else if (v.type === 'MultiLineString') {
            out.segments = v.coordinates;
          }
          continue;
        }

        // Fallback: hex-encoded WKB string, even length, > 40 chars
        if (
          typeof v === 'string' &&
          v.length > 40 &&
          v.length % 2 === 0 &&
          /^[0-9a-fA-F]+$/.test(v.slice(0, 8))
        ) {
          const parsed = parseWKB(v);
          if (parsed) {
            if (parsed.type === 'point') {
              out.lat = parsed.lat;
              out.lon = parsed.lon;
            } else if (parsed.type === 'line') {
              out.coords = parsed.coords;
            } else if (parsed.type === 'multiline') {
              out.segments = parsed.segments;
            }
            continue;
          }
        }

        out[k] = v;
      }

      return out;
    });

    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=3600');
    return res.status(200).json(features);
  } catch (err) {
    return res.status(502).json({ error: 'Failed to fetch monitoring data', message: err.message });
  }
}

function parseWKB(hex) {
  try {
    const buf = Buffer.from(hex, 'hex');
    let offset = 0;

    const le = buf.readUInt8(offset++) === 1;
    const type = le ? buf.readUInt32LE(offset) : buf.readUInt32BE(offset);
    offset += 4;
    const baseType = type & 0xff;
    const hasSRID  = !!(type & 0x20000000);
    if (hasSRID) offset += 4;

    function readDouble() {
      const v = le ? buf.readDoubleLE(offset) : buf.readDoubleBE(offset);
      offset += 8;
      return v;
    }
    function readUInt32() {
      const v = le ? buf.readUInt32LE(offset) : buf.readUInt32BE(offset);
      offset += 4;
      return v;
    }

    if (baseType === 1) { // Point
      const lon = readDouble();
      const lat = readDouble();
      return { type: 'point', lat, lon };
    }

    if (baseType === 2) { // LineString
      const n = readUInt32();
      const coords = [];
      for (let i = 0; i < n; i++) coords.push([readDouble(), readDouble()]);
      const step = Math.ceil(coords.length / 200);
      return { type: 'line', coords: step > 1 ? coords.filter((_, i) => i % step === 0) : coords };
    }

    if (baseType === 5) { // MultiLineString
      const numLines = readUInt32();
      const all = [];
      for (let l = 0; l < numLines; l++) {
        offset += 5; // sub-geometry: 1 byte byteorder + 4 bytes type (no SRID in sub-geometries)
        const n = readUInt32();
        const seg = [];
        for (let i = 0; i < n; i++) seg.push([readDouble(), readDouble()]);
        const step = Math.ceil(seg.length / 150);
        all.push(step > 1 ? seg.filter((_, i) => i % step === 0) : seg);
      }
      return { type: 'multiline', segments: all };
    }

    return null;
  } catch {
    return null;
  }
}
