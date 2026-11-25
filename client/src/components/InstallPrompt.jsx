import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useInstall } from '../lib/pwa';
import Icon from './Icon';

/** Invites the customer to keep Snack Shack on their home screen. Renders nothing once installed or dismissed. */
export default function InstallPrompt({ className = '' }) {
  const { mode, install, dismiss } = useInstall();
  const [showSteps, setShowSteps] = useState(false);

  return (
    <AnimatePresence>
      {mode && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className={`overflow-hidden ${className}`}
        >
          <div className="flex items-start gap-4 rounded-xl border border-line bg-surface p-4">
            <img src="/icons/icon-192.png" alt="" className="h-12 w-12 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Add Snack Shack to your home screen</p>
              {mode === 'ios' && showSteps ? (
                <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-sm text-ink/75">
                  <li>
                    Tap the Share button <Icon name="share" size={14} className="inline align-[-2px]" /> in Safari.
                  </li>
                  <li>Choose Add to Home Screen.</li>
                </ol>
              ) : (
                <p className="mt-0.5 text-sm text-ink/65">Order in two taps next time. No app store needed.</p>
              )}
              <div className="mt-3 flex gap-2">
                {mode === 'prompt' && (
                  <button onClick={install} className="btn btn-dark min-h-10 px-4 text-sm">
                    Add to home screen
                  </button>
                )}
                {mode === 'ios' && !showSteps && (
                  <button onClick={() => setShowSteps(true)} className="btn btn-dark min-h-10 px-4 text-sm">
                    Show me how
                  </button>
                )}
                <button onClick={dismiss} className="btn btn-quiet min-h-10 text-sm text-ink/65">
                  Not now
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
