/**
 * Sensor Data Service - Generate and query time-series sensor readings
 */

import { query } from '../database/connection.js';

/**
 * Generate realistic mock sensor readings for a given sensor and time range
 */
function generateMockReadings(
  baselineValue: number,
  baselineStddev: number,
  from: Date,
  to: Date,
  intervalMinutes: number = 5
): Array<{ timestamp: string; value: number }> {
  const readings: Array<{ timestamp: string; value: number }> = [];
  const current = new Date(from);

  while (current <= to) {
    // Base sine wave for daily pattern
    const hoursElapsed = (current.getTime() - from.getTime()) / (1000 * 60 * 60);
    const dailyCycle = Math.sin((hoursElapsed / 24) * Math.PI * 2) * baselineStddev * 0.5;

    // Gaussian noise
    const noise = (Math.random() + Math.random() + Math.random() - 1.5) * baselineStddev;

    // Occasional spikes (2% chance)
    const spike = Math.random() < 0.02 ? (Math.random() > 0.5 ? 1 : -1) * baselineStddev * 3 : 0;

    const value = baselineValue + dailyCycle + noise + spike;

    readings.push({
      timestamp: current.toISOString(),
      value: Math.round(value * 100) / 100,
    });

    current.setMinutes(current.getMinutes() + intervalMinutes);
  }

  return readings;
}

export const sensorDataService = {
  /**
   * Get sensor readings for a time range
   * Falls back to generated mock data if no real readings exist
   */
  async getReadings(
    sensorId: string,
    from: string,
    to: string,
    interval: string = '5m'
  ) {
    // Try real data first
    const result = await query(
      `SELECT timestamp, value, quality
       FROM sensor_readings
       WHERE sensor_id = $1 AND timestamp BETWEEN $2 AND $3
       ORDER BY timestamp ASC`,
      [sensorId, from, to]
    );

    if (result.rows.length > 0) {
      return { data: result.rows, source: 'database' };
    }

    // Fall back to generated mock data
    const sensorResult = await query(
      'SELECT * FROM sensors WHERE id = $1',
      [sensorId]
    );

    if (sensorResult.rows.length === 0) {
      return { data: [], source: 'none' };
    }

    const sensor = sensorResult.rows[0];
    const baselineValue = Number(sensor.baseline_value) || 100;
    const baselineStddev = Number(sensor.baseline_stddev) || baselineValue * 0.05;

    const intervalMinutes = interval === '1m' ? 1
      : interval === '5m' ? 5
      : interval === '15m' ? 15
      : interval === '1h' ? 60
      : 5;

    const data = generateMockReadings(
      baselineValue,
      baselineStddev,
      new Date(from),
      new Date(to),
      intervalMinutes
    );

    return {
      data,
      source: 'generated',
      baseline: {
        mean: baselineValue,
        stddev: baselineStddev,
        upper: baselineValue + baselineStddev * 2,
        lower: baselineValue - baselineStddev * 2,
      },
    };
  },

  /**
   * Get latest reading for a sensor
   */
  async getLatestReading(sensorId: string) {
    const result = await query(
      `SELECT timestamp, value, quality
       FROM sensor_readings
       WHERE sensor_id = $1
       ORDER BY timestamp DESC LIMIT 1`,
      [sensorId]
    );
    return result.rows[0] || null;
  },
};
