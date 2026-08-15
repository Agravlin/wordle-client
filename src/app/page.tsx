"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [nickname, setNickname] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function createRoom() {
    const name = nickname.trim();
    if (!name || loading) return;
    setLoading(true);
    setError("");
    localStorage.setItem("wordle_nickname", name);
    try {
      const response = await fetch("/api/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: name }),
      });
      if (!response.ok) throw new Error(await response.text());
      const data = await response.json() as { room_id: string };
      router.push(`/room/${data.room_id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message.trim() || "Could not create a room." : "Could not create a room.");
      setLoading(false);
    }
  }

  function joinRoom(event: FormEvent) {
    event.preventDefault();
    const name = nickname.trim();
    const code = roomCode.trim().toUpperCase();
    if (!name || !code) return;
    localStorage.setItem("wordle_nickname", name);
    router.push(`/room/${code}`);
  }

  return (
    <main className="home-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <section className="home-card">
        <div className="logo-mark" aria-hidden="true"><span>W</span><span>O</span><span>R</span><span>D</span><span>!</span></div>
        <div className="brand"><span>WORD</span><span className="brand-accent">CLASH</span></div>
        <p className="tagline">Wordle is better with company.</p>

        <label className="field-label" htmlFor="nickname">Your nickname</label>
        <input id="nickname" className="text-input" value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder="How should we call you?" maxLength={12} autoComplete="nickname" autoFocus />

        <button className="primary-button home-primary" onClick={createRoom} disabled={!nickname.trim() || loading}>
          {loading ? "Creating…" : "Create a new room"}<span>→</span>
        </button>

        <div className="divider"><span>or join a friend</span></div>
        <form className="join-form" onSubmit={joinRoom}>
          <input className="text-input code-input" value={roomCode} onChange={(event) => setRoomCode(event.target.value.replace(/[^a-z0-9]/gi, "").toUpperCase())} placeholder="ROOM CODE" maxLength={6} aria-label="Room code" />
          <button className="secondary-button" disabled={!nickname.trim() || !roomCode.trim()}>Join room</button>
        </form>
        {error && <p className="form-error" role="alert">{error}</p>}
        <p className="footer-note">No account needed · Up to 8 players</p>
      </section>
    </main>
  );
}
