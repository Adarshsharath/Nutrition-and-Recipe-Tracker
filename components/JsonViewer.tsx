'use client';
import { useState } from 'react';

export default function JsonViewer({ data, maxHeight = 400 }: { data: unknown; maxHeight?: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-gray-900 rounded-lg overflow-hidden text-xs">
      <div className="flex items-center justify-between px-3 py-2 bg-gray-800">
        <span className="text-gray-400 font-mono text-xs">JSON</span>
        <button onClick={() => setExpanded(!expanded)} className="text-gray-400 hover:text-white text-xs">
          {expanded ? 'Collapse' : 'Expand'}
        </button>
      </div>
      <pre
        className="text-green-300 p-4 overflow-auto font-mono text-xs"
        style={{ maxHeight: expanded ? undefined : maxHeight }}>
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}

