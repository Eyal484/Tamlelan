import fs from 'fs';
import path from 'path';
import type { VoicenterCall, CallListItem } from './types.js';

function toCallListItem(call: VoicenterCall): CallListItem {
  const analysis = call.geminiAnalysis;
  return {
    ivruniqueid: call.ivruniqueid,
    time: call.time,
    caller: call.caller || '',
    target: call.target || '',
    direction: call.direction || inferDirection(call.type),
    type: call.type || '',
    status: call.status || '',
    duration: call.duration || 0,
    did: call.did || '',
    representative_name: call.representative_name || '',
    queuename: call.queuename || '',
    hasAI: !!(call.aiData && (call.aiData.transcript || call.aiData.insights)),
    hasSummary: !!(call.aiData?.insights?.summary),
    hasAnalysis: !!analysis,
    // New fields
    starred: call.starred ?? false,
    detectedTags: analysis?.tags?.filter(t => t.detected).map(t => t.id) ?? [],
    objectionType: analysis?.objectionType,
    summary: analysis?.summary?.slice(0, 120),
    crmNote: analysis?.crmNote?.slice(0, 80),
  };
}

function inferDirection(type: string): string {
  if (!type) return '';
  const t = type.toLowerCase();
  if (t.includes('incoming') || t === 'queue') return 'incoming';
  if (t.includes('outgoing')) return 'outgoing';
  if (t.includes('internal')) return 'internal';
  return '';
}

export class JsonFileStorage {
  private dataDir: string;
  private index: CallListItem[] = [];

  constructor(dataDir: string) {
    this.dataDir = dataDir;
  }

  async initialize(): Promise<void> {
    fs.mkdirSync(this.dataDir, { recursive: true });
    await this.rebuildIndex();
    console.log(`[Storage] Initialized with ${this.index.length} calls in ${this.dataDir}`);
  }

  async saveCall(call: VoicenterCall): Promise<CallListItem> {
    const id = call.ivruniqueid;
    if (!id) throw new Error('Missing ivruniqueid');

    const filePath = path.join(this.dataDir, `${id}.json`);
    const data = JSON.stringify(call, null, 2);

    // Write atomically
    const tmpPath = filePath + '.tmp';
    fs.writeFileSync(tmpPath, data, 'utf-8');
    fs.renameSync(tmpPath, filePath);

    // Update index
    const listItem = toCallListItem(call);
    const existingIdx = this.index.findIndex(c => c.ivruniqueid === id);
    if (existingIdx >= 0) {
      this.index[existingIdx] = listItem;
    } else {
      this.index.push(listItem);
      this.index.sort((a, b) => b.time - a.time);
    }

    return listItem;
  }

  async getCall(id: string): Promise<VoicenterCall | null> {
    const filePath = path.join(this.dataDir, `${id}.json`);
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw) as VoicenterCall;
    } catch {
      return null;
    }
  }

  // F7: Toggle star
  async starCall(id: string, starred: boolean): Promise<CallListItem | null> {
    const call = await this.getCall(id);
    if (!call) return null;
    call.starred = starred;
    return this.saveCall(call);
  }

  async listCalls(opts: {
    page?: number;
    limit?: number;
    search?: string;
    direction?: string;
    status?: string;
    starred?: boolean;         // F7
    tags?: string[];           // F2
  } = {}): Promise<{ calls: CallListItem[]; total: number; page: number; pageSize: number }> {
    const page = Math.max(1, opts.page || 1);
    const limit = Math.min(100, Math.max(1, opts.limit || 50));

    let filtered = this.index;

    // Filter by direction
    if (opts.direction && opts.direction !== 'all') {
      filtered = filtered.filter(c => c.direction === opts.direction);
    }

    // Filter by status
    if (opts.status) {
      filtered = filtered.filter(c => c.status === opts.status);
    }

    // F7: Filter starred
    if (opts.starred === true) {
      filtered = filtered.filter(c => c.starred);
    }

    // F2: Filter by detected tags
    if (opts.tags && opts.tags.length > 0) {
      filtered = filtered.filter(c =>
        opts.tags!.some(tag => (c.detectedTags ?? []).includes(tag))
      );
    }

    // Search: caller, target, rep, queue, did, type, ivruniqueid, summary, crmNote
    if (opts.search) {
      const q = opts.search.toLowerCase();
      filtered = filtered.filter(c =>
        c.caller.toLowerCase().includes(q) ||
        c.target.toLowerCase().includes(q) ||
        c.representative_name.toLowerCase().includes(q) ||
        c.queuename.toLowerCase().includes(q) ||
        c.did.toLowerCase().includes(q) ||
        c.type.toLowerCase().includes(q) ||
        c.ivruniqueid.toLowerCase().includes(q) ||
        (c.summary || '').toLowerCase().includes(q) ||
        (c.crmNote || '').toLowerCase().includes(q)
      );
    }

    const total = filtered.length;
    const start = (page - 1) * limit;
    const calls = filtered.slice(start, start + limit);

    return { calls, total, page, pageSize: limit };
  }

  async deleteCall(id: string): Promise<boolean> {
    const filePath = path.join(this.dataDir, `${id}.json`);
    try {
      fs.unlinkSync(filePath);
    } catch {
      return false;
    }
    this.index = this.index.filter(c => c.ivruniqueid !== id);
    return true;
  }

  // For F6: full-text transcript search — returns all calls in index
  getAllIndexed(): CallListItem[] {
    return this.index;
  }

  private async rebuildIndex(): Promise<void> {
    this.index = [];

    let files: string[];
    try {
      files = fs.readdirSync(this.dataDir).filter(f => f.endsWith('.json'));
    } catch {
      files = [];
    }

    for (const file of files) {
      try {
        const filePath = path.join(this.dataDir, file);
        const raw = fs.readFileSync(filePath, 'utf-8');
        const call = JSON.parse(raw) as VoicenterCall;
        if (call.ivruniqueid) {
          this.index.push(toCallListItem(call));
        }
      } catch (err) {
        console.warn(`[Storage] Skipping corrupt file: ${file}`, err);
      }
    }

    this.index.sort((a, b) => b.time - a.time);
  }
}
