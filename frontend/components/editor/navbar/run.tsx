"use client";

import { Play, StopCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTerminal } from "@/context/TerminalContext";
import { closeTerminal } from "@/lib/terminal";

export default function RunButtonModal({
  isRunning,
  setIsRunning,
}: {
  isRunning: boolean;
  setIsRunning: (running: boolean) => void;
}) {
  const { createNewTerminal, terminals, setTerminals, socket, setActiveTerminalId } = useTerminal();

  const handleRun = () => {
    if (isRunning) {
      console.log('Stopping sandbox...');
      console.log('Closing Terminal');
      console.log('Closing Preview Window');

      // Close all terminals if needed
      terminals.forEach(term => {
        if (term.terminal) {
          // Assuming you have a closeTerminal function similar to createTerminal
          closeTerminal({
            term,
            terminals,
            setTerminals,
            setActiveTerminalId,
            setClosingTerminal: () => { },
            socket: socket!,
            activeTerminalId: term.id,
          });
        }
      });
    } else {
      console.log('Running sandbox...');
      console.log('Opening Terminal');
      console.log('Opening Preview Window');

      if (terminals.length < 4) {
        createNewTerminal();
      } else {
        console.error('Maximum number of terminals reached.');
      }
    }
    setIsRunning(!isRunning);
  };

  return (
    <>
      <Button variant="outline" onClick={handleRun}>
        {isRunning ? <StopCircle className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
        {isRunning ? 'Stop' : 'Run'}
      </Button>
    </>
  );
}
