import { useEffect, useRef, useState } from 'react';
import { useUser } from '~/root';
import { useSocket } from '~/hooks/useSocket';
import { MicOff, Mic, Volume2, VolumeX, PhoneOff } from 'lucide-react';

export const CallModal = ({ call, onClose }: CallModalProps) => {
  const { socket } = useSocket();
  const user = useUser();
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const isInitiator = call.callerId === user.id;
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isVideoConnected, setIsVideoConnected] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (call.status === 'ONGOING') {
      timer = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [call.status]);

  useEffect(() => {
    const setupAudio = async () => {
      try {
        if (remoteStream && remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
          remoteVideoRef.current.muted = false;
          await remoteVideoRef.current.play();

          remoteStream.getAudioTracks().forEach(track => {
            track.enabled = true;
          });
        }
      } catch (error) {
        console.error('Erreur configuration audio:', error);
      }
    };

    if (remoteStream) {
      setupAudio();
    }
  }, [remoteStream]);

useEffect(() => {
  const initializeCall = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('WebRTC non supporté');
      }

      // Arrêter tous les tracks existants avant d'en créer de nouveaux
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      if (remoteStream) {
        remoteStream.getTracks().forEach(track => track.stop());
      }
      
      // Reset streams
      setLocalStream(null);
      setRemoteStream(null);

      const mediaConstraints = {
        video: call.type === 'VIDEO' ? {
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } : false,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
      
      // Vérifier si le composant est toujours monté
      let isMounted = true;
      if (!isMounted) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }

      stream.getAudioTracks().forEach(track => (track.enabled = !isMuted));
      setLocalStream(stream);

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      });

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        const [stream] = event.streams;
        stream.getAudioTracks().forEach(track => (track.enabled = isSpeakerOn));
        setRemoteStream(stream);

        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream;
          remoteVideoRef.current.onloadedmetadata = () => {
            remoteVideoRef.current?.play().catch(console.error);
          };
        }

        if (event.track.kind === 'video') setIsVideoConnected(true);
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket?.emit('webrtc-signal', {
            callId: call.id,
            signal: { type: 'ice-candidate', candidate: event.candidate },
            targetUserId: isInitiator ? call.receiverId : call.callerId,
          });
        }
      };

      peerConnection.current = pc;

      if (isInitiator) {
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: call.type === 'VIDEO',
        });
        await pc.setLocalDescription(offer);
        socket?.emit('webrtc-signal', {
          callId: call.id,
          signal: { type: 'offer', sdp: offer },
          targetUserId: call.receiverId,
        });
      }

    } catch (err: any) {
      console.error('Erreur WebRTC:', err);
      if (err.name === 'NotReadableError') {
        alert("La caméra ou le microphone est déjà utilisé par une autre application. Veuillez fermer les autres applications utilisant ces périphériques.");
      } else {
        alert("Erreur d'accès aux périphériques. Veuillez vérifier les permissions.");
      }
      onClose();
    }
  };

  // Délai plus long pour s'assurer que les ressources précédentes sont libérées
  const timeoutId = setTimeout(() => {
    initializeCall();
  }, 500);

  return () => {
    clearTimeout(timeoutId);
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    if (remoteStream) {
      remoteStream.getTracks().forEach(track => track.stop());
    }
    if (peerConnection.current) {
      peerConnection.current.close();
    }
    setLocalStream(null);
    setRemoteStream(null);
  };
}, []);


  useEffect(() => {
    if (!socket || !peerConnection.current) return;

    socket.on('webrtc-signal', async (data) => {
      const pc = peerConnection.current;
      if (!pc) return;

      try {
        if (data.signal.type === 'offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(data.signal.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('webrtc-signal', {
            callId: call.id,
            signal: { type: 'answer', sdp: answer },
            targetUserId: isInitiator ? call.receiverId : call.callerId,
          });
        } else if (data.signal.type === 'answer') {
          await pc.setRemoteDescription(new RTCSessionDescription(data.signal.sdp));
        } else if (data.signal.type === 'ice-candidate') {
          await pc.addIceCandidate(new RTCIceCandidate(data.signal.candidate));
        }
      } catch (err) {
        console.error('Error handling WebRTC signal:', err);
      }
    });

    return () => {
      socket.off('webrtc-signal');
    };
  }, [socket]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = isMuted;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleSpeaker = () => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.muted = !isSpeakerOn;
      setIsSpeakerOn(!isSpeakerOn);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-50">
      <div className="bg-white/10 border border-white/20 p-8 rounded-3xl shadow-2xl w-full max-w-5xl text-white backdrop-blur-lg">
        <div className="flex flex-col gap-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold tracking-wider">
              {call.type === 'VIDEO' ? 'Appel vidéo' : 'Appel audio'} -
              <span className="text-green-400"> {formatTime(elapsedTime)}</span>
            </h2>
          </div>

          <div className={`grid ${call.type === 'VIDEO' ? 'grid-cols-2' : 'grid-cols-1'} gap-6`}>
            {call.type === 'VIDEO' && (
              <>
                <div className="relative aspect-video bg-black rounded-2xl overflow-hidden">
                  <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                  <div className="absolute bottom-3 left-3 bg-black/60 px-3 py-1 rounded-full">Vous</div>
                </div>
                <div className="relative aspect-video bg-black rounded-2xl overflow-hidden">
                  <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                  {!isVideoConnected && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-white">En attente de connexion vidéo...</span>
                    </div>
                  )}
                  <div className="absolute bottom-3 left-3 bg-black/60 px-3 py-1 rounded-full">Interlocuteur</div>
                </div>
              </>
            )}
          </div>

          <div className="flex justify-center gap-6">
            <button onClick={toggleMute} className="p-3 rounded-full bg-black/40 hover:bg-black/60">
              {isMuted ? <MicOff /> : <Mic />}
            </button>
            <button onClick={toggleSpeaker} className="p-3 rounded-full bg-black/40 hover:bg-black/60">
              {isSpeakerOn ? <Volume2 /> : <VolumeX />}
            </button>
            <button onClick={onClose} className="p-3 rounded-full bg-red-600 hover:bg-red-800">
              <PhoneOff />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
