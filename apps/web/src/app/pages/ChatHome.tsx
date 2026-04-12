/**
 * Chat Home Page - Default landing screen
 * Built on assistant-ui with tool-call-based interactions
 */

import { useParams } from 'react-router-dom';
import { Chat } from '../components/assistant-ui/Chat';

export function ChatHome() {
  const { chatId } = useParams<{ chatId?: string }>();

  return (
    <div className="flex h-full w-full">
      <Chat key={chatId} chatId={chatId} />
    </div>
  );
}
