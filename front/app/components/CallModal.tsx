import { useEffect, useRef, useState } from 'react';
import { useUser } from '~/root';
import { useSocket } from '~/hooks/useSocket';
import { MicOff, Mic, Volume2, VolumeX, PhoneOff, Maximize2, Minimize2, User } from 'lucide-react';

type CallModalProps = {
  call: {
    id: string;
    type: 'AUDIO' | 'VIDEO';
    status: string;
    callerId: string;
    receiverId: string;
  };
  onClose: () => void;
};

export const CallModal = ({ call, onClose }: CallModalProps) => {
  const { socket } = useSocket();
  const user = useUser();
  const [elapsedTime, setElapsedTime] = useState(0);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isVideoConnected, setIsVideoConnected] = useState(false);
  const [connectionQuality, setConnectionQuality] = useState<'good' | 'medium' | 'poor'>('good');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Garantir que les refs sont toujours disponibles
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const isInitiator = call.callerId === user.id;

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

  // Ajout d'un useEffect pour surveiller les flux vidéo
  useEffect(() => {
    if (localStream && localVideoRef.current) {
      console.log('Configuration du flux vidéo local');
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch(err => console.error('Erreur lecture vidéo locale:', err));
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteStream && remoteVideoRef.current) {
      console.log('Configuration du flux vidéo distant');
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch(err => console.error('Erreur lecture vidéo distante:', err));
    }
  }, [remoteStream]);

  // Amélioration de la signalisation WebRTC
  const initializePeerConnection = () => {
    console.log('Initialisation PeerConnection...');
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    // Listen to connection state changes
    pc.onconnectionstatechange = () => {
      console.log('Connection state changed:', pc.connectionState);
      switch (pc.connectionState) {
        case 'connected':
          console.log('Peers connected!');
          break;
        case 'disconnected':
          console.log('Peers disconnected!');
          break;
        case 'failed':
          console.log('Connection failed, restarting...');
          pc.restartIce();
          break;
      }
    };

    pc.ontrack = (event) => {
      console.log('Received remote track:', event.track.kind);
      const [remoteMediaStream] = event.streams;
      setRemoteStream(remoteMediaStream);
      
      if (event.track.kind === 'video') {
        setIsVideoConnected(true);
      }
      
      event.track.onunmute = () => {
        console.log(`${event.track.kind} track unmuted`);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteMediaStream;
        }
      };
    };

    return pc;
  };

  // Effect principal avec meilleure gestion des signaux
  useEffect(() => {
    let localMediaStream: MediaStream | null = null;
    
    const initialize = async () => {
      try {
        console.log('Starting call initialization...');
        
        // 1. Créer la connexion peer
        const pc = initializePeerConnection();
        peerConnection.current = pc;

        // 2. Obtenir les médias locaux
        localMediaStream = await navigator.mediaDevices.getUserMedia({
          video: call.type === 'VIDEO',
          audio: true
        });
        console.log('Local media obtained');
        setLocalStream(localMediaStream);

        // 3. Ajouter les tracks
        localMediaStream.getTracks().forEach(track => {
          console.log(`Adding ${track.kind} track to peer connection`);
          pc.addTrack(track, localMediaStream!);
        });

        // 4. Gérer la signalisation
        if (isInitiator) {
          console.log('Creating offer as initiator');
          const offer = await pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: call.type === 'VIDEO'
          });
          
          await pc.setLocalDescription(offer);
          console.log('Local description set, sending offer');
          
          socket?.emit('webrtc-signal', {
            callId: call.id,
            signal: { 
              type: 'offer',
              sdp: pc.localDescription
            },
            targetUserId: call.receiverId
          });
        }

        // 5. Gérer les candidats ICE
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            console.log('Sending ICE candidate');
            socket?.emit('webrtc-signal', {
              callId: call.id,
              signal: { 
                type: 'ice-candidate',
                candidate: event.candidate 
              },
              targetUserId: isInitiator ? call.receiverId : call.callerId
            });
          }
        };

      } catch (err) {
        console.error('Setup error:', err);
        onClose();
      }
    };

    initialize();

    // Cleanup
    return () => {
      if (localMediaStream) {
        localMediaStream.getTracks().forEach(track => track.stop());
      }
      if (peerConnection.current) {
        peerConnection.current.close();
      }
    };
  }, []);

  // Gestion améliorée des signaux WebRTC
  useEffect(() => {
    if (!socket || !peerConnection.current) return;

    const handleSignal = async (data: any) => {
      const pc = peerConnection.current;
      if (!pc) return;

      try {
        console.log('Received signal:', data.signal.type);
        
        switch (data.signal.type) {
          case 'offer':
            console.log('Processing offer');
            await pc.setRemoteDescription(new RTCSessionDescription(data.signal.sdp));
            
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            
            socket.emit('webrtc-signal', {
              callId: call.id,
              signal: { type: 'answer', sdp: answer },
              targetUserId: isInitiator ? call.receiverId : call.callerId
            });
            break;

          case 'answer':
            console.log('Processing answer');
            await pc.setRemoteDescription(new RTCSessionDescription(data.signal.sdp));
            break;

          case 'ice-candidate':
            if (pc.remoteDescription) {
              console.log('Adding ICE candidate');
              await pc.addIceCandidate(new RTCIceCandidate(data.signal.candidate));
            }
            break;
        }
      } catch (err) {
        console.error('Signal processing error:', err);
      }
    };

    console.log('Setting up WebRTC signal handler');
    socket.on('webrtc-signal', handleSignal);
    
    return () => {
      console.log('Cleaning up WebRTC signal handler');
      socket.off('webrtc-signal', handleSignal);
    };
  }, [socket]);

  // Vérification périodique des tracks
  useEffect(() => {
    const interval = setInterval(() => {
      if (localStream) {
        console.log('État tracks locaux:', {
          video: localStream.getVideoTracks().map(t => ({
            enabled: t.enabled,
            muted: t.muted
          })),
          audio: localStream.getAudioTracks().map(t => ({
            enabled: t.enabled,
            muted: t.muted
          }))
        });
      }
      if (remoteStream) {
        console.log('État tracks distants:', {
          video: remoteStream.getVideoTracks().map(t => ({
            enabled: t.enabled,
            muted: t.muted
          })),
          audio: remoteStream.getAudioTracks().map(t => ({
            enabled: t.enabled,
            muted: t.muted
          }))
        });
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [localStream, remoteStream]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Amélioration des contrôles audio
  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = isMuted;
        console.log('Audio local:', track.enabled ? 'actif' : 'muet');
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleSpeaker = () => {
    if (remoteStream) {
      remoteStream.getAudioTracks().forEach(track => {
        track.enabled = !isSpeakerOn;
      });
      if (remoteVideoRef.current) {
        remoteVideoRef.current.muted = !isSpeakerOn;
      }
      setIsSpeakerOn(!isSpeakerOn);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Ajouter un effet pour surveiller la qualité de la connexion
  useEffect(() => {
    if (!peerConnection.current) return;

    const checkConnectionQuality = () => {
      const pc = peerConnection.current;
      if (!pc) return;

      pc.getStats().then(stats => {
        stats.forEach(report => {
          if (report.type === "candidate-pair" && report.state === "succeeded") {
            const rtt = report.currentRoundTripTime;
            if (rtt) {
              if (rtt < 0.1) setConnectionQuality('good');
              else if (rtt < 0.3) setConnectionQuality('medium');
              else setConnectionQuality('poor');
            }
          }
        });
      });
    };

    const interval = setInterval(checkConnectionQuality, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-gray-900 to-black backdrop-blur-lg flex items-center justify-center z-50">
      <div className={`relative bg-black/30 p-6 rounded-3xl shadow-2xl w-full max-w-7xl
        border border-white/10 backdrop-blur-md transition-all duration-300
        ${isFullscreen ? "h-screen max-w-full m-0 rounded-none" : "h-auto m-4"}`}>
        
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center bg-gradient-to-b from-black/40 to-transparent z-10">
          <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <h2 className="text-xl font-semibold text-white">
                {call.type === 'VIDEO' ? 'Appel vidéo' : 'Appel audio'}
              </h2>
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${
                  connectionQuality === 'good' ? "bg-green-500" : 
                  connectionQuality === 'medium' ? "bg-yellow-500" : "bg-red-500"
                }`} />
                <span className="text-sm text-white/70">
                  {connectionQuality === 'good' ? 'Excellente connexion' :
                   connectionQuality === 'medium' ? 'Connexion moyenne' : 'Mauvaise connexion'}
                </span>
                <span className="text-sm text-white/70 ml-2">{formatTime(elapsedTime)}</span>
              </div>
            </div>
          </div>
          
          <button 
            onClick={toggleFullscreen}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
          >
            {isFullscreen ? 
              <Minimize2 className="w-5 h-5 text-white" /> : 
              <Maximize2 className="w-5 h-5 text-white" />
            }
          </button>
        </div>

        {/* Video Grid */}
        <div className={`grid gap-4 mt-16
          ${call.type === 'VIDEO' ? "grid-cols-2" : "grid-cols-1"}
          ${isFullscreen ? "h-[calc(100vh-12rem)]" : "h-[60vh]"}`}>
          {call.type === 'VIDEO' && (
            <>
              <div className="relative rounded-2xl overflow-hidden bg-black/40">
                <video 
                  ref={localVideoRef}
                  autoPlay 
                  playsInline 
                  muted 
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                  <div className="bg-black/60 px-4 py-2 rounded-full flex items-center gap-2">
                    <User className="w-4 h-4 text-white/70" />
                    <span className="text-sm text-white">Vous</span>
                  </div>
                  {isMuted && (
                    <div className="bg-red-500/80 px-3 py-1 rounded-full">
                      <MicOff className="w-4 h-4 text-white" />
                    </div>
                  )}
                </div>
              </div>

              <div className="relative rounded-2xl overflow-hidden bg-black/40">
                <video 
                  ref={remoteVideoRef}
                  autoPlay 
                  playsInline 
                  className="w-full h-full object-cover"
                />
                {!isVideoConnected && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin mb-2" />
                    <span className="text-white/90">Connexion en cours...</span>
                  </div>
                )}
                <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                  <div className="bg-black/60 px-4 py-2 rounded-full flex items-center gap-2">
                    <User className="w-4 h-4 text-white/70" />
                    <span className="text-sm text-white">Interlocuteur</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Controls */}
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/40 to-transparent">
          <div className="flex items-center justify-center gap-4">
            <button 
              onClick={toggleMute}
              className={`p-4 rounded-full transition-all duration-200 ${
                isMuted ? "bg-red-500 hover:bg-red-600" : "bg-white/10 hover:bg-white/20"
              }`}
            >
              {isMuted ? <MicOff className="w-6 h-6 text-white" /> : <Mic className="w-6 h-6 text-white" />}
            </button>
            
            <button 
              onClick={toggleSpeaker}
              className={`p-4 rounded-full transition-all duration-200 ${
                !isSpeakerOn ? "bg-red-500 hover:bg-red-600" : "bg-white/10 hover:bg-white/20"
              }`}
            >
              {isSpeakerOn ? <Volume2 className="w-6 h-6 text-white" /> : <VolumeX className="w-6 h-6 text-white" />}
            </button>

            <button 
              onClick={onClose}
              className="p-4 rounded-full bg-red-500 hover:bg-red-600 transition-all duration-200"
            >
              <PhoneOff className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
