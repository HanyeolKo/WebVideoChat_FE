import { useCallback, useEffect, useRef } from 'react'

const STUN_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
}

interface UseWebRTCOptions {
  myStream: MediaStream | null
  peerVideoRef: React.RefObject<HTMLVideoElement | null>
  send: (message: object) => void
  onCallEnd: () => void
}

/**
 * RTCPeerConnection 생성 및 시그널링 메시지 처리 훅.
 * send 함수를 통해 WebSocket으로 offer/answer/candidate를 중계한다.
 */
const useWebRTC = ({ myStream, peerVideoRef, send, onCallEnd }: UseWebRTCOptions) => {
  const pcRef = useRef<RTCPeerConnection | null>(null)
  // 최신 스트림을 항상 참조하기 위한 ref (state 갱신이 렌더 이후에 반영되는 문제 회피).
  const streamRef = useRef<MediaStream | null>(myStream)
  // remote description 설정 전 도착한 ICE candidate를 보관했다가 이후 flush.
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([])

  useEffect(() => {
    streamRef.current = myStream
  }, [myStream])

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection(STUN_CONFIG)

    pc.onicecandidate = (event) => {
      // 후보가 null이면(수집 종료) 전송하지 않는다.
      if (event.candidate) {
        send({ event: 'candidate', data: event.candidate })
      }
    }

    pc.addEventListener('track', (event) => {
      if (peerVideoRef.current) {
        peerVideoRef.current.srcObject = event.streams[0]
      }
    })

    return pc
  }, [peerVideoRef, send])

  const initPeerConnection = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close()
    }
    pendingCandidatesRef.current = []
    pcRef.current = createPeerConnection()
    return pcRef.current
  }, [createPeerConnection])

  const addTracks = useCallback((pc: RTCPeerConnection, stream?: MediaStream | null) => {
    const activeStream = stream ?? streamRef.current
    if (activeStream) {
      activeStream.getTracks().forEach((track) => pc.addTrack(track, activeStream))
    }
  }, [])

  // remote description 설정 후, 큐잉된 candidate를 일괄 추가한다.
  const flushPendingCandidates = useCallback(async (pc: RTCPeerConnection) => {
    const pending = pendingCandidatesRef.current
    pendingCandidatesRef.current = []
    for (const candidate of pending) {
      try {
        await pc.addIceCandidate(candidate)
      } catch (e) {
        console.error('[WebRTC] candidate 추가 실패', e)
      }
    }
  }, [])

  const createOffer = useCallback(async () => {
    const pc = pcRef.current
    if (!pc) return
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    send({ event: 'offer', data: offer })
  }, [send])

  const handleMessage = useCallback(async (data: { event: string; data: RTCSessionDescriptionInit | RTCIceCandidateInit | null }) => {
    if (data.event === 'offer') {
      const pc = initPeerConnection()
      await pc.setRemoteDescription(data.data as RTCSessionDescriptionInit)
      addTracks(pc)
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      send({ event: 'answer', data: answer })
      await flushPendingCandidates(pc)
    } else if (data.event === 'answer') {
      const pc = pcRef.current
      if (!pc) return
      await pc.setRemoteDescription(data.data as RTCSessionDescriptionInit)
      await flushPendingCandidates(pc)
    } else if (data.event === 'candidate') {
      if (!data.data) return
      const pc = pcRef.current
      const candidate = data.data as RTCIceCandidateInit
      // remote description이 아직 없으면 큐잉, 있으면 즉시 추가.
      if (pc && pc.remoteDescription) {
        try {
          await pc.addIceCandidate(candidate)
        } catch (e) {
          console.error('[WebRTC] candidate 추가 실패', e)
        }
      } else {
        pendingCandidatesRef.current.push(candidate)
      }
    } else if (data.event === 'closed') {
      onCallEnd()
    }
  }, [initPeerConnection, addTracks, flushPendingCandidates, send, onCallEnd])

  const startCall = useCallback(async (stream?: MediaStream | null) => {
    const pc = initPeerConnection()
    addTracks(pc, stream)
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    send({ event: 'offer', data: offer })
  }, [initPeerConnection, addTracks, send])

  const endCall = useCallback(() => {
    send({ event: 'closed' })
    pcRef.current?.close()
    pcRef.current = null
  }, [send])

  useEffect(() => {
    return () => {
      pcRef.current?.close()
    }
  }, [])

  return { startCall, endCall, handleMessage, createOffer }
}

export default useWebRTC
