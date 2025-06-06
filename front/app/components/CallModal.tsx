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
    console.log('Initialisation nouvelle connexion WebRTC');
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    // Amélioration de la gestion des tracks
    pc.ontrack = (event) => {
      console.log('Nouveau track reçu:', event.track.kind);
      const [stream] = event.streams;
      
      if (!remoteStream) {
        console.log('Configuration du flux distant initial');
        setRemoteStream(stream);
        
        if (remoteVideoRef.current) {
          console.log('Attribution du flux distant à la vidéo');
          remoteVideoRef.current.srcObject = stream;
        }
      }

      // Activer immédiatement la vidéo si c'est un track vidéo
      if (event.track.kind === 'video') {
        console.log('Track vidéo détecté, activation de la connexion vidéo');
        setIsVideoConnected(true);
      }

      // Gestion des événements de track
      event.track.onunmute = () => {
        console.log(`Track ${event.track.kind} activé`);
        setIsVideoConnected(true);
      };

      event.track.onended = () => {
        console.log(`Track ${event.track.kind} terminé`);
      };
    };

    return pc;
  };

  // Gestion améliorée des médias locaux
  const startLocalMedia = async () => {
    try {
      console.log('Demande accès médias avec contraintes optimisées');
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: call.type === 'VIDEO' ? {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { min: 20, ideal: 30 }
        } : false,
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Configure local video immediately
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = mediaStream;
      }

      return mediaStream;
    } catch (err) {
      console.error('Erreur accès médias:', err);
      throw err;
    }
  };

  // Effect principal avec meilleure gestion de la connexion
  useEffect(() => {
    let localMediaStream: MediaStream | null = null;
    
    const initialize = async () => {
      try {
        // 1. Initialiser la connexion
        const pc = initializePeerConnection();
        peerConnection.current = pc;

        // 2. Démarrer les médias locaux
        localMediaStream = await startLocalMedia();
        setLocalStream(localMediaStream);
        console.log('Médias locaux initialisés');

        // 3. Ajouter les tracks avec vérification
        localMediaStream.getTracks().forEach(track => {
          console.log(`Ajout track local: ${track.kind}`);
          pc.addTrack(track, localMediaStream!);
        });

        // 4. Gestion de la signalisation
        if (isInitiator) {
          console.log('Création offre comme initiateur');
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          
          socket?.emit('webrtc-signal', {
            callId: call.id,
            signal: { type: 'offer', sdp: offer },
            targetUserId: call.receiverId
          });
        }

        // 5. Gestion des candidats ICE
        pc.onicecandidate = ({ candidate }) => {
          if (candidate) {
            console.log('Envoi candidat ICE');
            socket?.emit('webrtc-signal', {
              callId: call.id,
              signal: { type: 'ice-candidate', candidate },
              targetUserId: isInitiator ? call.receiverId : call.callerId
            });
          }
        };

      } catch (err) {
        console.error('Erreur initialisation:', err);
        onClose();
      }
    };

    initialize();

    // Cleanup amélioré
    return () => {
      console.log('Nettoyage des ressources');
      if (localMediaStream) {
        localMediaStream.getTracks().forEach(track => {
          track.stop();
          console.log(`Track ${track.kind} arrêté`);
        });
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
