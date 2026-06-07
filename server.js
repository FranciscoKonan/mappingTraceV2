// ===========================================
// MAPPINGTRACE BACKEND - COMPLETE FIXED VERSION
// ===========================================

require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cron = require('node-cron');
const wellknown = require('wellknown');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');

const app = express();

app.use(cors({
    origin: [
        'http://localhost:5500',
        'http://127.0.0.1:5500',
        'https://franciscokonan.github.io',
        'https://*.onrender.com',
        'https://*.vercel.app'
    ],
    credentials: true
}));
app.use(express.json());

// Environment variables
const {
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY,
    KOBO_TOKEN,
    ASSET_UID,
    PORT: ENV_PORT
} = process.env;

console.log('📋 Environment check:');
console.log(`   SUPABASE_URL: ${SUPABASE_URL ? '✅' : '❌'}`);
console.log(`   SUPABASE_SERVICE_KEY: ${SUPABASE_SERVICE_KEY ? '✅' : '❌'}`);
console.log(`   KOBO_TOKEN: ${KOBO_TOKEN ? '✅' : '❌'}`);
console.log(`   ASSET_UID: ${ASSET_UID ? '✅' : '❌'}`);

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const KOBO_API_BASE = 'https://kf.kobotoolbox.org/api/v2';

// Track last sync time to avoid duplicate processing
let lastSyncTime = null;
let isSyncing = false;

// ===========================================
// KOBO V2 API FUNCTIONS
// ===========================================

function koboPolygonToGeoJSON(polygonString) {
    if (!polygonString) return null;
    try {
        const coords = polygonString.split(';').map(pt => {
            const parts = pt.trim().split(/\s+/);
            const lat = parseFloat(parts[0]);
            const lon = parseFloat(parts[1]);
            return [lon, lat];
        });
        if (coords.length > 0) {
            const first = coords[0];
            const last = coords[coords.length - 1];
            if (first[0] !== last[0] || first[1] !== last[1]) coords.push(first);
        }
        return { type: 'Polygon', coordinates: [coords] };
    } catch (err) {
        console.error('Polygon parse error:', err.message);
        return null;
    }
}

async function fetchKoboSubmissions(since = null) {
    try {
        console.log('📡 Fetching from Kobo v2 API...');
        
        let params = { limit: 1000 };
        
        // If we have a last sync time, only fetch newer records
        if (since) {
            params.query = JSON.stringify({ "_submission_time": { "$gt": since } });
            console.log(`   Fetching records since: ${since}`);
        }
        
        const response = await axios.get(
            `${KOBO_API_BASE}/assets/${ASSET_UID}/data/`,
            {
                headers: {
                    'Authorization': `Token ${KOBO_TOKEN}`,
                    'Accept': 'application/json'
                },
                params: params
            }
        );
        return response.data.results || [];
    } catch (error) {
        console.error('❌ Kobo v2 API error:', error.response?.data || error.message);
        return [];
    }
}

async function submissionExists(koboId) {
    try {
        const { data, error } = await supabase
            .from('farms')
            .select('id')
            .eq('kobo_submission_id', koboId.toString())
            .maybeSingle();

        if (error) {
            console.error('Error checking existence:', error.message);
            return false;
        }
        return data !== null;
    } catch (err) {
        console.error('Error in submissionExists:', err.message);
        return false;
    }
}

async function syncKobo(manual = false) {
    // Prevent concurrent syncs
    if (isSyncing) {
        console.log('⚠️ Sync already in progress, skipping...');
        return { status: 'skipped', message: 'Sync already in progress' };
    }
    
    isSyncing = true;
    const startTime = Date.now();
    console.log(`🔄 Starting Kobo sync at: ${new Date().toISOString()} (${manual ? 'manual' : 'auto'})`);

    try {
        // Only fetch new records since last sync
        const fetchSince = manual ? null : lastSyncTime;
        const records = await fetchKoboSubmissions(fetchSince);
        console.log(`📊 Fetched ${records.length} records from Kobo`);

        let newCount = 0;
        let duplicateCount = 0;
        let errorCount = 0;

        for (const record of records) {
            const koboId = record._id.toString();
            const uuid = record._uuid || record._id;

            // Check for duplicate
            const exists = await submissionExists(koboId);
            if (exists) {
                console.log(`⚠️ Skipping duplicate: ${koboId}`);
                duplicateCount++;
                continue;
            }

            // Process new record
            const polygonString = record.Polygon || record.polygon;
            const geojson = koboPolygonToGeoJSON(polygonString);
            
            // Get submission time for tracking
            const submissionTime = record._submission_time || record.submission_time || new Date().toISOString();

            // FIXED: Only use fields that exist in the new table
            const farmData = {
                kobo_submission_id: koboId,
                submission_data: record,  // Stores the ENTIRE Kobo record
                synced_at: new Date().toISOString()
            };

            // Add geometry if it exists (from polygon or direct geometry)
            if (geojson) {
                farmData.geometry = geojson;
            } else if (record.geometry) {
                farmData.geometry = record.geometry;
            }

            try {
                const { error } = await supabase
                    .from('farms')
                    .insert([farmData]);

                if (error) {
                    console.error('❌ Insert error:', error.message);
                    errorCount++;
                } else {
                    // FIXED: Removed farmer_name reference since it doesn't exist
                    console.log(`✅ Inserted record: ${koboId}`);
                    newCount++;
                    
                    // Update last sync time to the most recent submission
                    if (!lastSyncTime || new Date(submissionTime) > new Date(lastSyncTime)) {
                        lastSyncTime = submissionTime;
                    }
                }
            } catch (err) {
                console.error('❌ Error inserting record:', err.message);
                errorCount++;
            }
        }

        // If no new records but we have records, update lastSyncTime from the latest record
        if (records.length > 0 && !lastSyncTime) {
            const latestRecord = records.reduce((latest, current) => {
                const currentTime = current._submission_time || current.submission_time;
                const latestTime = latest._submission_time || latest.submission_time;
                return new Date(currentTime) > new Date(latestTime) ? current : latest;
            }, records[0]);
            lastSyncTime = latestRecord._submission_time || latestRecord.submission_time;
        }

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`✅ Sync completed in ${duration}s: ${newCount} new, ${duplicateCount} duplicates, ${errorCount} failed`);
        console.log(`📅 Last sync time: ${lastSyncTime || 'never'}`);

        return { newCount, duplicateCount, errorCount, duration, lastSyncTime };

    } catch (err) {
        console.error('❌ Sync failed:', err.message);
        return { status: 'error', message: err.message };
    } finally {
        isSyncing = false;
    }
}

