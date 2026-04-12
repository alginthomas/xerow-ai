/**
 * Asset List Page - Filterable table of assets by type
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

const TYPE_LABELS: Record<string, string> = {
  turbine: 'Turbines',
  pipeline: 'Pipelines',
  well: 'Wells',
};

export function AssetListPage({ assetType }: { assetType: string }) {
  const navigate = useNavigate();
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const token = localStorage.getItem('auth_token');
    fetch(`${API_BASE}/api/v1/assets?type=${assetType}&limit=50`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((res) => setAssets(res.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [assetType]);

  const statusColor = (status: string) => {
    switch (status) {
      case 'operational': return 'bg-severity-green/20 text-severity-green border-severity-green/30';
      case 'degraded': return 'bg-severity-amber/20 text-severity-amber border-severity-amber/30';
      case 'offline': return 'bg-severity-red/20 text-severity-red border-severity-red/30';
      default: return '';
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">{TYPE_LABELS[assetType] || assetType}</h1>
        <p className="text-muted-foreground">{assets.length} assets monitored</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex h-40 items-center justify-center text-muted-foreground">Loading...</div>
          ) : assets.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-muted-foreground">
              No {TYPE_LABELS[assetType]?.toLowerCase() || 'assets'} found. Run the seed script to populate data.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">Sensors</TableHead>
                  <TableHead className="text-center">Open Tickets</TableHead>
                  <TableHead className="text-center">Recent Anomalies</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assets.map((asset) => (
                  <TableRow
                    key={asset.id}
                    className="cursor-pointer hover:bg-accent/50"
                    onClick={() => navigate(`/monitor/${asset.id}`)}
                  >
                    <TableCell className="font-medium">{asset.name}</TableCell>
                    <TableCell className="text-muted-foreground">{asset.region}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusColor(asset.status)}>
                        {asset.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">{asset.sensor_count || 0}</TableCell>
                    <TableCell className="text-center">
                      {(asset.open_ticket_count || 0) > 0 ? (
                        <span className="text-severity-red font-medium">{asset.open_ticket_count}</span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {(asset.recent_anomaly_count || 0) > 0 ? (
                        <span className="text-severity-amber font-medium">{asset.recent_anomaly_count}</span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
