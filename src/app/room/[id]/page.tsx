"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  
  // params.id can be a string or an array in Next.js App Router, ensure it's a string
  const roomId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [nickname, setNickname] = useState("");
  const [messages, setMessages] = useState<string[]>([]);
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    const storedNick = localStorage.getItem("wordle_nickname");
    
    // Redirect to home if no nickname is found in local storage
    if (!storedNick) {
      router.push("/");
      return;
    }
    
    setNickname(storedNick);

    // Adjust the URL according to your Go WebSocket endpoint
    // Example: ws://localhost:8080/ws/join?room=...&nick=...
    const socketUrl = `ws://localhost:8080/ws?room=${roomId}&nick=${encodeURIComponent(storedNick)}`;
    const socket = new WebSocket(socketUrl);

    socket.onopen = () => {
      console.log("WebSocket connected!");
      setMessages((prev) => [...prev, "Connected to server!"]);
    };

    socket.onmessage = (event) => {
      console.log("Message from server:", event.data);
      // Parse the incoming data and update the state
      setMessages((prev) => [...prev, event.data]);
    };

    socket.onclose = () => {
      console.log("WebSocket disconnected");
      setMessages((prev) => [...prev, "Disconnected from server."]);
    };

    ws.current = socket;

    // Cleanup: close the connection when the component unmounts
    return () => {
      socket.close();
    };
  }, [roomId, router]);

  return (
    <main className="flex min-h-screen flex-col items-center bg-zinc-950 p-8 text-zinc-50">
      <div className="w-full max-w-2xl space-y-6">
        
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <h1 className="text-3xl font-bold">
            Room: <span className="text-zinc-400 tracking-widest">{roomId}</span>
          </h1>
          <div className="text-lg font-semibold">
            Player: <span className="text-green-500">{nickname}</span>
          </div>
        </div>

        {/* Temporary log container to monitor incoming WebSocket messages/events */}
        <div className="h-64 w-full overflow-y-auto rounded-md border border-zinc-800 bg-zinc-900 p-4 font-mono text-sm text-zinc-300">
          {messages.length === 0 && <span className="text-zinc-600">Connecting...</span>}
          {messages.map((msg, idx) => (
            <div key={idx} className="border-b border-zinc-800/50 py-1">
              {msg}
            </div>
          ))}
        </div>

      </div>
    </main>
  );
}