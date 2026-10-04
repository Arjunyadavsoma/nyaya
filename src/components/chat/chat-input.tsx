"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Square, Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface ChatInputProps {
  onSend: (msg: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  disabled?: boolean;
  lastAssistantText?: string;
}

export function ChatInput({ onSend, onStop, isStreaming, disabled, lastAssistantText }: ChatInputProps) {
  const [text, setText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (taRef.current) {
      taRef.current.style.height = "auto";
      taRef.current.style.height = Math.min(taRef.current.scrollHeight, 120) + "px";
    }
  }, [text]);

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming || disabled) return;
    onSend(trimmed);
    setText("");
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        stream.getTracks().forEach(t => t.stop());
        try {
          const form = new FormData();
          form.append("audio", blob, "voice.webm");
          const res = await fetch("/api/ai/asr", { method: "POST", body: form });
          if (res.ok) {
            const data = await res.json();
            if (data.text) setText(t => (t ? t + " " : "") + data.text);
          } else {
            toast.error("Voice transcription failed");
          }
        } catch {
          toast.error("Voice transcription failed");
        }
      };
      mr.start();
      recRef.current = mr;
      setIsRecording(true);
    } catch {
      toast.error("Microphone access denied");
    }
  };

  const stopRecording = () => {
    recRef.current?.stop();
    setIsRecording(false);
  };

  const speak = async () => {
    if (isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
      return;
    }
    if (!lastAssistantText) {
      toast.info("No message to read aloud");
      return;
    }
    try {
      const res = await fetch("/api/ai/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: lastAssistantText.slice(0, 1000) }),
      });
      if (!res.ok) throw new Error("TTS failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (!audioRef.current) audioRef.current = new Audio();
      audioRef.current.src = url;
      audioRef.current.onended = () => setIsPlaying(false);
      await audioRef.current.play();
      setIsPlaying(true);
    } catch {
      toast.error("Text-to-speech failed");
    }
  };

  return (
    <div className="border-t border-border bg-card/80 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-3xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3">
        <div className={cn(
          "flex items-end gap-1.5 rounded-2xl border bg-background transition-all",
          text.trim() ? "border-primary/40 shadow-sm" : "border-border",
          isRecording && "border-emergency/50"
        )}>
          {/* Left: voice + TTS */}
          <div className="flex flex-row sm:flex-col gap-0.5 pb-1.5 pl-1.5">
            <button
              onClick={isRecording ? stopRecording : startRecording}
              className={cn(
                "h-8 w-8 rounded-lg inline-flex items-center justify-center transition-colors shrink-0",
                isRecording ? "bg-emergency/15 text-emergency" : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
              aria-label={isRecording ? "Stop recording" : "Voice input"}
              title={isRecording ? "Stop recording" : "Voice input"}
            >
              {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>
            <button
              onClick={speak}
              className={cn(
                "h-8 w-8 rounded-lg inline-flex items-center justify-center transition-colors shrink-0",
                isPlaying ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
              aria-label={isPlaying ? "Pause audio" : "Read aloud"}
              title={isPlaying ? "Pause" : "Read aloud"}
            >
              {isPlaying ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
          </div>

          {/* Textarea */}
          <textarea
            ref={taRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask about your legal rights…"
            disabled={disabled}
            rows={1}
            className="flex-1 min-h-[40px] max-h-32 resize-none border-0 bg-transparent outline-none px-1 py-2 text-sm placeholder:text-muted-foreground/60"
            aria-label="Chat message input"
          />

          {/* Right: Send / Stop */}
          <div className="pb-1.5 pr-1.5 shrink-0">
            {isStreaming ? (
              <button
                onClick={onStop}
                className="h-9 w-9 rounded-xl bg-emergency/10 border border-emergency/30 text-emergency hover:bg-emergency/20 inline-flex items-center justify-center transition-colors"
                aria-label="Stop streaming"
              >
                <Square className="h-3.5 w-3.5" fill="currentColor" />
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={!text.trim() || disabled}
                className={cn(
                  "h-9 w-9 rounded-xl inline-flex items-center justify-center transition-all",
                  text.trim()
                    ? "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95 shadow-sm"
                    : "bg-muted text-muted-foreground/40"
                )}
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Hint — desktop only */}
        <p className="hidden sm:flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground/50 mt-2">
          <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted text-[9px] font-mono">Enter</kbd>
          to send
          <span className="mx-1">·</span>
          <kbd className="px-1.5 py-0.5 rounded border border-border bg-muted text-[9px] font-mono">Shift+Enter</kbd>
          for new line
        </p>
      </div>
    </div>
  );
}
