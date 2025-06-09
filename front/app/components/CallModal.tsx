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

const formatTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
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

  // Add new state to track media loading
  const [isLocalVideoReady, setIsLocalVideoReady] = useState(false);
  const [isRemoteVideoReady, setIsRemoteVideoReady] = useState(false);

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
      
      // Handle video loading
      localVideoRef.current.onloadedmetadata = async () => {
        try {
          setIsLocalVideoReady(true);
          await localVideoRef.current?.play();
          console.log('Local video playing');
        } catch (err) {
          console.error('Local video play error:', err);
        }
      };
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteStream && remoteVideoRef.current) {
      console.log('Configuration du flux vidéo distant');
      remoteVideoRef.current.srcObject = remoteStream;
      
      // Handle video loading
      remoteVideoRef.current.onloadedmetadata = async () => {
        try {
          setIsRemoteVideoReady(true);
          await remoteVideoRef.current?.play();
          console.log('Remote video playing');
        } catch (err) {
          console.error('Remote video play error:', err);
        }
      };
    }
  }, [remoteStream]);

  // Initialisation de la connexion WebRTC améliorée
  useEffect(() => {
    let isActive = true;
    
    const initialize = async () => {
      try {
        // Configuration RTCPeerConnection améliorée
        const pc = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { 
              urls: 'turn:your-turn-server.com:3478',
              username: 'username',
              credential: 'password'
            }
          ],
          iceCandidatePoolSize: 10,
        });
        peerConnection.current = pc;

        // Gestion des candidats ICE
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            console.log('Envoi candidat ICE');
            socket?.emit('webrtc-signal', {
              type: 'ice-candidate',
              candidate: event.candidate,
              callId: call.id,
              targetUserId: isInitiator ? call.receiverId : call.callerId
            });
          }
        };

        // Surveillance de l'état de la connexion
        pc.onconnectionstatechange = () => {
          console.log('État connexion:', pc.connectionState);
          setIsVideoConnected(pc.connectionState === 'connected');
        };

        // Gestion améliorée des tracks distants
        pc.ontrack = (event) => {
          console.log('Nouveau track reçu:', event.track.kind);
          const [remoteStream] = event.streams;
          setRemoteStream(remoteStream);
          
          if (remoteVideoRef.current && remoteStream) {
            remoteVideoRef.current.srcObject = remoteStream;
            setIsRemoteVideoReady(true);
          }
        };

        // Configuration du flux local
        const constraints = {
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          },
          video: call.type === 'VIDEO' ? {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user'
          } : false
        };

        const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        setLocalStream(mediaStream);

        // Ajout des tracks au peer connection
        mediaStream.getTracks().forEach(track => {
          console.log('Ajout track local:', track.kind);
          pc.addTrack(track, mediaStream);
        });

        // Si initiateur, créer et envoyer l'offre
        if (isInitiator) {
          const offer = await pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: call.type === 'VIDEO'
          });
          await pc.setLocalDescription(offer);
          
          console.log('Envoi offre');
          socket?.emit('webrtc-signal', {
            type: 'offer',
            sdp: offer,
            callId: call.id,
            targetUserId: call.receiverId
          });
        }

      } catch (err) {
        console.error('Erreur initialisation WebRTC:', err);
        onClose(); // Fermer l'appel en cas d'erreur
      }
    };

    initialize();
    
    return () => {
      isActive = false;
      if (peerConnection.current) {
        peerConnection.current.close();
      }
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Gestion améliorée des signaux WebRTC
  useEffect(() => {
    if (!socket || !peerConnection.current) return;

    const handleSignal = async (data: any) => {
      console.log('Signal reçu:', data.type, 'de:', data.callerId);
      const pc = peerConnection.current;
      if (!pc) return;

      try {
        switch (data.type) {
          case 'offer':
            console.log('Traitement offre reçue');
            await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
            
            // Créer et envoyer la réponse
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            
            console.log('Envoi réponse');
            socket.emit('webrtc-signal', {
              type: 'answer',
              sdp: answer,
              callId: call.id,
              targetUserId: data.callerId
            });
            break;

          case 'answer':
            console.log('Traitement réponse reçue');
            await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
            break;

          case 'ice-candidate':
            if (data.candidate) {
              console.log('Ajout candidat ICE');
              await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
            }
            break;
        }
      } catch (err) {
        console.error('Erreur traitement signal:', err);
      }
    };

    socket.on('webrtc-signal', handleSignal);
    
    // Ajout d'un gestionnaire d'erreur WebRTC
    socket.on('webrtc-error', (error) => {
      console.error('Erreur WebRTC:', error);
    });

    return () => {
      socket.off('webrtc-signal', handleSignal);
      socket.off('webrtc-error');
    };
  }, [socket, call.id]);

  // Gestion améliorée des tracks
  useEffect(() => {
    if (!peerConnection.current) return;

    peerConnection.current.ontrack = (event) => {
      console.log('Track reçu:', event.track.kind);
      const [stream] = event.streams;
      setRemoteStream(stream);

      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
        setIsRemoteVideoReady(true);
      }

      // Activer l'audio par défaut
      if (event.track.kind === 'audio') {
        event.track.enabled = true;
      }
    };
  }, []);

  // Configurer le flux vidéo distant
  useEffect(() => {
    if (remoteStream && remoteVideoRef.current) {
      console.log('Configuration vidéo distante');
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch(err => {
        console.error('Erreur lecture vidéo distante:', err);
      });
    }
  }, [remoteStream]);

  // Contrôles audio
  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
        console.log('Audio local:', track.enabled ? 'actif' : 'muet');
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleSpeaker = () => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.muted = !remoteVideoRef.current.muted;
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

        {/* Video Grid amélioré */}
        <div className={`grid gap-4 mt-16 ${call.type === 'VIDEO' ? "grid-cols-2" : "grid-cols-1"}
             ${isFullscreen ? "h-[calc(100vh-12rem)]" : "h-[60vh]"}`}>
          {call.type === 'VIDEO' && (
            <>
              {/* Local Video */}
              <div className="relative rounded-2xl overflow-hidden bg-black/40">
                <video 
                  ref={localVideoRef}
                  autoPlay 
                  playsInline 
                  muted
                  className="w-full h-full object-cover"
                />
                {!isLocalVideoReady && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <div className="text-center">
                      <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                      <p className="text-white text-sm">Initialisation de la caméra...</p>
                    </div>
                  </div>
                )}
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

              {/* Remote Video */}
              <div className="relative rounded-2xl overflow-hidden bg-black/40">
                <video 
                  ref={remoteVideoRef}
                  autoPlay 
                  playsInline
                  className="w-full h-full object-cover"
                />
                {!isRemoteVideoReady && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <div className="text-center">
                      <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                      <p className="text-white text-sm">En attente de connexion...</p>
                    </div>
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
