"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [roomCode, setRoomCode] = useState("");

  async function handleCreateRoom() {
    if (!nickname.trim()) return;

    localStorage.setItem("wordle_nickname", nickname.trim());

    try {
      const res = await fetch("/api/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: nickname.trim() }),
      });
      
      if (!res.ok) throw new Error("Failed to create room");

      const data = await res.json(); 
      router.push(`/room/${data.roomID}`);
    } catch (error) {
      console.error("Failed to create room:", error);
    }
  }

  function handleJoinRoom(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (roomCode.trim().length > 0 && nickname.trim().length > 0) {
      
      localStorage.setItem("wordle_nickname", nickname.trim());
      
      router.push(`/room/${roomCode.toUpperCase()}`);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 p-4 text-zinc-50">
      <div className="w-full max-w-md space-y-8 text-center">
        
        <div className="space-y-2">
          <h1 className="text-5xl font-bold tracking-tight">Wordle<span className="text-green-500">VS</span></h1>
          <p className="text-zinc-400">Multiplayer arena</p>
        </div>

        <div className="space-y-6 pt-8">
          <div>
            <input
              type="text"
              value={nickname}
              onChange={function(e) { setNickname(e.target.value); }}
              placeholder="ENTER NICKNAME"
              maxLength={12}
              className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-4 py-3 text-center text-lg font-bold tracking-wide text-white outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
            />
          </div>

          <button
            onClick={handleCreateRoom}
            disabled={!nickname.trim()}
            className="w-full rounded-md bg-green-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Create New Room
          </button>

          <div className="relative flex items-center py-2">
            <div className="flex-grow border-t border-zinc-800"></div>
            <span className="mx-4 flex-shrink-0 text-sm text-zinc-500">OR</span>
            <div className="flex-grow border-t border-zinc-800"></div>
          </div>

          <form onSubmit={handleJoinRoom} className="flex space-x-2">
            <input
              type="text"
              value={roomCode}
              onChange={function(e) { setRoomCode(e.target.value.toUpperCase()); }}
              placeholder="ROOM CODE"
              maxLength={6}
              disabled={!nickname.trim()}
              className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-4 py-3 text-center text-lg font-bold tracking-widest text-white outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              type="submit"
              disabled={!roomCode.trim() || !nickname.trim()}
              className="rounded-md bg-zinc-100 px-6 py-3 font-semibold text-zinc-900 transition-colors hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Join
            </button>
          </form>
        </div>

      </div>
    </main>
  );
}