import { useCallback, useEffect, useRef } from 'react'

type MessageHandler = (data: unknown) => void

/**
 * WebSocket 연결 및 메시지 송수신 훅.
 * roomId가 변경되면 기존 소켓을 닫고 새로 연결한다.
 * onOpen은 소켓이 실제로 열린 시점에 호출된다(연결 전 전송 유실 방지용).
 */
const useWebSocket = (roomId: string | null, onMessage: MessageHandler, onOpen?: () => void) => {
  const socketRef = useRef<WebSocket | null>(null)
  // 핸들러를 ref로 안정화해 매 렌더 새 함수가 들어와도 소켓을 재연결하지 않는다.
  const handlerRef = useRef<MessageHandler>(onMessage)
  const openHandlerRef = useRef<(() => void) | undefined>(onOpen)

  useEffect(() => {
    handlerRef.current = onMessage
    openHandlerRef.current = onOpen
  }, [onMessage, onOpen])

  const send = useCallback((message: object) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message))
    }
  }, [])

  useEffect(() => {
    if (!roomId) return

    const wsBase = import.meta.env.VITE_WS_BASE_URL || ''
    const ws = new WebSocket(`${wsBase}/socket/${roomId}`)
    socketRef.current = ws

    ws.onopen = () => {
      console.log('[WS] 연결됨')
      openHandlerRef.current?.()
    }
    ws.onclose = () => console.log('[WS] 닫힘')
    ws.onerror = (e) => console.error('[WS] 에러', e)
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        handlerRef.current(data)
      } catch {
        console.error('[WS] 메시지 파싱 실패', event.data)
      }
    }

    return () => {
      ws.close()
    }
  }, [roomId])

  return { send }
}

export default useWebSocket
