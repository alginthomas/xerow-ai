/**
 * Seed Script - Populate database with representative industrial data
 * Run: npx tsx src/database/seed.ts
 */

import dotenv from 'dotenv';
dotenv.config();

import { query, getClient } from './connection.js';
import bcrypt from 'bcryptjs';

const REGIONS = ['Region A - North Sea', 'Region B - Gulf Coast'];

const ASSETS = [
  { name: 'Turbine T-01', type: 'turbine', region: REGIONS[0], location: { lat: 57.48, lng: 1.75, facility: 'Platform Alpha' }, thresholds: { vibration_max: 12.5, exhaust_temp_max: 650 } },
  { name: 'Turbine T-02', type: 'turbine', region: REGIONS[0], location: { lat: 57.50, lng: 1.78, facility: 'Platform Alpha' }, thresholds: { vibration_max: 12.5, exhaust_temp_max: 650 } },
  { name: 'Turbine T-03', type: 'turbine', region: REGIONS[1], location: { lat: 28.95, lng: -89.40, facility: 'Platform Bravo' }, thresholds: { vibration_max: 12.5, exhaust_temp_max: 650 } },
  { name: 'Pipeline P-01', type: 'pipeline', region: REGIONS[0], location: { lat: 57.45, lng: 1.70, facility: 'Subsea Link Alpha-1' }, thresholds: { pressure_min: 0.5, pressure_max: 85, h2s_max: 10 } },
  { name: 'Pipeline P-02', type: 'pipeline', region: REGIONS[1], location: { lat: 28.90, lng: -89.35, facility: 'Export Line Bravo' }, thresholds: { pressure_min: 0.5, pressure_max: 90, h2s_max: 10 } },
  { name: 'Pipeline P-03', type: 'pipeline', region: REGIONS[1], location: { lat: 28.88, lng: -89.32, facility: 'Transfer Line Bravo-2' }, thresholds: { pressure_min: 0.5, pressure_max: 88, h2s_max: 10 } },
  { name: 'Well W-01', type: 'well', region: REGIONS[0], location: { lat: 57.52, lng: 1.80, facility: 'Wellhead Complex Alpha' }, thresholds: { wellhead_pressure_max: 4500 } },
  { name: 'Well W-02', type: 'well', region: REGIONS[1], location: { lat: 28.92, lng: -89.38, facility: 'Wellhead Complex Bravo' }, thresholds: { wellhead_pressure_max: 5000 } },
];

interface SensorDef {
  name: string;
  type: string;
  unit: string;
  baseline_value: number;
  baseline_stddev: number;
  hard_threshold_max?: number;
  hard_threshold_min?: number;
  assetIndex: number;
}

