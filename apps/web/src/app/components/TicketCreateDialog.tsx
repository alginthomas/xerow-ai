/**
 * TicketCreateDialog — Modal form for manual ticket creation
 */

import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from './ui/select';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

interface TicketCreateDialogProps {
  assetId: string;
  assetName: string;
  anomalyId?: string;
  defaultDescription?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function TicketCreateDialog({
  assetId, assetName, anomalyId, defaultDescription, open, onOpenChange, onCreated,
}: TicketCreateDialogProps) {
  const [title, setTitle] = useState('');
  const [severity, setSeverity] = useState('amber');
  const [description, setDescription] = useState(defaultDescription || '');
  const [loading, setLoading] = useState(false);

  // Pre-fill description when prop changes (e.g. from drag-select)
  useEffect(() => {
    if (defaultDescription) setDescription(defaultDescription);
  }, [defaultDescription]);

  const handleSubmit = async () => {
    if (!title.trim()) { toast.error('Title is required'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/tickets`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify({
          asset_id: assetId,
          title: title.trim(),
          severity,
          description: description.trim() || undefined,
          anomaly_id: anomalyId || undefined,
        }),
      });
      if (!res.ok) throw new Error('Failed to create ticket');
      toast.success('Ticket created successfully');
      setTitle(''); setDescription(''); setSeverity('amber');
      onOpenChange(false);
      onCreated();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create ticket');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Ticket</DialogTitle>
          <DialogDescription>
            Create a manual ticket for {assetName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              placeholder="Describe the issue..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="severity">Severity</Label>
            <Select value={severity} onValueChange={setSeverity}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="amber">Amber — Moderate</SelectItem>
                <SelectItem value="red">Red — Urgent</SelectItem>
                <SelectItem value="purple">Purple — Unclassified</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="desc">Description</Label>
            <Textarea
              id="desc"
              placeholder="Additional details..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={loading || !title.trim()}>
            {loading ? 'Creating...' : 'Create Ticket'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
