"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";

type Board = { grid: number[][]; CurrentRow: number };
type Boards = Record<string, Board>;
type ServerMessage = { type: string; payload: unknown };

const ROWS = 6;
const COLS = 5;
const KEYS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];

function socketAddress(roomId: string, nickname: string) {
  const configured = process.env.NEXT_PUBLIC_SERVER_URL;
  if (configured) {
    const url = new URL(configured);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.pathname = "/ws";
    url.search = new URLSearchParams({ room: roomId, nick: nickname }).toString();
    return url.toString();
  }
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.hostname || "localhost";
  return `${protocol}//${host}:8080/ws?room=${encodeURIComponent(roomId)}&nick=${encodeURIComponent(nickname)}`;
}

function tileClass(status: number, filled: boolean) {
  if (status === 4) return "tile tile-green";
  if (status === 3) return "tile tile-yellow";
  if (status === 2) return "tile tile-gray";
  return `tile ${filled ? "tile-filled" : ""}`;
}

function MiniBoard({ board }: { board?: Board }) {
  return (
    <div className="mini-board" aria-label="Player progress">
      {Array.from({ length: ROWS * COLS }, (_, index) => {
        const row = Math.floor(index / COLS);
        const col = index % COLS;
        const status = board?.grid?.[row]?.[col] ?? 0;
        return <span key={index} className={`mini-tile mini-${status}`} />;
      })}
    </div>
  );
}

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = String(Array.isArray(params.id) ? params.id[0] : params.id).toUpperCase();
  const [nickname, setNickname] = useState("");
  const [players, setPlayers] = useState<string[]>([]);
  const [boards, setBoards] = useState<Boards>({});
  const [letters, setLetters] = useState<string[][]>([]);
  const [guess, setGuess] = useState("");
  const [phase, setPhase] = useState<"connecting" | "lobby" | "playing" | "finished" | "error">("connecting");
  const [notice, setNotice] = useState("Connecting to the room…");
  const [submitting, setSubmitting] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const ws = useRef<WebSocket | null>(null);
  const rejectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const guessInput = useRef<HTMLInputElement | null>(null);
  const confirmedRows = useRef<Record<string, number>>({});

  useEffect(() => {
    const storedNick = localStorage.getItem("wordle_nickname")?.trim() || "";
    if (!storedNick) {
      router.replace("/");
      return;
    }
    let socket: WebSocket | undefined;
    let cancelled = false;

    const connect = async () => {
      try {
        const response = await fetch("/api/join", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ room_id: roomId, nickname: storedNick }),
        });
        if (!response.ok) throw new Error(await response.text());
        if (cancelled) return;
        setNickname(storedNick);
        setIsHost(localStorage.getItem("wordle_host_room") === roomId);

        socket = new WebSocket(socketAddress(roomId, storedNick));
        ws.current = socket;
        socket.onopen = () => {
          setPhase("lobby");
          setNotice("Share the code and start when everyone is here.");
        };
        socket.onmessage = (event) => {
          const message = JSON.parse(event.data) as ServerMessage;
          if (message.type === "PLAYER_LIST") setPlayers(message.payload as string[]);
          if (message.type === "FULL_STATE") {
            const next = message.payload as Boards;
            const freshRound = Object.values(next).every((board) => board.CurrentRow === 0);
            confirmedRows.current = Object.fromEntries(
              Object.entries(next).map(([player, board]) => [player, board.CurrentRow]),
            );
            if (freshRound) {
              setLetters([]);
              setGuess("");
              setSubmitting(false);
            }
            setBoards(next);
            const hasWinner = Object.values(next).some((board) =>
              board.grid.some((row) => row.every((cell) => cell === 4)),
            );
            setPhase(hasWinner ? "finished" : "playing");
            setNotice(hasWinner ? "We have a winner!" : "Game on — find the five-letter word.");
          }
          if (message.type === "BOARD_UPDATE") {
            const update = message.payload as { nick: string; board: Board };
            const previousRow = confirmedRows.current[update.nick] ?? 0;
            const guessWasAccepted = update.board.CurrentRow > previousRow;
            confirmedRows.current[update.nick] = Math.max(previousRow, update.board.CurrentRow);
            setBoards((current) => ({ ...current, [update.nick]: update.board }));
            if (update.nick === storedNick && guessWasAccepted) {
              if (rejectTimer.current) clearTimeout(rejectTimer.current);
              setSubmitting(false);
              setGuess("");
              setNotice("Accepted — keep going!");
            }
          }
          if (message.type === "GUESS_REJECTED") {
            const rejection = message.payload as { message?: string };
            if (rejectTimer.current) clearTimeout(rejectTimer.current);
            setSubmitting(false);
            setNotice(rejection.message || "That word was not accepted. Try another.");
            requestAnimationFrame(() => guessInput.current?.focus());
          }
        };
        socket.onerror = () => setNotice("Could not connect to the game server.");
        socket.onclose = () => {
          if (!cancelled) {
            setPhase("error");
            setNotice("Connection lost. Return home and try again.");
          }
        };
      } catch (error) {
        setPhase("error");
        setNotice(error instanceof Error ? error.message.trim() || "Unable to join this room." : "Unable to join this room.");
      }
    };
    connect();
    return () => {
      cancelled = true;
      if (rejectTimer.current) clearTimeout(rejectTimer.current);
      socket?.close();
    };
  }, [roomId, router]);

  const send = useCallback((message: object) => {
    if (ws.current?.readyState === WebSocket.OPEN) ws.current.send(JSON.stringify(message));
  }, []);

  const updateGuess = useCallback((next: string) => {
    setGuess(next);
    send({ action: "SYNC_ROW", row_state: Array.from({ length: COLS }, (_, index) => index < next.length ? 1 : 0) });
  }, [send]);

  const submitGuess = useCallback(() => {
    if (guess.length !== COLS || submitting) return;
    setSubmitting(true);
    setNotice("Checking your word…");
    const row = boards[nickname]?.CurrentRow ?? 0;
    setLetters((current) => {
      const next = [...current];
      next[row] = guess.split("");
      return next;
    });
    send({ action: "GUESS", guess });
    rejectTimer.current = setTimeout(() => {
      setSubmitting(false);
      setNotice("The server did not respond. Please try again.");
      requestAnimationFrame(() => guessInput.current?.focus());
    }, 8000);
  }, [boards, guess, nickname, send, submitting]);

  const pressKey = useCallback((key: string) => {
    if (phase !== "playing" || submitting) return;
    if (key === "ENTER") return submitGuess();
    if (key === "BACKSPACE" || key === "⌫") return updateGuess(guess.slice(0, -1));
    if (/^[A-Z]$/.test(key) && guess.length < COLS) updateGuess(guess + key);
  }, [guess, phase, submitGuess, submitting, updateGuess]);

  const ownBoard = boards[nickname];
  const currentRow = ownBoard?.CurrentRow ?? 0;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement) return;
      const key = event.key === "Backspace" ? "BACKSPACE" : event.key.toUpperCase();
      if (key === "ENTER" || key === "BACKSPACE" || /^[A-Z]$/.test(key)) pressKey(key);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pressKey]);

  useEffect(() => {
    if (phase === "playing") guessInput.current?.focus();
  }, [phase, currentRow]);

  const keyboardStates = new Map<string, number>();
  letters.forEach((rowLetters, row) => {
    rowLetters?.forEach((letter, col) => {
      keyboardStates.set(letter, Math.max(keyboardStates.get(letter) ?? 0, ownBoard?.grid?.[row]?.[col] ?? 0));
    });
  });

  return (
    <main className="game-shell">
      <header className="game-header">
        <button className="icon-button" onClick={() => router.push("/")} aria-label="Leave room">←</button>
        <div className="brand small-brand"><span>WORD</span><span className="brand-accent">CLASH</span></div>
        <div className={`connection-dot ${phase === "error" ? "offline" : ""}`} title={notice} />
      </header>

      <div className="game-layout">
        <aside className="room-panel">
          <p className="eyebrow">Room code</p>
          <button className="room-code" onClick={() => navigator.clipboard?.writeText(roomId)} title="Copy room code">{roomId} <span>⧉</span></button>
          <p className="panel-hint">Tap to copy and invite a friend</p>
          <div className="player-heading"><span>Players</span><span>{players.length}</span></div>
          <div className="player-list">
            {players.map((player) => (
              <div className="player-card" key={player}>
                <div className="avatar">{player.charAt(0).toUpperCase()}</div>
                <div className="player-name"><strong>{player}</strong><small>{player === nickname ? "YOU" : phase === "playing" ? "PLAYING" : "READY"}</small></div>
                <MiniBoard board={boards[player]} />
              </div>
            ))}
          </div>
        </aside>

        <section className="board-section">
          <div className="status-copy">
            <p className="eyebrow">{phase === "lobby" ? "Waiting room" : phase === "finished" ? "Round over" : "Your board"}</p>
            <h1>{phase === "lobby" ? "Ready to play?" : phase === "finished" ? "Nice game!" : "Guess the word"}</h1>
            <p aria-live="polite">{notice}{submitting && <span className="checking-dots" aria-hidden="true"><i /><i /><i /></span>}</p>
          </div>

          {phase === "lobby" ? (
            <button className="primary-button" onClick={() => send({ action: "START_GAME" })}>Start game</button>
          ) : phase === "error" ? (
            <button className="primary-button" onClick={() => router.push("/")}>Back home</button>
          ) : (
            <>
              {phase === "finished" && isHost && (
                <button className="primary-button next-round-button" onClick={() => {
                  setNotice("Starting the next round…");
                  send({ action: "START_GAME" });
                }}>Start next round</button>
              )}
              {phase === "finished" && !isHost && <p className="host-wait">Waiting for the host to start the next round…</p>}
              <div className="word-grid" aria-label="Wordle board" onClick={() => guessInput.current?.focus()}>
                <input
                  ref={guessInput}
                  className="guess-capture"
                  value={guess}
                  onChange={(event) => updateGuess(event.target.value.replace(/[^a-z]/gi, "").toUpperCase().slice(0, COLS))}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      submitGuess();
                    }
                  }}
                  maxLength={COLS}
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                  aria-label="Type your five-letter guess"
                  disabled={submitting || phase !== "playing"}
                />
                {Array.from({ length: ROWS }, (_, row) => Array.from({ length: COLS }, (_, col) => {
                  const status = ownBoard?.grid?.[row]?.[col] ?? 0;
                  const letter = row === currentRow ? guess[col] : letters[row]?.[col];
                  const checking = submitting && row === currentRow;
                  return <div key={`${row}-${col}`} className={`${tileClass(status, Boolean(letter))} ${checking ? "tile-checking" : ""}`}>{letter}</div>;
                }))}
              </div>
              <div className="keyboard" aria-label="On-screen keyboard">
                {KEYS.map((row, rowIndex) => (
                  <div className="key-row" key={row}>
                    {rowIndex === 2 && <button className="key wide-key" onClick={() => pressKey("ENTER")}>Enter</button>}
                    {row.split("").map((key) => <button key={key} onClick={() => pressKey(key)} className={`key key-${keyboardStates.get(key) ?? 0}`}>{key}</button>)}
                    {rowIndex === 2 && <button className="key wide-key" onClick={() => pressKey("BACKSPACE")} aria-label="Backspace">⌫</button>}
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