const SENSORS: SensorDef[] = [
  // Turbine T-01
  { name: 'T01-VIB', type: 'vibration', unit: 'mm/s', baseline_value: 4.2, baseline_stddev: 0.8, hard_threshold_max: 12.5, assetIndex: 0 },
  { name: 'T01-EXT', type: 'exhaust_temp', unit: '°C', baseline_value: 520, baseline_stddev: 25, hard_threshold_max: 650, assetIndex: 0 },
  { name: 'T01-RPM', type: 'rpm', unit: 'RPM', baseline_value: 3600, baseline_stddev: 50, assetIndex: 0 },
  // Turbine T-02
  { name: 'T02-VIB', type: 'vibration', unit: 'mm/s', baseline_value: 3.8, baseline_stddev: 0.7, hard_threshold_max: 12.5, assetIndex: 1 },
  { name: 'T02-EXT', type: 'exhaust_temp', unit: '°C', baseline_value: 510, baseline_stddev: 20, hard_threshold_max: 650, assetIndex: 1 },
  { name: 'T02-RPM', type: 'rpm', unit: 'RPM', baseline_value: 3600, baseline_stddev: 45, assetIndex: 1 },
  // Turbine T-03
  { name: 'T03-VIB', type: 'vibration', unit: 'mm/s', baseline_value: 4.5, baseline_stddev: 0.9, hard_threshold_max: 12.5, assetIndex: 2 },
  { name: 'T03-EXT', type: 'exhaust_temp', unit: '°C', baseline_value: 530, baseline_stddev: 22, hard_threshold_max: 650, assetIndex: 2 },
  // Pipeline P-01
  { name: 'P01-PRS', type: 'pressure', unit: 'bar', baseline_value: 72, baseline_stddev: 3, hard_threshold_max: 85, hard_threshold_min: 0.5, assetIndex: 3 },
  { name: 'P01-H2S', type: 'h2s', unit: 'ppm', baseline_value: 2.1, baseline_stddev: 0.5, hard_threshold_max: 10, assetIndex: 3 },
  { name: 'P01-FLW', type: 'flow_rate', unit: 'm³/h', baseline_value: 450, baseline_stddev: 30, assetIndex: 3 },
  // Pipeline P-02
  { name: 'P02-PRS', type: 'pressure', unit: 'bar', baseline_value: 78, baseline_stddev: 4, hard_threshold_max: 90, hard_threshold_min: 0.5, assetIndex: 4 },
  { name: 'P02-H2S', type: 'h2s', unit: 'ppm', baseline_value: 1.8, baseline_stddev: 0.4, hard_threshold_max: 10, assetIndex: 4 },
  // Pipeline P-03
  { name: 'P03-PRS', type: 'pressure', unit: 'bar', baseline_value: 75, baseline_stddev: 3.5, hard_threshold_max: 88, hard_threshold_min: 0.5, assetIndex: 5 },
  { name: 'P03-FLW', type: 'flow_rate', unit: 'm³/h', baseline_value: 380, baseline_stddev: 25, assetIndex: 5 },
  // Well W-01
  { name: 'W01-WHP', type: 'wellhead_pressure', unit: 'psi', baseline_value: 3200, baseline_stddev: 150, hard_threshold_max: 4500, assetIndex: 6 },
  { name: 'W01-TMP', type: 'temperature', unit: '°C', baseline_value: 85, baseline_stddev: 5, assetIndex: 6 },
  { name: 'W01-FLW', type: 'flow_rate', unit: 'bbl/d', baseline_value: 1200, baseline_stddev: 80, assetIndex: 6 },
  // Well W-02
  { name: 'W02-WHP', type: 'wellhead_pressure', unit: 'psi', baseline_value: 3500, baseline_stddev: 180, hard_threshold_max: 5000, assetIndex: 7 },
  { name: 'W02-TMP', type: 'temperature', unit: '°C', baseline_value: 92, baseline_stddev: 6, assetIndex: 7 },
  { name: 'W02-FLW', type: 'flow_rate', unit: 'bbl/d', baseline_value: 1500, baseline_stddev: 100, assetIndex: 7 },
];

const USERS = [
  { email: 'tom@xerow.ai', name: 'Tom Henderson', role: 'customer', persona: 'tom' },
  { email: 'dick@xerow.ai', name: 'Dick Morrison', role: 'customer', persona: 'dick' },
  { email: 'harry@xerow.ai', name: 'Harry Chen', role: 'admin', persona: 'harry' },
];

