import { useState } from 'react';
import { MainMenu } from '@/components/MainMenu';
import { GameScreen } from '@/components/GameScreen';
import type { WorldSave } from '@/game/save';

interface Session { name: string; seed: number; saved: WorldSave | null; }

export default function App() {
  const [session, setSession] = useState<Session | null>(null);

  if (!session) {
    return <MainMenu onPlay={(name, seed, saved) => setSession({ name, seed, saved })} />;
  }
  return (
    <GameScreen
      key={session.name}
      worldName={session.name}
      seed={session.seed}
      saved={session.saved}
      onExit={() => setSession(null)}
    />
  );
}
