import React from 'react';
import type { VoicenterCall } from '../types';

interface Props {
  call: VoicenterCall;
}

function formatEpoch(epoch: number): string {
  const d = new Date(epoch * 1000);
  return d.toLocaleDateString('he-IL') + ' ' + d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'ANSWER': return 'bg-green-100 text-green-800';
    case 'ABANDONE': return 'bg-red-100 text-red-800';
    case 'NOANSWER': return 'bg-yellow-100 text-yellow-800';
    case 'BUSY': return 'bg-orange-100 text-orange-800';
    case 'CANCEL': return 'bg-gray-100 text-gray-800';
    default: return 'bg-slate-100 text-slate-800';
  }
}

function getDirectionLabel(call: VoicenterCall): string {
  const dir = call.direction || inferDirection(call.type);
  switch (dir) {
    case 'incoming': return 'נכנסת';
    case 'outgoing': return 'יוצאת';
    case 'internal': return 'פנימית';
    default: return call.type || 'לא ידוע';
  }
}

function inferDirection(type: string): string {
  if (!type) return '';
  const t = type.toLowerCase();
  if (t.includes('incoming') || t === 'queue') return 'incoming';
  if (t.includes('outgoing')) return 'outgoing';
  return '';
}

function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    'ANSWER': 'נענתה',
    'ABANDONE': 'ננטשה',
    'NOANSWER': 'לא נענתה',
    'BUSY': 'תפוס',
    'CANCEL': 'בוטלה',
    'VOEND': 'נותקה בנתב',
    'TE': 'הושמעה הקלטה',
    'VOICEMAIL': 'תא קולי',
    'NOTDIALED': 'לא חויגה',
    'CONGESTION': 'יעד לא מוכר',
  };
  return map[status] || status;
}

const MetadataRow: React.FC<{ label: string; value: string | number | undefined; show?: boolean }> = ({ label, value, show = true }) => {
  if (!show || !value) return null;
  return (
    <div className="flex justify-between items-center py-2 border-b border-slate-100 last:border-b-0">
      <span className="text-sm text-slate-500 font-medium">{label}</span>
      <span className="text-sm text-slate-800 font-semibold">{value}</span>
    </div>
  );
};

const CallMetadata: React.FC<Props> = ({ call }) => {
  return (
    <div className="space-y-4">
      {/* Main info card */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <h3 className="text-lg font-bold text-slate-800 mb-4">פרטי שיחה</h3>
        <div className="space-y-0">
          <MetadataRow label="כיוון" value={getDirectionLabel(call)} />
          <MetadataRow label="סוג שיחה" value={call.type} />
          <div className="flex justify-between items-center py-2 border-b border-slate-100">
            <span className="text-sm text-slate-500 font-medium">סטטוס</span>
            <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${getStatusColor(call.status)}`}>
              {getStatusLabel(call.status)}
            </span>
          </div>
          <MetadataRow label="מתקשר" value={call.caller} />
          <MetadataRow label="יעד" value={call.target} />
          <MetadataRow label="DID" value={call.did} show={!!call.did} />
          <MetadataRow label="זמן התחלה" value={formatEpoch(call.time)} />
          <MetadataRow label="משך שיחה" value={formatDuration(call.duration)} />
          <MetadataRow label="זמן צלצול" value={call.dialtime ? `${call.dialtime} שניות` : undefined} />
          <MetadataRow label="מזהה שיחה" value={call.ivruniqueid} />
        </div>
      </div>

      {/* Representative info */}
      {(call.representative_name || call.representative_code) && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h3 className="text-lg font-bold text-slate-800 mb-4">נציג</h3>
          <MetadataRow label="שם" value={call.representative_name} />
          <MetadataRow label="קוד" value={call.representative_code} />
          <MetadataRow label="שלוחה (יעד)" value={call.targetextension_name || call.targetextension} show={!!(call.targetextension_name || call.targetextension)} />
          <MetadataRow label="שלוחה (מתקשר)" value={call.callerextension_name || call.callerextension} show={!!(call.callerextension_name || call.callerextension)} />
        </div>
      )}

      {/* Queue info */}
      {(call.queuename || call.queueid > 0) && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h3 className="text-lg font-bold text-slate-800 mb-4">מעגל המתנה</h3>
          <MetadataRow label="שם מעגל" value={call.queuename} />
          <MetadataRow label="מזהה מעגל" value={call.queueid} />
          <MetadataRow label="זמן המתנה" value={call.seconds_waiting_in_queue ? `${call.seconds_waiting_in_queue} שניות` : undefined} />
        </div>
      )}

      {/* Country & Department */}
      {(call.caller_country || call.target_country || call.DepartmentName) && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h3 className="text-lg font-bold text-slate-800 mb-4">מידע נוסף</h3>
          <MetadataRow label="מדינת מתקשר" value={call.caller_country} show={!!call.caller_country} />
          <MetadataRow label="מדינת יעד" value={call.target_country} show={!!call.target_country} />
          <MetadataRow label="מחלקה" value={call.DepartmentName} show={!!call.DepartmentName} />
          <MetadataRow label="חשבון ראשי" value={call.TopDepartmentName} show={!!call.TopDepartmentName} />
          <MetadataRow label="מחיר (אגורות)" value={call.price} show={!!call.price} />
        </div>
      )}

      {/* IVR routing */}
      {call.IVR && call.IVR.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h3 className="text-lg font-bold text-slate-800 mb-4">נתיב נתב (IVR)</h3>
          <div className="space-y-2">
            {call.IVR.map((layer, i) => (
              <div key={i} className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg">
                <span className="w-6 h-6 rounded-full bg-cyan-100 text-cyan-700 text-xs flex items-center justify-center font-bold">
                  {layer.dtmf_order}
                </span>
                <span className="text-sm text-slate-700 font-medium">{layer.layer_name}</span>
                {layer.Dtmf > 0 && (
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                    לחיצה: {layer.Dtmf}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recording link */}
      {call.record && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <h3 className="text-lg font-bold text-slate-800 mb-4">הקלטה</h3>
          <audio controls className="w-full" src={call.record}>
            הדפדפן שלך לא תומך בנגן אודיו.
          </audio>
        </div>
      )}
    </div>
  );
};

export default CallMetadata;