async function seed() {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    // Clean existing seed data to avoid duplicates
    console.log('Cleaning existing data...');
    await client.query('DELETE FROM sensor_readings');
    await client.query('DELETE FROM audit_log');
    await client.query('UPDATE anomalies SET ticket_id = NULL');
    await client.query('DELETE FROM tickets');
    await client.query('DELETE FROM anomalies');
    await client.query('DELETE FROM agent_instances');
    await client.query('DELETE FROM sensors');
    await client.query('DELETE FROM assets');

    console.log('Seeding users...');
    const userIds: Record<string, string> = {};
    for (const user of USERS) {
      const existing = await client.query('SELECT id FROM users WHERE email = $1', [user.email]);
      if (existing.rows.length > 0) {
        // Update persona if not set
        await client.query('UPDATE users SET persona = $1 WHERE email = $2', [user.persona, user.email]);
        userIds[user.persona] = existing.rows[0].id;
        console.log(`  Updated ${user.email} (existing)`);
      } else {
        const hash = await bcrypt.hash('password123', 10);
        const result = await client.query(
          `INSERT INTO users (email, password_hash, name, role, persona) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [user.email, hash, user.name, user.role, user.persona]
        );
        userIds[user.persona] = result.rows[0].id;
        console.log(`  Created ${user.email}`);
      }
    }

    console.log('Seeding assets...');
    const assetIds: string[] = [];
    for (const asset of ASSETS) {
      const result = await client.query(
        `INSERT INTO assets (name, type, region, location, thresholds)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [asset.name, asset.type, asset.region, JSON.stringify(asset.location), JSON.stringify(asset.thresholds)]
      );
      assetIds.push(result.rows[0].id);
      console.log(`  Created ${asset.name}`);
    }

    console.log('Seeding sensors...');
    const sensorIds: string[] = [];
    for (const sensor of SENSORS) {
      const result = await client.query(
        `INSERT INTO sensors (asset_id, name, type, unit, baseline_value, baseline_stddev, hard_threshold_max, hard_threshold_min)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [
          assetIds[sensor.assetIndex],
          sensor.name,
          sensor.type,
          sensor.unit,
          sensor.baseline_value,
          sensor.baseline_stddev,
          sensor.hard_threshold_max || null,
          sensor.hard_threshold_min || null,
        ]
      );
      sensorIds.push(result.rows[0].id);
      console.log(`  Created ${sensor.name}`);
    }

    console.log('Seeding agent instances...');
    const agentTypes = ['analytics', 'anomaly', 'verification'] as const;
    for (const assetId of assetIds) {
      for (const agentType of agentTypes) {
        await client.query(
          `INSERT INTO agent_instances (asset_id, agent_type, status, last_assessment, confidence_score)
           VALUES ($1, $2, 'active', NOW() - INTERVAL '5 minutes', $3)
           ON CONFLICT (asset_id, agent_type) DO NOTHING`,
          [assetId, agentType, 85 + Math.floor(Math.random() * 15)]
        );
      }
    }
    console.log(`  Created ${assetIds.length * 3} agent instances`);

    console.log('Seeding sample anomalies...');
    const severities = ['green', 'green', 'green', 'green', 'amber', 'amber', 'red', 'purple'] as const;
    const colourCodes: Record<string, string> = { green: '#22c55e', amber: '#f59e0b', red: '#ef4444', purple: '#a855f7' };

    for (let i = 0; i < 50; i++) {
      const sensorIdx = Math.floor(Math.random() * sensorIds.length);
      const sensor = SENSORS[sensorIdx];
      const severity = severities[Math.floor(Math.random() * severities.length)];
      const deviation = severity === 'green' ? Math.random() * 5
        : severity === 'amber' ? 5 + Math.random() * 10
        : severity === 'red' ? 15 + Math.random() * 15
        : Math.random() * 20;

      const hoursAgo = Math.floor(Math.random() * 168); // Last 7 days

      await client.query(
        `INSERT INTO anomalies (asset_id, sensor_id, detected_at, severity, colour_code, deviation_pct, confidence_score, data_snapshot, status)
         VALUES ($1, $2, NOW() - INTERVAL '${hoursAgo} hours', $3, $4, $5, $6, $7, $8)`,
        [
          assetIds[sensor.assetIndex],
          sensorIds[sensorIdx],
          severity,
          colourCodes[severity],
          Math.round(deviation * 10) / 10,
          severity === 'purple' ? 30 + Math.floor(Math.random() * 30) : 60 + Math.floor(Math.random() * 40),
          JSON.stringify({
            current_value: sensor.baseline_value * (1 + deviation / 100),
            baseline_value: sensor.baseline_value,
            deviation_pct: deviation,
            sensor_name: sensor.name,
            sensor_unit: sensor.unit,
          }),
          severity === 'green' ? 'logged' : 'ticket_open',
        ]
      );
    }
    console.log('  Created 50 sample anomalies');

    console.log('Seeding sample tickets...');
    // Get amber+ anomalies that don't have tickets yet
    const anomalyResult = await client.query(
      `SELECT anomaly_id, asset_id, severity, deviation_pct, confidence_score
       FROM anomalies
       WHERE severity != 'green' AND ticket_id IS NULL
       ORDER BY detected_at DESC
       LIMIT 10`
    );

    for (const anomaly of anomalyResult.rows) {
      const assignPersona = anomaly.severity === 'purple' ? 'harry' : 'tom';
      const slaMs = anomaly.severity === 'amber' ? 2 * 3600000 : anomaly.severity === 'red' ? 1800000 : 600000;
      const slaDeadline = new Date(Date.now() + slaMs - Math.random() * slaMs * 1.5);

      const ticketResult = await client.query(
        `INSERT INTO tickets (anomaly_id, asset_id, severity, title, description, assigned_to, sla_deadline, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING ticket_id`,
        [
          anomaly.anomaly_id,
          anomaly.asset_id,
          anomaly.severity,
          `${anomaly.severity.toUpperCase()} anomaly: ${anomaly.deviation_pct}% deviation`,
          `Automated ticket. Confidence: ${anomaly.confidence_score}%.`,
          userIds[assignPersona],
          slaDeadline.toISOString(),
          Math.random() > 0.5 ? 'open' : 'acknowledged',
        ]
      );

      await client.query(
        `UPDATE anomalies SET ticket_id = $1 WHERE anomaly_id = $2`,
        [ticketResult.rows[0].ticket_id, anomaly.anomaly_id]
      );

      await client.query(
        `INSERT INTO audit_log (entity_type, entity_id, actor, action, note)
         VALUES ('ticket', $1, 'seed_script', 'created', 'Seeded ticket for testing')`,
        [ticketResult.rows[0].ticket_id]
      );
    }
    console.log(`  Created ${anomalyResult.rows.length} sample tickets`);

    console.log('Seeding sensor readings (24h of data per sensor)...');
    let readingCount = 0;
    const now = new Date();
    for (let sIdx = 0; sIdx < sensorIds.length; sIdx++) {
      const sensor = SENSORS[sIdx];
      const baseVal = sensor.baseline_value;
      const stddev = sensor.baseline_stddev;
      const values: string[] = [];

      for (let m = 0; m < 288; m++) { // 288 × 5min = 24 hours
        const t = new Date(now.getTime() - (287 - m) * 5 * 60 * 1000);
        const hoursElapsed = (t.getTime() - (now.getTime() - 24 * 60 * 60 * 1000)) / (1000 * 60 * 60);
        const dailyCycle = Math.sin((hoursElapsed / 24) * Math.PI * 2) * stddev * 0.5;
        const noise = (Math.random() + Math.random() + Math.random() - 1.5) * stddev;
        const spike = Math.random() < 0.02 ? (Math.random() > 0.5 ? 1 : -1) * stddev * 3 : 0;
        const val = Math.round((baseVal + dailyCycle + noise + spike) * 100) / 100;
        values.push(`('${sensorIds[sIdx]}', '${t.toISOString()}', ${val})`);
      }

      // Batch insert
      await client.query(
        `INSERT INTO sensor_readings (sensor_id, timestamp, value) VALUES ${values.join(',')}`
      );
      readingCount += values.length;
    }
    console.log(`  Created ${readingCount} sensor readings`);

    await client.query('COMMIT');
    console.log('\nSeed complete!');
    console.log('\nTest accounts:');
    console.log('  Tom (Field Operator): tom@xerow.ai / password123');
    console.log('  Dick (Field Manager): dick@xerow.ai / password123');
    console.log('  Harry (Chief Operator): harry@xerow.ai / password123');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', error);
    throw error;
  } finally {
    client.release();
    process.exit(0);
  }
}

seed();
