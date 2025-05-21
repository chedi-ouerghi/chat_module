// components/IncomingCallModal.tsx

import { Icons } from "./icons";

interface IncomingCallModalProps {
  call: {
    id: string;
    type: 'AUDIO' | 'VIDEO';
    caller: {
      firstName: string;
    };
  };
  onAccept: () => void;
  onReject: () => void;
}

export function IncomingCallModal({ call, onAccept, onReject }: IncomingCallModalProps) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 transition-opacity duration-300">
      <div className="bg-white/10 border border-white/20 p-8 rounded-3xl shadow-xl max-w-md w-full text-center backdrop-blur-md">
        <div className="bg-gradient-to-br from-green-400 to-green-600 p-4 w-16 h-16 rounded-full mx-auto mb-6 shadow-lg animate-pulse">
          <Icons.phone className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2 tracking-wide">
          Appel {call.type === 'VIDEO' ? 'vidéo' : 'audio'} entrant
        </h2>
        <p className="text-gray-300 mb-6 text-lg">
          {call.caller.firstName} vous appelle...
        </p>
        <div className="flex justify-center gap-6">
          <button
            onClick={onAccept}
            className="flex items-center px-5 py-3 bg-green-500 hover:bg-green-600 text-white rounded-full shadow-md transition-all duration-300"
          >
            <Icons.phone className="mr-2 h-5 w-5" />
            Accepter
          </button>
          <button
            onClick={onReject}
            className="flex items-center px-5 py-3 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-md transition-all duration-300"
          >
            <Icons.phoneOff className="mr-2 h-5 w-5" />
            Rejeter
          </button>
        </div>
      </div>
    </div>
  );
}

