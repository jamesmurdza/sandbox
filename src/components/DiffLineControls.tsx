import * as monaco from 'monaco-editor';
import React, { useEffect, useState } from 'react';
import { ChangeChunk } from '../types/ChangeChunk';

interface ButtonPosition {
  chunkId: string;
  top: number;
  type: 'addition' | 'deletion' | 'modification';
  changeCount: number;
}

interface DiffLineControlsProps {
  editor: monaco.editor.IStandaloneCodeEditor | null;
  decorations: monaco.editor.IModelDeltaDecoration[];
  changeChunks: ChangeChunk[];
  appliedChunks: Set<string>;
  lineToChunkMap: { [lineNumber: number]: string };
  onAcceptChunk: (chunkId: string) => void;
  onRejectChunk: (chunkId: string) => void;
}

const DiffLineControls: React.FC<DiffLineControlsProps> = ({
  editor,
  decorations,
  changeChunks,
  appliedChunks,
  lineToChunkMap,
  onAcceptChunk,
  onRejectChunk,
}) => {
  const [buttonPositions, setButtonPositions] = useState<ButtonPosition[]>([]);

  useEffect(() => {
    console.log("=== DiffLineControls Debug Info ===");
    console.log("changeChunks:", changeChunks);
    console.log("appliedChunks:", appliedChunks);
    console.log("lineToChunkMap:", lineToChunkMap);
    console.log("decorations count:", decorations.length);
    
    decorations.forEach((decoration, index) => {
      console.log(`Decoration ${index}:`, {
        range: decoration.range,
        options: decoration.options,
        chunkId: decoration.options.className?.includes('chunk-') ? 
          decoration.options.className.match(/chunk-\d+/)?.[0] : 'unknown'
      });
    });

    if (!editor || !decorations.length) return;

    // Group decorations by chunk
    const chunkGroups: { [chunkId: string]: monaco.editor.IModelDeltaDecoration[] } = {};
    
    decorations.forEach(decoration => {
      const className = decoration.options.className || '';
      const chunkMatch = className.match(/chunk-(\d+)/);
      if (chunkMatch) {
        const chunkId = `chunk-${chunkMatch[1]}`;
        if (!chunkGroups[chunkId]) {
          chunkGroups[chunkId] = [];
        }
        chunkGroups[chunkId].push(decoration);
      }
    });

    console.log("=== Chunk Groups ===");
    Object.entries(chunkGroups).forEach(([chunkId, decorations]) => {
      console.log(`${chunkId}:`, decorations.map(d => ({
        startLine: d.range.startLineNumber,
        endLine: d.range.endLineNumber,
        className: d.options.className
      })));
    });

    // Calculate button positions for each chunk
    const positions: ButtonPosition[] = [];
    
    Object.entries(chunkGroups).forEach(([chunkId, chunkDecorations]) => {
      const chunk = changeChunks.find(c => c.id === chunkId);
      if (!chunk || appliedChunks.has(chunkId)) return;

      // Find the middle line of this chunk's decorations
      const lines = chunkDecorations.map(d => d.range.startLineNumber);
      const minLine = Math.min(...lines);
      const maxLine = Math.max(...lines);
      const middleLine = Math.floor((minLine + maxLine) / 2);
      
      console.log(`=== Button Position for ${chunkId} ===`);
      console.log(`Lines: ${minLine}-${maxLine}, middle: ${middleLine}`);
      console.log(`Chunk type: ${chunk.type}, changes: ${chunk.changes.length}`);

      const lineHeight = editor.getOption(monaco.editor.EditorOption.lineHeight);
      const scrollTop = editor.getScrollTop();
      const lineTop = editor.getTopForLineNumber(middleLine);
      const containerRect = editor.getDomNode()?.getBoundingClientRect();
      
      if (containerRect) {
        const absoluteTop = lineTop - scrollTop + containerRect.top;
        const position: ButtonPosition = {
          chunkId,
          top: absoluteTop,
          type: chunk.type,
          changeCount: chunk.changes.length
        };
        
        console.log(`Position calculated:`, {
          chunkId,
          middleLine,
          lineHeight,
          scrollTop,
          lineTop,
          absoluteTop,
          containerRect: { top: containerRect.top, height: containerRect.height }
        });
        
        positions.push(position);
      }
    });

    console.log("=== Final Button Positions ===");
    positions.forEach(pos => {
      console.log(`${pos.chunkId}: top=${pos.top}px, type=${pos.type}, count=${pos.changeCount}`);
    });

    setButtonPositions(positions);
  }, [editor, decorations, changeChunks, appliedChunks, lineToChunkMap]);

  const handleAccept = (chunkId: string) => {
    console.log('Accepting chunk:', chunkId);
    onAcceptChunk(chunkId);
  };

  const handleReject = (chunkId: string) => {
    console.log('Rejecting chunk:', chunkId);
    onRejectChunk(chunkId);
  };

  return (
    <div className="diff-line-controls">
      {buttonPositions.map((position) => (
        <div
          key={position.chunkId}
          className="chunk-controls"
          style={{
            position: 'fixed',
            top: `${position.top}px`,
            right: '20px',
            zIndex: 1000,
            display: 'flex',
            gap: '4px',
            backgroundColor: 'white',
            border: '1px solid #ccc',
            borderRadius: '4px',
            padding: '2px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          }}
        >
          <button
            onClick={() => handleAccept(position.chunkId)}
            className="accept-btn"
            style={{
              background: '#22c55e',
              color: 'white',
              border: 'none',
              padding: '4px 8px',
              borderRadius: '2px',
              fontSize: '12px',
              cursor: 'pointer',
            }}
            title={`Accept ${position.type === 'addition' ? '+' : position.type === 'deletion' ? '-' : '~'}${position.changeCount}`}
          >
            ✓
          </button>
          <button
            onClick={() => handleReject(position.chunkId)}
            className="reject-btn"
            style={{
              background: '#ef4444',
              color: 'white',
              border: 'none',
              padding: '4px 8px',
              borderRadius: '2px',
              fontSize: '12px',
              cursor: 'pointer',
            }}
            title={`Reject ${position.type === 'addition' ? '+' : position.type === 'deletion' ? '-' : '~'}${position.changeCount}`}
          >
            ✗
          </button>
          <span
            style={{
              padding: '4px 6px',
              fontSize: '10px',
              color: '#666',
              lineHeight: '1',
            }}
          >
            {position.type === 'addition' ? '+' : position.type === 'deletion' ? '-' : '~'}{position.changeCount}
          </span>
        </div>
      ))}
    </div>
  );
};

export default DiffLineControls; 