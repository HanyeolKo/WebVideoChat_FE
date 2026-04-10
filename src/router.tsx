import { createBrowserRouter } from 'react-router-dom'
import ChatRoomPage from './pages/ChatRoomPage'
import LoginPage from './pages/LoginPage'

const router = createBrowserRouter([
  {
    path: '/',
    element: <LoginPage />,
  },
  {
    path: '/room/:roomId',
    element: <ChatRoomPage />,
  },
])

export default router
