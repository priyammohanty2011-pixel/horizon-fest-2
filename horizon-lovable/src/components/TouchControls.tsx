import React, { useRef } from 'react';
import { ControlInputs } from '../utils/physics';
import { ChevronLeft, ChevronRight, Flame } from 'lucide-react';

interface TouchControlsProps {
  onInputsChange: (updater: (prev: ControlInputs) => ControlInputs) => void;
}

export const TouchControls: React.FC<TouchControlsProps> = ({ onInputsChange }) => {
  const isTouchActiveRef = useRef<{ [key: string]: boolean }>({});

  const setInput = (key: keyof ControlInputs, value: number | boolean) => {
    onInputsChange((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleTouchStart = (e: React.TouchEvent, key: keyof ControlInputs, val: number | boolean, id: string) => {
    if (e.cancelable) e.preventDefault();
    isTouchActiveRef.current[id] = true;
    setInput(key, val);
  };

  const handleTouchEnd = (e: React.TouchEvent, key: keyof ControlInputs, defaultVal: number | boolean, id: string) => {
    if (e.cancelable) e.preventDefault();
    isTouchActiveRef.current[id] = false;
    setInput(key, defaultVal);
  };

  return (
    <div className="absolute inset-x-0 bottom-4 pointer-events-none flex justify-between items-end px-4 md:px-8 z-20 select-none">
      {/* Left Steering Controls */}
      <div className="pointer-events-auto flex gap-3">
        <button
          onTouchStart={(e) => handleTouchStart(e, 'steer', -1, 'left')}
          onTouchEnd={(e) => handleTouchEnd(e, 'steer', 0, 'left')}
          onMouseDown={() => setInput('steer', -1)}
          onMouseUp={() => setInput('steer', 0)}
          onMouseLeave={() => setInput('steer', 0)}
          className="w-16 h-16 rounded-2xl bg-slate-900/80 active:bg-slate-700/90 border border-slate-700/80 backdrop-blur-md flex items-center justify-center text-white shadow-xl touch-none transition-transform active:scale-95"
          aria-label="Steer Left"
        >
          <ChevronLeft className="w-8 h-8" />
        </button>

        <button
          onTouchStart={(e) => handleTouchStart(e, 'steer', 1, 'right')}
          onTouchEnd={(e) => handleTouchEnd(e, 'steer', 0, 'right')}
          onMouseDown={() => setInput('steer', 1)}
          onMouseUp={() => setInput('steer', 0)}
          onMouseLeave={() => setInput('steer', 0)}
          className="w-16 h-16 rounded-2xl bg-slate-900/80 active:bg-slate-700/90 border border-slate-700/80 backdrop-blur-md flex items-center justify-center text-white shadow-xl touch-none transition-transform active:scale-95"
          aria-label="Steer Right"
        >
          <ChevronRight className="w-8 h-8" />
        </button>
      </div>

      {/* Right Throttle, Brake & Handbrake */}
      <div className="pointer-events-auto flex items-end gap-3">
        {/* Handbrake / Drift Button */}
        <button
          onTouchStart={(e) => handleTouchStart(e, 'handbrake', true, 'hb')}
          onTouchEnd={(e) => handleTouchEnd(e, 'handbrake', false, 'hb')}
          onMouseDown={() => setInput('handbrake', true)}
          onMouseUp={() => setInput('handbrake', false)}
          onMouseLeave={() => setInput('handbrake', false)}
          className="w-14 h-14 rounded-2xl bg-amber-500/20 active:bg-amber-500/50 border border-amber-500/50 backdrop-blur-md flex flex-col items-center justify-center text-amber-400 shadow-xl touch-none transition-transform active:scale-95"
          aria-label="Drift Handbrake"
        >
          <Flame className="w-5 h-5" />
          <span className="text-[9px] font-bold tracking-tight font-mono">DRIFT</span>
        </button>

        {/* Brake / Reverse Button */}
        <button
          onTouchStart={(e) => handleTouchStart(e, 'brake', 1, 'brake')}
          onTouchEnd={(e) => handleTouchEnd(e, 'brake', 0, 'brake')}
          onMouseDown={() => setInput('brake', 1)}
          onMouseUp={() => setInput('brake', 0)}
          onMouseLeave={() => setInput('brake', 0)}
          className="w-16 h-16 rounded-2xl bg-rose-950/70 active:bg-rose-800/80 border border-rose-700/60 backdrop-blur-md flex flex-col items-center justify-center text-rose-300 shadow-xl touch-none transition-transform active:scale-95"
          aria-label="Brake or Reverse"
        >
          <span className="text-xs font-black tracking-wider">BRAKE</span>
          <span className="text-[9px] text-rose-400/80">REV</span>
        </button>

        {/* Gas / Accelerate Button */}
        <button
          onTouchStart={(e) => handleTouchStart(e, 'throttle', 1, 'gas')}
          onTouchEnd={(e) => handleTouchEnd(e, 'throttle', 0, 'gas')}
          onMouseDown={() => setInput('throttle', 1)}
          onMouseUp={() => setInput('throttle', 0)}
          onMouseLeave={() => setInput('throttle', 0)}
          className="w-20 h-20 rounded-2xl bg-emerald-600/80 active:bg-emerald-500/90 border border-emerald-400/60 backdrop-blur-md flex flex-col items-center justify-center text-white shadow-2xl touch-none transition-transform active:scale-95"
          aria-label="Accelerate"
        >
          <span className="text-sm font-black tracking-wider">GAS</span>
        </button>
      </div>
    </div>
  );
};