// ===========================================
// API ENDPOINTS
// ===========================================

app.get('/api/test', (req, res) => {
    res.json({
        status: 'ok',
        message: 'Backend is running',
        version: '2.0.0',
        timestamp: new Date().toISOString()
    });
});

app.get('/api/status', async (req, res) => {
    try {
        const { count, error } = await supabase
            .from('farms')
            .select('*', { count: 'exact', head: true });

        if (error) throw error;

        res.json({
            status: 'online',
            farmsCount: count || 0,
            lastSyncTime: lastSyncTime,
            isSyncing: isSyncing,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Status error:', error.message);
        res.json({ status: 'online', farmsCount: 0, error: error.message });
    }
});

app.get('/api/polygons', async (req, res) => {
    console.log('🗺️ /api/polygons called');

    try {
        const { data, error } = await supabase
            .from('farms')
            .select('id, kobo_submission_id, submission_data, geometry, synced_at');

        if (error) throw error;

        const features = (data || [])
            .filter(row => row.geometry)
            .map(row => {
                // Extract data from submission_data JSONB
                const record = row.submission_data || {};
                return {
                    type: "Feature",
                    geometry: row.geometry,
                    properties: {
                        id: row.id,
                        farm_id: record.farm_id || record._uuid,
                        farmer_name: record.Farmer_Name || record.farmer_name || 'Unknown',
                        farmer_id: record.Farmer_ID || record.farmer_id,
                        cooperative_name: record.Cooperative_Name || record.cooperative_name,
                        area: parseFloat(record.Area || record.area || 0),
                        status: (record.Status || record.status || 'pending').toLowerCase(),
                        submission_date: record.Submission_Date || record.submission_date || row.synced_at
                    }
                };
            });

        res.json({
            type: "FeatureCollection",
            features: features
        });
    } catch (error) {
        console.error('Polygons error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/alerts', async (req, res) => {
    res.json([]);
});

app.get('/sync-kobo', async (req, res) => {
    console.log('🔄 Manual sync triggered');
    
    try {
        const result = await syncKobo(true);
        res.json({
            status: 'success',
            message: 'Sync completed',
            stats: result,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Sync endpoint error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Sync failed',
            error: error.message
        });
    }
});

app.get('/', (req, res) => {
    res.json({
        name: 'MappingTrace API',
        version: '2.0.0',
        status: 'running',
        endpoints: ['GET /', 'GET /api/test', 'GET /api/status', 'GET /api/polygons', 'GET /sync-kobo']
    });
});

app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

app.use((err, req, res, next) => {
    console.error('❌ Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// ===========================================
// SCHEDULED SYNC - FIXED
// ===========================================

// Run every 30 minutes - with proper error logging
cron.schedule('*/30 * * * *', async () => {
    console.log('⏰ Cron job triggered at:', new Date().toISOString());
    try {
        await syncKobo(false);
    } catch (error) {
        console.error('❌ Cron sync failed:', error);
    }
});

// Run initial sync on startup
setTimeout(async () => {
    console.log('🚀 Running initial sync on startup...');
    await syncKobo(false);
}, 5000);

// ===========================================
// START SERVER
// ===========================================

const PORT = ENV_PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Server running on port ${PORT}`);
    console.log(`📍 API URL: http://localhost:${PORT}/`);
    console.log(`📍 Sync endpoint: http://localhost:${PORT}/sync-kobo`);
    console.log(`\n✅ Kobo v2 API integration active`);
    console.log(`✅ Deduplication enabled`);
    console.log(`✅ Auto-sync every 30 minutes (cron job active)`);
    console.log(`✅ Last sync time tracking enabled\n`);
});
