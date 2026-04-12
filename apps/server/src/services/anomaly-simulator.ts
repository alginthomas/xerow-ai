/**
 * Anomaly Simulator - Background service that generates realistic anomalies
 * Runs periodically to simulate agent detection for demo/testing
 */

import { query } from '../database/connection.js';
import { anomalyService } from './anomaly.service.js';

interface SensorInfo {
  id: string;
  asset_id: string;
  name: string;
  type: string;
  unit: string;
  baseline_value: number;
  baseline_stddev: number;
  hard_threshold_max: number | null;
}

async function getAllSensors(): Promise<SensorInfo[]> {
  const result = await query(
    `SELECT s.*, a.status as asset_status
     FROM sensors s
     JOIN assets a ON a.id = s.asset_id
     WHERE s.status = 'active' AND a.status != 'offline'`
  );
  return result.rows;
}

function generateAnomaly(sensor: SensorInfo) {
  const baseline = sensor.baseline_value || 100;
  const stddev = sensor.baseline_stddev || baseline * 0.05;

  // Weighted random severity: 60% green, 25% amber, 10% red, 5% purple
  const roll = Math.random();
  let targetDeviation: number;
  let rateOfChange: number;
  let confidenceScore: number;
  let historicalMatches: number;

  if (roll < 0.60) {
    // Green: small deviation
    targetDeviation = Math.random() * 4.5;
    rateOfChange = 0.5 + Math.random();
    confidenceScore = 80 + Math.floor(Math.random() * 20);
    historicalMatches = 5 + Math.floor(Math.random() * 10);
  } else if (roll < 0.85) {
    // Amber: moderate deviation
    targetDeviation = 5 + Math.random() * 10;
    rateOfChange = 2 + Math.random() * 2;
    confidenceScore = 65 + Math.floor(Math.random() * 25);
    historicalMatches = 2 + Math.floor(Math.random() * 5);
  } else if (roll < 0.95) {
    // Red: significant deviation
    targetDeviation = 15 + Math.random() * 15;
    rateOfChange = 5 + Math.random() * 3;
    confidenceScore = 70 + Math.floor(Math.random() * 25);
    historicalMatches = 1 + Math.floor(Math.random() * 3);
  } else {
    // Purple: unclassifiable
    targetDeviation = Math.random() * 20;
    rateOfChange = 1 + Math.random() * 4;
    confidenceScore = 20 + Math.floor(Math.random() * 35);
    historicalMatches = 0;
  }

  const currentValue = baseline * (1 + targetDeviation / 100 * (Math.random() > 0.5 ? 1 : -1));

  return {
    asset_id: sensor.asset_id,
    sensor_id: sensor.id,
    deviation_pct: targetDeviation,
    rate_of_change: rateOfChange,
    confidence_score: confidenceScore,
    historical_matches: historicalMatches,
    maintenance_window: false,
    data_snapshot: {
      current_value: Math.round(currentValue * 100) / 100,
      baseline_value: baseline,
      deviation_pct: Math.round(targetDeviation * 10) / 10,
      rate_of_change: Math.round(rateOfChange * 10) / 10,
      sensor_name: sensor.name,
      sensor_unit: sensor.unit,
      sensor_type: sensor.type,
    },
  };
}

let intervalHandle: NodeJS.Timeout | null = null;

export const anomalySimulator = {
  /**
   * Start the simulator with a given interval
   */
  start(intervalMs: number = 3 * 60 * 1000) {
    if (intervalHandle) return;

    console.log(`[Simulator] Starting anomaly simulator (interval: ${intervalMs / 1000}s)`);

    const run = async () => {
      try {
        const sensors = await getAllSensors();
        if (sensors.length === 0) return;

        // Pick 1-3 random sensors to generate anomalies for
        const count = 1 + Math.floor(Math.random() * 2);
        const shuffled = sensors.sort(() => Math.random() - 0.5).slice(0, count);

        for (const sensor of shuffled) {
          const anomalyData = generateAnomaly(sensor);
          const result = await anomalyService.create(anomalyData, 'analytics_agent');
          if (result) {
            console.log(`[Simulator] Generated ${result.severity} anomaly for ${sensor.name}`);
          }
        }
      } catch (error) {
        console.error('[Simulator] Error generating anomaly:', error);
      }
    };

    // Run once immediately, then on interval
    run();
    intervalHandle = setInterval(run, intervalMs);
  },

  stop() {
    if (intervalHandle) {
      clearInterval(intervalHandle);
      intervalHandle = null;
      console.log('[Simulator] Anomaly simulator stopped');
    }
  },
};
